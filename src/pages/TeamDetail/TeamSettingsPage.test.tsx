import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { renderWorkspace } from '@/test/renderWorkspace'
import TeamSettingsPage from './TeamSettingsPage'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
afterEach(cleanup)

it('shows Chinese team roles without the demotion note and keeps member permissions', async () => {
  renderWorkspace(<TeamSettingsPage />, '/app/teams/t1/settings', '/app/teams/:teamId/settings', client => {
    client.setQueryData(['teams', 't1'], { id: 't1', name: '团队', role: 'TEAM_OWNER' })
    client.setQueryData(['teams', 't1', 'members'], [
      { userId: 'u1', displayName: '团队创建者', role: 'TEAM_OWNER' },
      { userId: 'u2', displayName: '团队伙伴', role: 'TEAM_MEMBER' },
    ])
    client.setQueryData(['teams', 't1', 'invitations'], [])
  })
  fireEvent.click(screen.getByRole('tab', { name: '成员管理' }))
  expect(await screen.findByText('管理员')).toBeInTheDocument()
  expect(screen.getAllByText('成员').length).toBeGreaterThan(1)
  expect(screen.queryByText(/不可降级|Owner|Member/)).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: '移除' })).toHaveLength(1)
// 该测试首次挂载完整的 Ant Design Form、Tabs 和 Table，jsdom 渲染需要更长时间。
}, 20_000)
