import type { QueryClient } from '@tanstack/react-query'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { renderWorkspace } from '@/test/renderWorkspace'
import { chatKeys } from '@/query/chatKeys'
import type { ProjectRole } from '@/types'
import ProjectSettingsPage from './ProjectSettingsPage'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
afterEach(cleanup)

function seed(client: QueryClient, role: ProjectRole = 'PROJECT_ADMIN') {
  client.setQueryData(['projects', 'p1'], {
    id: 'p1',
    teamId: 't1',
    name: 'qgents-web',
    description: '前端工作台',
    role,
    status: 'ACTIVE',
  })
  client.setQueryData(
    ['projects', 'p1', 'members'],
    [
      { userId: 'u1', role: 'PROJECT_ADMIN' },
      { userId: 'u2', role: 'PROJECT_MEMBER' },
      { userId: 'u3', role: 'PROJECT_ADMIN' },
    ],
  )
  client.setQueryData(
    ['teams', 't1', 'members'],
    [
      { userId: 'u1', displayName: '何乐', email: 'hele@example.test', role: 'TEAM_ADMIN' },
      { userId: 'u2', displayName: '徐亦然', email: 'xu@example.test', role: 'TEAM_MEMBER' },
      { userId: 'u3', displayName: '所有者', email: 'owner@example.test', role: 'TEAM_OWNER' },
      { userId: 'u4', displayName: '未加入', email: 'new@example.test', role: 'TEAM_MEMBER' },
    ],
  )
  client.setQueryData(chatKeys.groups('p1'), [
    { id: 'g1', projectId: 'p1', title: '默认群', defaultGroup: true },
  ])
}

it('lets project admins edit basics and manage members', async () => {
  renderWorkspace(
    <ProjectSettingsPage />,
    '/app/projects/p1/settings',
    '/app/projects/:projectId/settings',
    (client) => seed(client),
  )

  expect(await screen.findByDisplayValue('qgents-web')).toBeInTheDocument()
  expect(screen.getByDisplayValue('默认群')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('tab', { name: '成员' }))
  expect(await screen.findByText('徐亦然')).toBeInTheDocument()
  // 自己与团队所有者不可移出，普通成员可以。
  expect(screen.getAllByRole('button', { name: '移出' })).toHaveLength(1)
  expect(screen.getByLabelText('调整 徐亦然 的项目角色')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '添加成员' }))
  expect(await screen.findByRole('checkbox', { name: '未加入' })).toBeInTheDocument()
  expect(screen.queryByRole('checkbox', { name: '所有者' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('tab', { name: '归档' }))
  expect(await screen.findByRole('button', { name: '归档 qgents-web' })).toBeInTheDocument()
})

it('keeps project basics and archiving read-only for ordinary members', async () => {
  renderWorkspace(
    <ProjectSettingsPage />,
    '/app/projects/p1/settings',
    '/app/projects/:projectId/settings',
    (client) => seed(client, 'PROJECT_MEMBER'),
  )

  expect(await screen.findByText('只有项目管理员可以修改项目资料。')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('tab', { name: '归档' }))
  expect(await screen.findByText('只有项目管理员可以归档或恢复项目。')).toBeInTheDocument()
})
