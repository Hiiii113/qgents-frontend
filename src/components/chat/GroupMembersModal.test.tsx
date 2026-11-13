import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { chatApi } from '@/api/chat'
import { renderWorkspace } from '@/test/renderWorkspace'
import { GroupMembersModal } from './GroupMembersModal'
import { chatKeys } from './useChatMessages'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const agents = [
  {
    id: '101',
    name: 'Qgent',
    description: '项目默认 Agent',
    defaultAgent: true,
    status: 'ACTIVE' as const,
  },
  { id: '102', name: '前端助手', defaultAgent: false, status: 'ACTIVE' as const },
]

it('creates a group with a trimmed name and member IDs without asking for a description', async () => {
  const created = { id: 'g1', projectId: 'p1', title: '方案讨论', defaultGroup: false }
  const create = vi.spyOn(chatApi, 'createGroup').mockResolvedValue(created)
  const onCreated = vi.fn()
  renderWorkspace(
    <GroupMembersModal projectId="p1" teamId="t1" onClose={vi.fn()} onCreated={onCreated} />,
    '/app',
    '/app',
    (client) => {
      client.setQueryData(['projects', 'p1', 'members'], [])
      client.setQueryData(['teams', 't1', 'members'], [])
      client.setQueryData(chatKeys.agents('p1'), [])
    },
  )
  expect(screen.queryByLabelText(/简介/)).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('群聊名称'), { target: { value: '  方案讨论  ' } })
  fireEvent.click(screen.getByRole('button', { name: '创建群聊' }))
  await waitFor(() =>
    expect(create).toHaveBeenCalledWith('p1', { title: '方案讨论', userIds: [], agentIds: [] }),
  )
  expect(onCreated).toHaveBeenCalledWith(created)
})

it('offers the project enabled agents and sends the chosen agent ids', async () => {
  const user = userEvent.setup()
  const create = vi
    .spyOn(chatApi, 'createGroup')
    .mockResolvedValue({ id: 'g2', projectId: 'p1', title: '设计', defaultGroup: false })
  renderWorkspace(
    <GroupMembersModal projectId="p1" teamId="t1" onClose={vi.fn()} />,
    '/app',
    '/app',
    (client) => {
      client.setQueryData(['projects', 'p1', 'members'], [])
      client.setQueryData(['teams', 't1', 'members'], [])
      client.setQueryData(chatKeys.agents('p1'), agents)
    },
  )
  await user.type(screen.getByLabelText('群聊名称'), '设计')
  await user.click(await screen.findByRole('combobox', { name: 'Agent' }))
  await user.click(await screen.findByTitle('前端助手'))
  await user.click(screen.getByRole('button', { name: '创建群聊' }))
  await waitFor(() =>
    expect(create).toHaveBeenCalledWith('p1', { title: '设计', userIds: [], agentIds: ['102'] }),
  )
})

it('keeps an agent available when a user happens to share its numeric id', async () => {
  const user = userEvent.setup()
  renderWorkspace(
    <GroupMembersModal
      projectId="p1"
      teamId="t1"
      group={{ id: 'g1', projectId: 'p1', title: '讨论' }}
      onClose={vi.fn()}
    />,
    '/app',
    '/app',
    (client) => {
      client.setQueryData(
        ['projects', 'p1', 'members'],
        [
          { userId: '101', displayName: '王工' },
          { userId: '102', displayName: '李工' },
        ],
      )
      client.setQueryData(['teams', 't1', 'members'], [])
      client.setQueryData(chatKeys.agents('p1'), agents)
      // 群里的用户 102 与 Agent 102 撞号：只该隐藏已入群的人，Agent 102 仍可选。
      client.setQueryData(chatKeys.members('p1', 'g1'), [
        { id: '102', displayName: '李工', memberType: 'USER' },
      ])
    },
  )
  await user.click(await screen.findByRole('combobox', { name: 'Agent' }))
  expect(await screen.findByTitle('前端助手')).toBeInTheDocument()
  await user.click(screen.getByRole('combobox', { name: '项目成员' }))
  expect(await screen.findByTitle('王工')).toBeInTheDocument()
  expect(screen.queryByTitle('李工')).not.toBeInTheDocument()
})

it('does not offer agents that already joined the group', async () => {
  const user = userEvent.setup()
  renderWorkspace(
    <GroupMembersModal
      projectId="p1"
      teamId="t1"
      group={{ id: 'g1', projectId: 'p1', title: '讨论' }}
      onClose={vi.fn()}
    />,
    '/app',
    '/app',
    (client) => {
      client.setQueryData(['projects', 'p1', 'members'], [])
      client.setQueryData(['teams', 't1', 'members'], [])
      client.setQueryData(chatKeys.agents('p1'), agents)
      client.setQueryData(chatKeys.members('p1', 'g1'), [
        { id: '101', displayName: 'Qgent', memberType: 'AGENT' },
      ])
    },
  )
  await user.click(await screen.findByRole('combobox', { name: 'Agent' }))
  expect(await screen.findByTitle('前端助手')).toBeInTheDocument()
  expect(screen.queryByTitle('Qgent')).not.toBeInTheDocument()
})
