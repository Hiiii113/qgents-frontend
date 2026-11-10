import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { handlers } from '@/mocks/handlers'
import { renderWorkspace } from '@/test/renderWorkspace'
import type { ChatMember } from '@/types/chat'
import { chatKeys } from './useChatMessages'
import { ChatPanel } from './ChatPanel'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
afterEach(cleanup)
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

function open(members: ChatMember[]) {
  return renderWorkspace(<ChatPanel projectId="p1" groupId="g1" />, '/app/projects/p1/chat', '/app/projects/:projectId/chat', client => {
    client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1', name: '项目', role: 'PROJECT_ADMIN' })
    client.setQueryData(chatKeys.groups('p1'), [{ id: 'g1', projectId: 'p1', title: '讨论', defaultGroup: false }])
    client.setQueryData(chatKeys.members('p1', 'g1'), members)
    client.setQueryData(chatKeys.messages('p1', 'g1'), { pages: [{ data: [], page: { hasMore: false, nextCursor: null } }], pageParams: [undefined] })
  })
}

it('offers current group members without requesting team agents', async () => {
  let teamAgentLookups = 0
  server.use(http.get('/api/teams/:teamId/agents', () => {
    teamAgentLookups += 1
    return HttpResponse.json({ data: [{ id: 'legacy-agent', name: '旧伙伴' }] })
  }))
  open([{ id: 'u2', displayName: '张工', memberType: 'USER' }])
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('消息内容'), '@')
  expect(await screen.findByRole('menuitem', { name: /张工/ })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: /Agent|旧伙伴/ })).not.toBeInTheDocument()
  expect(teamAgentLookups).toBe(0)
})

it('lists every agent joined to the group with its own name', async () => {
  open([
    { id: 'u2', displayName: '张工', memberType: 'USER' },
    { id: '101', displayName: 'Qgent', memberType: 'AGENT' },
    { id: '102', displayName: '前端助手', memberType: 'AGENT' },
  ])
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('消息内容'), '@')
  expect(await screen.findByRole('menuitem', { name: /Qgent/ })).toBeInTheDocument()
  expect(await screen.findByRole('menuitem', { name: /前端助手/ })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /位成员/ }))
  expect(await screen.findByText('前端助手')).toBeInTheDocument()
})
