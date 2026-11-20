import { afterEach, describe, expect, it, vi } from 'vitest'
import { directMessageApi } from './directMessage'

const response = (data: unknown) =>
  new Response(JSON.stringify({ data }), { headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.restoreAllMocks())

describe('direct message contracts', () => {
  it('opens a conversation by peer type and id', async () => {
    const conversation = {
      id: 'c1',
      projectId: 'p1',
      peer: { type: 'AGENT', id: 'a1', displayName: 'Qgent', avatarUrl: null },
    }
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(conversation))
    expect(await directMessageApi.open('p1', { peerType: 'AGENT', peerId: 'a1' })).toEqual(
      conversation,
    )
    expect(spy).toHaveBeenCalledWith(
      '/api/projects/p1/direct-messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ peerType: 'AGENT', peerId: 'a1' }),
      }),
    )
  })

  it('sends without mentions and keeps the conversation id on returned messages', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response({
        id: 'm1',
        groupId: 'c1',
        sequence: 1,
        type: 'TEXT',
        content: { text: '开工' },
        senderType: 'USER',
        createdAt: '2026-10-01T00:00:00Z',
      }),
    )
    const message = await directMessageApi.send('p1', 'c1', {
      type: 'TEXT',
      content: { text: '开工' },
      mentions: [],
      clientMessageId: 'send-1',
    })
    expect(message.groupId).toBe('c1')
    expect(spy).toHaveBeenCalledWith(
      '/api/projects/p1/direct-messages/c1/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ type: 'TEXT', content: { text: '开工' }, clientMessageId: 'send-1' }),
      }),
    )
  })

  it('reads one conversation without leaking the group endpoints', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(response({ conversationId: 'c1', lastReadSequenceNo: 4, unreadCount: 0 }))
    await directMessageApi.read('p1', 'c1')
    expect(spy).toHaveBeenCalledWith(
      '/api/projects/p1/direct-messages/c1/read',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
