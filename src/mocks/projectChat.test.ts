import { afterAll, beforeAll, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './handlers'
import { appendDemoReply } from './projectChat'
import type { ChatMessage } from '@/types/chat'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

const origin = window.location.origin
async function messagesOf(groupId: string): Promise<ChatMessage[]> {
  const response = await fetch(`${origin}/api/projects/2/groups/${groupId}/messages`)
  return ((await response.json()) as { data: ChatMessage[] }).data
}

it('appends the demo reply with the client message id that replaces the temporary run', async () => {
  // mock 没有 WS：append 后必须派发消息事件，聊天页才会增量拉到这条正式回复。
  const events: unknown[] = []
  const listener = (event: Event) => events.push((event as CustomEvent<unknown>).detail)
  window.addEventListener('qgents:message-event', listener)
  const reply = appendDemoReply({
    rootRunId: '9001',
    agentId: 'demo-agent',
    agentName: 'Qgent',
    text: '模拟运行完成后的正式回复',
  })
  expect(reply).not.toBeNull()
  expect(reply?.clientMessageId).toBe('qgent-reply:9001')
  expect(reply?.replyToId).toBe('9011')
  expect(reply?.senderType).toBe('AGENT')
  const history = await messagesOf('901')
  expect(history[0].id).toBe(reply?.id)
  expect(history[0].content).toEqual({ text: '模拟运行完成后的正式回复' })
  window.removeEventListener('qgents:message-event', listener)
  expect(events).toEqual([{ projectId: '2', groupId: '901' }])
})
