import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { chatApi } from '@/api/chat'
import { QGENT_ID } from '@/types/chat'
import { renderWorkspace } from '@/test/renderWorkspace'
import { GroupMembersModal } from './GroupMembersModal'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('creates a group with a trimmed name and member IDs without asking for a description', async () => {
  const created = { id: 'g1', projectId: 'p1', title: '方案讨论', defaultGroup: false }
  const create = vi.spyOn(chatApi, 'createGroup').mockResolvedValue(created)
  const onCreated = vi.fn()
  renderWorkspace(<GroupMembersModal projectId="p1" teamId="t1" onClose={vi.fn()} onCreated={onCreated} />, '/app', '/app', client => {
    client.setQueryData(['projects', 'p1', 'members'], [])
    client.setQueryData(['teams', 't1', 'members'], [])
  })
  expect(screen.queryByLabelText(/简介/)).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('群聊名称'), { target: { value: '  方案讨论  ' } })
  fireEvent.click(screen.getByRole('button', { name: '创建群聊' }))
  await waitFor(() => expect(create).toHaveBeenCalledWith('p1', { title: '方案讨论', userIds: [], agentIds: [] }))
  expect(onCreated).toHaveBeenCalledWith(created)
})

it('offers only the fixed Qgent identity and sends its fixed ID when invited', async () => {
  const user = userEvent.setup()
  const create = vi.spyOn(chatApi, 'createGroup').mockResolvedValue({ id: 'g2', projectId: 'p1', title: '设计', defaultGroup: false })
  renderWorkspace(<GroupMembersModal projectId="p1" teamId="t1" onClose={vi.fn()} />, '/app', '/app', client => {
    client.setQueryData(['projects', 'p1', 'members'], [])
    client.setQueryData(['teams', 't1', 'members'], [])
  })
  await user.type(screen.getByLabelText('群聊名称'), '设计')
  await user.click(screen.getByRole('checkbox', { name: 'Qgent' }))
  await user.click(screen.getByRole('button', { name: '创建群聊' }))
  await waitFor(() => expect(create).toHaveBeenCalledWith('p1', { title: '设计', userIds: [], agentIds: [QGENT_ID] }))
})
