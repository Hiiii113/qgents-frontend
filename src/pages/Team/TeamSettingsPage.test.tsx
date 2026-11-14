import type { QueryClient } from '@tanstack/react-query'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { renderWorkspace } from '@/test/renderWorkspace'
import type { TeamRole } from '@/types'
import TeamSettingsPage from './TeamSettingsPage'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
afterEach(cleanup)

function seed(client: QueryClient, role: TeamRole) {
  client.setQueryData(['teams', 't1'], { id: 't1', name: '砺行科技', role })
  client.setQueryData(
    ['teams', 't1', 'members'],
    [
      { userId: 'u2', displayName: '团队创建者', email: 'owner@example.test', role: 'TEAM_OWNER' },
      { userId: 'u1', displayName: '何乐', email: 'hele@example.test', role: 'TEAM_ADMIN' },
      { userId: 'u3', displayName: '团队伙伴', email: 'mate@example.test', role: 'TEAM_MEMBER' },
    ],
  )
  client.setQueryData(['teams', 't1', 'invitations'], [])
}

it('lets the owner adjust roles and invite members', async () => {
  renderWorkspace(
    <TeamSettingsPage />,
    '/app/teams/t1/settings',
    '/app/teams/:teamId/settings',
    (client) => seed(client, 'TEAM_OWNER'),
  )

  expect(await screen.findByText('团队伙伴')).toBeInTheDocument()
  expect(screen.getByLabelText('调整 团队伙伴 的团队角色')).toBeInTheDocument()
  expect(screen.queryByLabelText('调整 团队创建者 的团队角色')).not.toBeInTheDocument()
  // 所有者与自己不可移除，普通成员可以。
  expect(screen.getAllByRole('button', { name: '移除' })).toHaveLength(1)
  expect(screen.getByText('还没有发出邀请')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '邀请成员' }))
  expect(await screen.findByRole('dialog')).toHaveTextContent('邀请 7 天内有效')
  fireEvent.click(screen.getByRole('button', { name: '取消' }))
})

it('shows a 403 explanation to ordinary team members', async () => {
  renderWorkspace(
    <TeamSettingsPage />,
    '/app/teams/t1/settings',
    '/app/teams/:teamId/settings',
    (client) => seed(client, 'TEAM_MEMBER'),
  )

  expect(await screen.findByText('需要团队管理员权限')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '邀请成员' })).not.toBeInTheDocument()
  expect(screen.queryByText('团队资料')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '解散团队' })).not.toBeInTheDocument()
})
