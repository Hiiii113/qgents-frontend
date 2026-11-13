import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { projectApi } from '@/api/project'
import { useAppUiStore } from '@/store/appUiStore'
import { renderWorkspace } from '@/test/renderWorkspace'
import TeamDetailPage from './TeamDetailPage'

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', displayName: '小林' } }),
}))

vi.mock('@/realtime/useTeamEvents', () => ({ useTeamEvents: () => {} }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useAppUiStore.getState().clearContext()
})

function renderTeam(role: 'TEAM_OWNER' | 'TEAM_ADMIN' | 'TEAM_MEMBER') {
  useAppUiStore.getState().setCurrentTeam('t2')
  return renderWorkspace(<TeamDetailPage />, '/app/teams/t2', '/app/teams/:teamId', (client) => {
    client.setQueryData(['teams', 't2'], {
      id: 't2',
      name: '设计团队',
      description: '一起做产品设计',
      role,
    })
  })
}

it('opens the team context from its own header and enters projects directly', async () => {
  const list = vi.spyOn(projectApi, 'listByTeam').mockResolvedValue([
    { id: 'p1', teamId: 't2', name: '设计讨论', status: 'ACTIVE', role: 'PROJECT_ADMIN' },
    { id: 'p2', teamId: 't2', name: '研发协作', status: 'ACTIVE', role: 'PROJECT_ADMIN' },
  ])
  renderTeam('TEAM_OWNER')
  expect(await screen.findByRole('heading', { name: '设计团队' })).toBeInTheDocument()
  expect(screen.getByText('一起做产品设计')).toBeInTheDocument()
  expect(screen.queryByText(/欢迎回来/)).not.toBeInTheDocument()
  expect(await screen.findByRole('link', { name: /设计讨论/ })).toHaveAttribute(
    'href',
    '/app/projects/p1/chat',
  )
  expect(list).toHaveBeenCalledWith('t2')

  expect(screen.getByRole('button', { name: /GitHub 授权/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /邀请成员/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /团队设置/ })).toBeInTheDocument()

  fireEvent.change(screen.getByRole('textbox', { name: '搜索项目' }), { target: { value: '研发' } })
  expect(screen.queryByRole('link', { name: /设计讨论/ })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /研发协作/ })).toBeInTheDocument()
})

it('lets team admins create projects and invite members without owning GitHub', async () => {
  const list = vi.spyOn(projectApi, 'listByTeam').mockResolvedValue([])
  renderTeam('TEAM_ADMIN')
  expect(await screen.findByRole('button', { name: /创建项目/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /邀请成员/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /团队设置/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /GitHub 授权/ })).not.toBeInTheDocument()
  expect(list).toHaveBeenCalledWith('t2')
})

it('keeps member management and GitHub hidden from ordinary team members', async () => {
  vi.spyOn(projectApi, 'listByTeam').mockResolvedValue([])
  renderTeam('TEAM_MEMBER')
  expect(await screen.findByRole('heading', { name: '设计团队' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /创建项目/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /邀请成员/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /GitHub 授权/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /团队设置/ })).toBeInTheDocument()
})
