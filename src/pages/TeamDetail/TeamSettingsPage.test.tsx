import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { renderWorkspace } from '@/test/renderWorkspace'
import TeamSettingsPage from './TeamSettingsPage'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
afterEach(cleanup)

it('shows owner, admin and member roles and lets the owner manage roles', async () => {
  renderWorkspace(
    <TeamSettingsPage />,
    '/app/teams/t1/settings',
    '/app/teams/:teamId/settings',
    (client) => {
      client.setQueryData(['teams', 't1'], { id: 't1', name: '团队', role: 'TEAM_OWNER' })
      client.setQueryData(
        ['teams', 't1', 'members'],
        [
          { userId: 'u1', displayName: '团队创建者', role: 'TEAM_OWNER' },
          { userId: 'u2', displayName: '团队管理员', role: 'TEAM_ADMIN' },
          { userId: 'u3', displayName: '团队伙伴', role: 'TEAM_MEMBER' },
        ],
      )
      client.setQueryData(['teams', 't1', 'invitations'], [])
    },
  )
  fireEvent.click(screen.getByRole('tab', { name: '成员管理' }))
  expect(await screen.findByText('所有者')).toBeInTheDocument()
  expect(screen.getAllByText('管理员').length).toBeGreaterThan(0)
  expect(screen.getAllByText('成员').length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: /GitHub 集成/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '解散团队' })).toBeInTheDocument()
  expect(screen.getByLabelText('调整 团队管理员 的团队角色')).toBeInTheDocument()
  expect(screen.getByLabelText('调整 团队伙伴 的团队角色')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: '移除' })).toHaveLength(2)
  expect(screen.queryByText(/不可降级|Owner|Member/)).not.toBeInTheDocument()
}, 60_000)

it('lets a team admin manage invitations and ordinary members but not admins or owner', async () => {
  renderWorkspace(
    <TeamSettingsPage />,
    '/app/teams/t1/settings',
    '/app/teams/:teamId/settings',
    (client) => {
      client.setQueryData(['teams', 't1'], { id: 't1', name: '团队', role: 'TEAM_ADMIN' })
      client.setQueryData(
        ['teams', 't1', 'members'],
        [
          { userId: 'u2', displayName: '团队创建者', role: 'TEAM_OWNER' },
          { userId: 'u1', displayName: '团队管理员', role: 'TEAM_ADMIN' },
          { userId: 'u3', displayName: '团队伙伴', role: 'TEAM_MEMBER' },
        ],
      )
      client.setQueryData(['teams', 't1', 'invitations'], [])
    },
  )
  fireEvent.click(screen.getByRole('tab', { name: '成员管理' }))
  expect(await screen.findByText('所有者')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: '移除' })).toHaveLength(1)
  expect(screen.getByRole('button', { name: /发送邀请/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /GitHub 集成/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '解散团队' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/调整 .* 的团队角色/)).not.toBeInTheDocument()
  expect(screen.getByText(/团队管理员可以邀请和移除普通成员/)).toBeInTheDocument()
}, 60_000)

it('does not expose team management actions to ordinary members', async () => {
  renderWorkspace(
    <TeamSettingsPage />,
    '/app/teams/t1/settings',
    '/app/teams/:teamId/settings',
    (client) => {
      client.setQueryData(['teams', 't1'], { id: 't1', name: '团队', role: 'TEAM_MEMBER' })
      client.setQueryData(
        ['teams', 't1', 'members'],
        [
          { userId: 'u2', displayName: '团队创建者', role: 'TEAM_OWNER' },
          { userId: 'u1', displayName: '团队伙伴', role: 'TEAM_MEMBER' },
        ],
      )
    },
  )
  fireEvent.click(screen.getByRole('tab', { name: '成员管理' }))
  expect(await screen.findByText('所有者')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /发送邀请/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '移除' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/调整 .* 的团队角色/)).not.toBeInTheDocument()
}, 60_000)
