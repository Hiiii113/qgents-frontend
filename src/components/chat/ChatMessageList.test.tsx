import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatMessageList } from './ChatMessageList'
import type { ChatMessage } from '@/types/chat'
const agentId = '101'
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe('virtualized chat history', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 900, height: 600, top: 0, left: 0, right: 900, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(900)
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { value: vi.fn(), configurable: true, writable: true })
  })
  it('mounts a bounded number of rows for a thousand-message history', async () => {
    const messages: ChatMessage[] = Array.from({ length: 1000 }, (_, index) => ({ id: `m${index}`, sequence: index + 1, groupId: 'g1', type: 'TEXT', content: { text: `message ${index}` }, senderType: 'USER', senderId: 'u1', senderName: '成员', createdAt: '2026-10-01T00:00:00Z' }))
    const view = render(<ChatMessageList messages={messages} loading={false} hasMore={false} loadingOlder={false} isAdmin={false} stoppedIds={new Set()} targetId={null} onLoadOlder={vi.fn()} onReply={vi.fn()} onStop={vi.fn()} onPreview={vi.fn()} onLocate={vi.fn()} />)
    await waitFor(() => expect(view.container.querySelectorAll('.chat-message').length).toBeGreaterThan(0))
    expect(view.container.querySelectorAll('.chat-message').length).toBeLessThan(40)
  })
  it('keeps cancellation available until the mentioned agent has replied', async () => {
    const trigger: ChatMessage = { id: 'trigger', sequence: 1, groupId: 'g1', type: 'TEXT', content: { text: '一起分析' }, senderId: 'u1', senderType: 'USER', mentions: [{ type: 'AGENT', id: agentId }], createdAt: '2026-10-02T00:00:00Z' }
    const first: ChatMessage = { ...trigger, id: 'reply1', sequence: 2, senderType: 'AGENT', senderId: agentId, mentions: [], replyToId: trigger.id }
    const props = { loading: false, hasMore: false, loadingOlder: false, isAdmin: false, currentUserId: 'u1', stoppedIds: new Set<string>(), targetId: null, onLoadOlder: vi.fn(), onReply: vi.fn(), onStop: vi.fn(), onPreview: vi.fn(), onLocate: vi.fn() }
    const view = render(<ChatMessageList {...props} messages={[trigger]} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /停止执行/ })).toBeInTheDocument())
    view.rerender(<ChatMessageList {...props} messages={[trigger, first]} />)
    await waitFor(() => expect(screen.queryByRole('button', { name: /停止执行/ })).not.toBeInTheDocument())
  })
})
