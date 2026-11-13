import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useLocation } from 'react-router-dom'
import { projectApi } from '@/api'
import { useAppUiStore } from '@/store/appUiStore'
import { chatKeys } from '@/query/chatKeys'
import { renderWorkspace } from '@/test/renderWorkspace'
import { Banner } from './Banner'

vi.mock('./PersonalCenter', () => ({ PersonalCenter: () => <button>个人中心</button> }))
vi.mock('./NotificationCenter', () => ({ NotificationCenter: () => <button>通知</button> }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useAppUiStore.getState().clearContext()
})

function Address() {
  const location = useLocation()
  return <output>{location.pathname + location.search}</output>
}

function renderBanner(path: string, seed: Parameters<typeof renderWorkspace>[3]) {
  return renderWorkspace(
    <>
      <Banner />
      <Address />
    </>,
    path,
    '/app/*',
    seed,
  )
}

it('links the team name back to the team page and shows the current project', () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  renderBanner('/app/projects/p1/chat?groupId=g1', (client) => {
    client.setQueryData(['teams', 'mine'], [{ id: 't1', name: '团队一' }])
    client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1', name: '项目一' })
    client.setQueryData(['teams', 't1', 'projects'], [{ id: 'p1', teamId: 't1', name: '项目一' }])
  })

  expect(screen.getByRole('link', { name: 'Qgents 项目首页' })).toHaveAttribute(
    'href',
    '/app/teams/t1',
  )
  expect(screen.getByRole('link', { name: '团队一' })).toHaveAttribute('href', '/app/teams/t1')
  expect(screen.getByText('项目一')).toBeInTheDocument()
})

it('shows no group name in the banner, even inside a chat', () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  renderBanner('/app/projects/p1/chat?groupId=g1', (client) => {
    client.setQueryData(['teams', 'mine'], [{ id: 't1', name: '团队一' }])
    client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1', name: '项目一' })
    client.setQueryData(chatKeys.groups('p1'), [
      { id: 'g1', projectId: 'p1', title: '产品讨论', defaultGroup: true },
    ])
  })

  // 群名只属于聊天左栏，顶栏不再重复
  expect(screen.queryByText(/产品讨论/)).not.toBeInTheDocument()
})

it("lists only the current team's projects and drops the old group and message on switch", async () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  vi.spyOn(projectApi, 'getById').mockResolvedValue({
    id: 'p2',
    teamId: 't1',
    name: '项目二',
    description: '',
  })
  renderBanner('/app/projects/p1/chat?groupId=g2&messageId=m9', (client) => {
    client.setQueryData(['teams', 'mine'], [{ id: 't1', name: '团队一' }])
    client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1', name: '项目一' })
    client.setQueryData(
      ['teams', 't1', 'projects'],
      [
        { id: 'p1', teamId: 't1', name: '项目一' },
        { id: 'p2', teamId: 't1', name: '项目二' },
      ],
    )
    client.setQueryData(
      ['teams', 't2', 'projects'],
      [{ id: 'p9', teamId: 't2', name: '别的团队项目' }],
    )
  })

  fireEvent.mouseDown(screen.getByRole('combobox', { name: '选择项目' }))
  fireEvent.click(await screen.findByTitle('项目二'))
  expect(screen.queryByTitle('别的团队项目')).not.toBeInTheDocument()

  await waitFor(() => expect(screen.getByText('/app/projects/p2/chat')).toBeInTheDocument())
})

it("uses the project's team over a stale stored team", () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  renderBanner('/app/projects/p1/chat', (client) => {
    client.setQueryData(
      ['teams', 'mine'],
      [
        { id: 't1', name: '旧团队' },
        { id: 't2', name: '项目所属团队' },
      ],
    )
    client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't2', name: '项目一' })
    client.setQueryData(['teams', 't2', 'projects'], [{ id: 'p1', teamId: 't2', name: '项目一' }])
  })

  expect(screen.getByRole('link', { name: '项目所属团队' })).toHaveAttribute(
    'href',
    '/app/teams/t2',
  )
  expect(screen.queryByRole('link', { name: '旧团队' })).not.toBeInTheDocument()
})

it('offers a retry when the project list fails and disables the select when it is empty', async () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  const list = vi.spyOn(projectApi, 'listByTeam').mockRejectedValue(new Error('网络异常'))
  renderBanner('/app/settings', (client) => {
    client.setQueryData(['teams', 'mine'], [{ id: 't1', name: '团队一' }])
  })

  expect(await screen.findByText('项目加载失败')).toBeInTheDocument()
  // 加载失败的项目选择不可用，但重试入口在牌头带上
  expect(screen.queryByRole('option')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
})

it('says so when the team has no project', async () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  vi.spyOn(projectApi, 'listByTeam').mockResolvedValue([])
  renderBanner('/app/settings', (client) => {
    client.setQueryData(['teams', 'mine'], [{ id: 't1', name: '团队一' }])
  })

  expect(await screen.findByText('当前团队暂无项目')).toBeInTheDocument()
  fireEvent.mouseDown(screen.getByRole('combobox', { name: '选择项目' }))
  expect(screen.queryByRole('option')).toBeNull()
})
