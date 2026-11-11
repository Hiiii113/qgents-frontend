import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { renderWorkspace } from '@/test/renderWorkspace'
import { ProjectMembers } from './ProjectMembers'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
afterEach(cleanup)

it('lets project admins promote, demote and remove members while protecting the team owner row', async () => {
  renderWorkspace(
    <ProjectMembers />,
    '/app/projects/p1/settings?tab=members',
    '/app/projects/:projectId/settings',
    (client) => {
      client.setQueryData(['projects', 'p1'], {
        id: 'p1',
        teamId: 't1',
        name: '项目',
        role: 'PROJECT_ADMIN',
      })
      client.setQueryData(
        ['projects', 'p1', 'members'],
        [
          { userId: 'u1', displayName: '当前管理员', role: 'PROJECT_ADMIN' },
          { userId: 'u2', displayName: '其他管理员', role: 'PROJECT_ADMIN' },
          { userId: 'u3', displayName: '普通成员', role: 'PROJECT_MEMBER' },
          { userId: 'u4', displayName: '所有者本人', role: 'PROJECT_ADMIN' },
        ],
      )
      client.setQueryData(
        ['teams', 't1', 'members'],
        [
          { userId: 'u1', displayName: '当前管理员', role: 'TEAM_ADMIN' },
          { userId: 'u2', displayName: '其他管理员', role: 'TEAM_MEMBER' },
          { userId: 'u3', displayName: '普通成员', role: 'TEAM_MEMBER' },
          { userId: 'u4', displayName: '所有者本人', role: 'TEAM_OWNER' },
        ],
      )
    },
  )

  expect(await screen.findByText('当前管理员')).toBeInTheDocument()
  expect(screen.getByText('继承管理员')).toBeInTheDocument()
  expect(screen.getByText('团队所有者')).toBeInTheDocument()
  expect(screen.getByText(/团队所有者始终拥有本项目管理员权限/)).toBeInTheDocument()
  // 自己和其他管理员都可降级；自己不可移除，其他管理员可移除。
  expect(screen.getAllByRole('button', { name: '降为成员' })).toHaveLength(2)
  expect(screen.getAllByRole('button', { name: '设为管理员' })).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: '移除' })).toHaveLength(2)
}, 30_000)

it('does not show member management actions to ordinary project members', async () => {
  renderWorkspace(
    <ProjectMembers />,
    '/app/projects/p1/settings?tab=members',
    '/app/projects/:projectId/settings',
    (client) => {
      client.setQueryData(['projects', 'p1'], {
        id: 'p1',
        teamId: 't1',
        name: '项目',
        role: 'PROJECT_MEMBER',
      })
      client.setQueryData(
        ['projects', 'p1', 'members'],
        [
          { userId: 'u1', displayName: '普通成员', role: 'PROJECT_MEMBER' },
          { userId: 'u2', displayName: '管理员', role: 'PROJECT_ADMIN' },
        ],
      )
      client.setQueryData(
        ['teams', 't1', 'members'],
        [
          { userId: 'u1', displayName: '普通成员', role: 'TEAM_MEMBER' },
          { userId: 'u2', displayName: '管理员', role: 'TEAM_OWNER' },
        ],
      )
    },
  )

  expect(await screen.findByText('普通成员')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '添加成员' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '降为成员' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '设为管理员' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '移除' })).not.toBeInTheDocument()
}, 30_000)
