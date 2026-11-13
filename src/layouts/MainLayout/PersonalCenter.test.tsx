import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useLocation } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useAppUiStore } from '@/store/appUiStore'
import { renderWorkspace } from '@/test/renderWorkspace'
import { PersonalCenter } from './PersonalCenter'

const { updateUser, logout, user } = vi.hoisted(() => ({
  updateUser: vi.fn(),
  logout: vi.fn(),
  user: { id: 'u1', displayName: '小林', email: 'lin@example.test' },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user, updateUser, logout }) }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  updateUser.mockReset()
  useAppUiStore.getState().clearContext()
})

const teams = [
  { id: 't1', name: '云端研发' },
  { id: 't2', name: '遥岑科技' },
]

function Address() {
  const location = useLocation()
  return <output>{location.pathname + location.search}</output>
}

function openMenu(path = '/app/settings', seed?: Parameters<typeof renderWorkspace>[3]) {
  const view = renderWorkspace(
    <>
      <PersonalCenter />
      <Address />
    </>,
    path,
    '/app/*',
    (client) => {
      client.setQueryData(['teams', 'mine'], teams)
      if (seed) seed(client)
    },
  )
  fireEvent.click(screen.getByRole('button', { name: '打开个人中心' }))
  return view
}

it('opens a profile popover with inline avatar and nickname controls', async () => {
  openMenu()
  expect(await screen.findByRole('region', { name: '个人中心' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '更换个人头像' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '修改昵称' })).toBeInTheDocument()
  expect(document.querySelector('.ant-drawer')).toBeNull()
})

it('offers team switching, creating and joining, settings and logout', async () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  openMenu()
  const menu = await screen.findByRole('region', { name: '个人中心' })
  expect(screen.getByRole('combobox', { name: '团队' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /创建团队/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /加入团队/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /设置/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /退出登录/ })).toBeInTheDocument()
  expect(menu).toHaveTextContent('云端研发')
})

it('switches team only after the server confirms, then enters that team', async () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  const selectTeam = vi.spyOn(authApi, 'selectTeam').mockResolvedValue(undefined)
  const { client } = openMenu('/app/settings', (seedClient) =>
    seedClient.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1', name: '项目一' }),
  )
  await screen.findByRole('region', { name: '个人中心' })

  fireEvent.mouseDown(screen.getByRole('combobox', { name: '团队' }))
  fireEvent.click(await screen.findByTitle('遥岑科技'))

  await waitFor(() => expect(screen.getByText('/app/teams/t2')).toBeInTheDocument())
  expect(selectTeam).toHaveBeenCalledWith('t2')
  expect(useAppUiStore.getState().currentTeamId).toBe('t2')
  // 切团队不动项目缓存：回到原团队时不用重新加载
  expect(client.getQueryData(['projects', 'p1'])).toBeDefined()
})

it('keeps the current team and page when switching fails', async () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  vi.spyOn(authApi, 'selectTeam').mockRejectedValue(new Error('网络异常'))
  const { client } = openMenu('/app/settings', (seedClient) =>
    seedClient.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1', name: '项目一' }),
  )
  await screen.findByRole('region', { name: '个人中心' })

  fireEvent.mouseDown(screen.getByRole('combobox', { name: '团队' }))
  fireEvent.click(await screen.findByTitle('遥岑科技'))

  expect(await screen.findByText('网络异常')).toBeInTheDocument()
  expect(useAppUiStore.getState().currentTeamId).toBe('t1')
  expect(screen.getByText('/app/settings')).toBeInTheDocument()
  expect(client.getQueryData(['projects', 'p1'])).toBeDefined()
})

it('carries the current project back with it when opening settings', async () => {
  openMenu('/app/projects/p1/chat?groupId=g2')
  await screen.findByRole('region', { name: '个人中心' })

  fireEvent.click(screen.getByRole('button', { name: /设置/ }))

  const address = screen.getByText(/^\/app\/settings/).textContent ?? ''
  const query = new URLSearchParams(address.slice(address.indexOf('?')))
  expect(query.get('returnTo')).toBe('/app/projects/p1/chat?groupId=g2')
})

it('marks the current team and searches the team list', async () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  openMenu()
  await screen.findByRole('region', { name: '个人中心' })

  fireEvent.mouseDown(screen.getByRole('combobox', { name: '团队' }))
  // 当前团队在选项里带“当前”，不用展开也能从选中值看出来
  expect(await screen.findByText('当前')).toBeInTheDocument()
  expect(screen.getAllByText('云端研发')).toHaveLength(2)
  fireEvent.change(screen.getByRole('combobox', { name: '团队' }), { target: { value: '遥岑' } })
  await waitFor(() => expect(screen.getAllByText('云端研发')).toHaveLength(1))
  expect(screen.getByTitle('遥岑科技')).toBeInTheDocument()
})

it('saves the nickname and uses the server profile response', async () => {
  const updated = { ...user, displayName: '新的昵称' }
  const update = vi.spyOn(authApi, 'updateMe').mockResolvedValue(updated)
  openMenu()
  fireEvent.click(await screen.findByRole('button', { name: '修改昵称' }))
  fireEvent.change(screen.getByRole('textbox', { name: '昵称' }), {
    target: { value: ' 新的昵称 ' },
  })
  fireEvent.click(screen.getByRole('button', { name: '保存昵称' }))
  await waitFor(() => expect(updateUser).toHaveBeenCalledWith(updated))
  expect(update).toHaveBeenCalledWith({ displayName: '新的昵称' })
})

it('leaves the previous avatar intact if upload credentials fail', async () => {
  vi.spyOn(authApi, 'createAvatarCredential').mockRejectedValue(new Error('上传失败'))
  openMenu()
  await screen.findByRole('button', { name: '更换个人头像' })
  const input = document.querySelector('input[type="file"]')
  expect(input).not.toBeNull()
  fireEvent.change(input!, {
    target: { files: [new File(['image'], 'avatar.png', { type: 'image/png' })] },
  })
  expect(await screen.findByText('上传失败')).toBeInTheDocument()
  expect(updateUser).not.toHaveBeenCalled()
})

it('switches team from the keyboard', async () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  vi.spyOn(authApi, 'selectTeam').mockResolvedValue(undefined)
  openMenu()
  await screen.findByRole('region', { name: '个人中心' })

  const select = screen.getByRole('combobox', { name: '团队' })
  fireEvent.mouseDown(select)
  fireEvent.change(select, { target: { value: '遥岑' } })
  await waitFor(() => expect(screen.getByTitle('遥岑科技')).toBeInTheDocument())
  fireEvent.keyDown(select, { key: 'ArrowDown', keyCode: 40, which: 40 })
  fireEvent.keyDown(select, { key: 'Enter', keyCode: 13, which: 13 })

  await waitFor(() => expect(screen.getByText('/app/teams/t2')).toBeInTheDocument())
  expect(useAppUiStore.getState().currentTeamId).toBe('t2')
})
