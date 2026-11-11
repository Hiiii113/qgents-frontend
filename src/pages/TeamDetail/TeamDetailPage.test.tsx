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

it('welcomes the user and requests projects only for the selected team', async () => {
  useAppUiStore.getState().setCurrentTeam('t2')
  const list = vi.spyOn(projectApi, 'listByTeam').mockResolvedValue([
    { id: 'p1', teamId: 't2', name: '设计讨论', status: 'ACTIVE', role: 'PROJECT_ADMIN' },
    { id: 'p2', teamId: 't2', name: '研发协作', status: 'ACTIVE', role: 'PROJECT_ADMIN' },
  ])
  renderWorkspace(<TeamDetailPage />, '/app/teams/t2', '/app/teams/:teamId', (client) => {
    client.setQueryData(['teams', 't2'], {
      id: 't2',
      name: '不作为首页标题的团队',
      role: 'TEAM_OWNER',
    })
  })
  expect(screen.getByRole('heading', { name: '小林，欢迎回来' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '不作为首页标题的团队' })).not.toBeInTheDocument()
  expect(screen.queryByText(/01|02|03/)).not.toBeInTheDocument()
  expect(await screen.findByRole('link', { name: /设计讨论/ })).toHaveAttribute(
    'href',
    '/app/projects/p1/chat',
  )
  expect(list).toHaveBeenCalledWith('t2')
  expect(screen.queryByRole('button', { name: /团队设置/ })).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox', { name: '搜索项目' }), { target: { value: '研发' } })
  expect(screen.queryByRole('link', { name: /设计讨论/ })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /研发协作/ })).toBeInTheDocument()
})

it('shows the create project action to team admins', async () => {
  const list = vi.spyOn(projectApi, 'listByTeam').mockResolvedValue([])
  renderWorkspace(<TeamDetailPage />, '/app/teams/t2', '/app/teams/:teamId', (client) => {
    client.setQueryData(['teams', 't2'], { id: 't2', name: '团队', role: 'TEAM_ADMIN' })
  })
  expect(await screen.findByRole('button', { name: /创建项目/ })).toBeInTheDocument()
  expect(list).toHaveBeenCalledWith('t2')
})
