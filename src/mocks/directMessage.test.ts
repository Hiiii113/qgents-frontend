import { afterAll, beforeAll, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { waitFor } from '@testing-library/react'
import type { ChatMessage } from '@/types/chat'
import { handlers } from './handlers'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

const api = (path: string) => `${window.location.origin}/api${path}`
const post = async (path: string, body: unknown) => {
  const response = await fetch(api(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, json: (await response.json()) as { data: unknown } }
}

it('reuses the conversation for the same peer and delivers the agent reply', async () => {
  const agents = (await (await fetch(api('/projects/2/agents'))).json()) as {
    data: { id: string }[]
  }
  const peer = agents.data[0]
  const peerBody = { peerType: 'AGENT', peerId: peer.id }

  const opened = await post('/projects/2/direct-messages', peerBody)
  const again = await post('/projects/2/direct-messages', peerBody)
  const conversationId = (opened.json.data as { id: string }).id
  expect((again.json.data as { id: string }).id).toBe(conversationId)

  const events: unknown[] = []
  const listener = (event: Event) => events.push((event as CustomEvent<unknown>).detail)
  window.addEventListener('qgents:message-event', listener)

  const sent = await post(`/projects/2/direct-messages/${conversationId}/messages`, {
    type: 'TEXT',
    content: { text: '私聊开工' },
    clientMessageId: 'dm-test-1',
  })
  const trigger = sent.json.data as ChatMessage
  expect(sent.status).toBe(201)
  expect(trigger.senderType).toBe('USER')
  expect(trigger.groupId).toBe(conversationId)

  // Agent 回复按实时帧的形状派发事件，聊天页据此增量补齐，不用重新拉全量。
  await waitFor(() => expect(events).toContainEqual({ projectId: '2', groupId: conversationId }))
  window.removeEventListener('qgents:message-event', listener)

  const history = (await (
    await fetch(api(`/projects/2/direct-messages/${conversationId}/messages`))
  ).json()) as { data: ChatMessage[] }
  const reply = history.data[0]
  expect(reply.senderType).toBe('AGENT')
  expect(reply.replyToId).toBe(trigger.id)
  expect(reply.clientMessageId).toBe(`qgent-reply:${trigger.id}`)
  expect(reply.groupId).toBe(conversationId)

  const read = await post(`/projects/2/direct-messages/${conversationId}/read`, {})
  expect(read.json.data).toMatchObject({ conversationId, unreadCount: 0 })
})

it('rejects private chats with yourself and keeps mentions out of the payload', async () => {
  const self = await post('/projects/2/direct-messages', { peerType: 'USER', peerId: '1' })
  expect(self.status).toBe(422)
  expect((self.json as unknown as { error: { code: string } }).error.code).toBe(
    'DIRECT_PEER_INVALID',
  )
})
