import type { QueryClient } from '@tanstack/react-query'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useLocation } from 'react-router-dom'
import { renderWorkspace } from '@/test/renderWorkspace'
import { useAppUiStore } from '@/store/appUiStore'
import SettingsPage from './SettingsPage'

const { selectTeam, updateMe, listMine, updateUser, logout, user } = vi.hoisted(() => ({
  selectTeam: vi.fn(),
  updateMe: vi.fn(),
  listMine: vi.fn(),
  updateUser: vi.fn(),
  logout: vi.fn(),
  user: { id: 'u1', email: 'lin@example.test', displayName: '小林' },
}))

vi.mock('@/api', () => ({
  authApi: { selectTeam, updateMe },
  teamApi: { listMine },
  uploadAvatar: vi.fn(),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user, updateUser, logout }) }))

const TEAMS = [
  { id: 't1', name: '甲公司' },
  { id: 't2', name: '乙公司' },
  { id: 't3', name: '丙公司' },
]

/** 把当前地址渲染出来，验证切换与失败是否真的改变路由。 */
function Address() {
  const location = useLocation()
  return <output>{`${location.pathname}${location.search}`}</output>
}

function open(path = '/app/settings', seed: (client: QueryClient) => void = () => {}) {
  return renderWorkspace(
    <>
      <SettingsPage />
      <Address />
    </>,
    path,
    '*',
    seed,
  )
}

beforeEach(() => {
  useAppUiStore.getState().setCurrentTeam(null)
  // 没有种子数据的团队查询停在加载中，不触发真实请求
  listMine.mockReturnValue(new Promise(() => {}))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useAppUiStore.getState().setCurrentTeam(null)
})

it('保存昵称只发送去空格后的昵称，保存中禁止改动并写回登录态', async () => {
  let finish: (updated: typeof user) => void = () => {}
  updateMe.mockImplementation(() => new Promise((resolve) => (finish = resolve)))
  open()

  const input = screen.getByLabelText('昵称')
  fireEvent.change(input, { target: { value: '  小林同学  ' } })
  fireEvent.click(screen.getByRole('button', { name: '保存昵称' }))

  await waitFor(() => expect(updateMe).toHaveBeenCalledWith({ displayName: '小林同学' }))
  expect(input).toBeDisabled()

  finish({ ...user, displayName: '小林同学' })
  await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ ...user, displayName: '小林同学' }))
  await waitFor(() => expect(input).not.toBeDisabled())
})

it('昵称为空时由表单校验拦下，不发请求', async () => {
  open()
  const input = screen.getByLabelText('昵称')
  fireEvent.change(input, { target: { value: '   ' } })
  fireEvent.click(screen.getByRole('button', { name: '保存昵称' }))

  expect(await screen.findByText('请输入昵称')).toBeInTheDocument()
  expect(updateMe).not.toHaveBeenCalled()
})

it('分区导航不再有外观占位，当前分区存在 URL 里', async () => {
  open('/app/settings?tab=security')

  expect(screen.queryByRole('button', { name: '外观' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '安全' })).toHaveAttribute('aria-current', 'page')

  fireEvent.click(screen.getByRole('button', { name: '团队' }))
  expect(await screen.findByText('/app/settings?tab=teams')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '账户' }))
  expect(await screen.findByText('/app/settings')).toBeInTheDocument()
})

it('从项目进来时能回到原项目，并保留群定位', async () => {
  const returnTo = '/app/projects/p1/chat?groupId=g2'
  open(`/app/settings?returnTo=${encodeURIComponent(returnTo)}`)

  fireEvent.click(screen.getByRole('button', { name: '返回项目' }))
  await waitFor(() => expect(screen.getByText(returnTo)).toBeInTheDocument())
})

it('只认站内项目地址作为回程，外部链接不出现返回项目', async () => {
  open(`/app/settings?returnTo=${encodeURIComponent('https://evil.test/app/projects/p1')}`)
  expect(screen.queryByRole('button', { name: '返回项目' })).not.toBeInTheDocument()

  cleanup()
  open(`/app/settings?returnTo=${encodeURIComponent('/app/teams/t1')}`)
  expect(screen.queryByRole('button', { name: '返回项目' })).not.toBeInTheDocument()
})

it('切换分区时保留回程参数', async () => {
  const returnTo = '/app/projects/p1/chat?groupId=g2'
  open(`/app/settings?tab=security&returnTo=${encodeURIComponent(returnTo)}`)

  fireEvent.click(screen.getByRole('button', { name: '团队' }))

  await waitFor(() => {
    const address = screen.getByText(/^\/app\/settings/).textContent ?? ''
    const query = new URLSearchParams(address.slice(address.indexOf('?')))
    expect(query.get('tab')).toBe('teams')
    expect(query.get('returnTo')).toBe(returnTo)
  })
})

it('重置密码先退出登录再进入找回密码页', async () => {
  logout.mockResolvedValue(undefined)
  open('/app/settings?tab=security')

  fireEvent.click(screen.getByRole('button', { name: '退出并重置密码' }))
  await waitFor(() => expect(logout).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.getByText('/forgot-password')).toBeInTheDocument())
})

it('退出登录回登录页', async () => {
  logout.mockResolvedValue(undefined)
  open('/app/settings?tab=security')

  fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
  await waitFor(() => expect(logout).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.getByText('/login')).toBeInTheDocument())
})

it('团队列表标出当前团队，长名字保留完整标题，空列表与加载中各有说明', async () => {
  useAppUiStore.getState().setCurrentTeam('t2')
  const longName = '一个名字特别长需要省略但悬停可以看到完整内容的事业部团队'
  const { unmount } = open('/app/settings?tab=teams', (client) => {
    client.setQueryData(['teams', 'mine'], [{ id: 't2', name: longName }])
  })

  expect(await screen.findByText(longName)).toHaveAttribute('title', longName)
  expect(screen.getByText('当前团队')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '团队管理' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^切换到/ })).not.toBeInTheDocument()

  unmount()
  open('/app/settings?tab=teams', (client) => client.setQueryData(['teams', 'mine'], []))
  expect(await screen.findByText('还没有加入任何团队。')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '创建团队' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '加入团队' })).toBeInTheDocument()

  cleanup()
  open('/app/settings?tab=teams')
  expect(await screen.findByText('正在加载团队…')).toBeInTheDocument()
})

it('切换期间不能再选团队，成功后更新当前团队并进入该团队，不清空项目缓存', async () => {
  useAppUiStore.getState().setCurrentTeam('t2')
  let finish: (value?: unknown) => void = () => {}
  selectTeam.mockImplementation(() => new Promise((resolve) => (finish = resolve)))
  const { client } = open('/app/settings?tab=teams', (queryClient) => {
    queryClient.setQueryData(['teams', 'mine'], TEAMS)
    queryClient.setQueryData(['projects', 'p1'], { id: 'p1' })
  })

  fireEvent.click(await screen.findByRole('button', { name: '切换到甲公司' }))
  await waitFor(() => expect(selectTeam).toHaveBeenCalledWith('t1'))
  await waitFor(() => expect(screen.getByRole('button', { name: '切换到丙公司' })).toBeDisabled())

  finish()
  await waitFor(() => expect(screen.getByText('/app/teams/t1')).toBeInTheDocument())
  expect(useAppUiStore.getState().currentTeamId).toBe('t1')
  expect(client.getQueryData(['projects', 'p1'])).toEqual({ id: 'p1' })
})

it('切换团队失败时留在设置页、当前团队不变并提示错误', async () => {
  useAppUiStore.getState().setCurrentTeam('t2')
  selectTeam.mockRejectedValue(new Error('网络异常'))
  open('/app/settings?tab=teams', (client) => client.setQueryData(['teams', 'mine'], TEAMS))

  fireEvent.click(await screen.findByRole('button', { name: '切换到甲公司' }))

  expect(await screen.findByText('网络异常')).toBeInTheDocument()
  expect(useAppUiStore.getState().currentTeamId).toBe('t2')
  expect(screen.getByText('/app/settings?tab=teams')).toBeInTheDocument()
})
