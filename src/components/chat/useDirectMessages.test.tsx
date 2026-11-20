import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { directMessageApi } from '@/api/directMessage'
import type { ChatMessage } from '@/types/chat'
import { useDirectMessages } from './useChatMessages'

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
})
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

const message = (conversationId: string, id: string, text: string): ChatMessage => ({
  id,
  groupId: conversationId,
  sequence: 1,
  type: 'TEXT',
  content: { text },
  senderId: '2',
  senderType: 'USER',
  createdAt: '2026-10-01T00:00:00Z',
})
const emptyPage = { data: [], page: { hasMore: false, nextCursor: null } }

function stubPages(pages: Record<string, ChatMessage[]>) {
  vi.spyOn(directMessageApi, 'messages').mockImplementation(async (_projectId, conversationId) => ({
    data: pages[conversationId] ?? [],
    page: { hasMore: false, nextCursor: null },
  }))
  vi.spyOn(directMessageApi, 'incremental').mockResolvedValue(emptyPage)
  vi.spyOn(directMessageApi, 'read').mockResolvedValue({
    conversationId: '',
    lastReadSequenceNo: 1,
    unreadCount: 0,
  })
}

afterEach(() => {
  client.clear()
  vi.restoreAllMocks()
})

describe('private conversation messages', () => {
  it('replaces every message when switching conversations instead of appending to the previous one', async () => {
    stubPages({
      c1: [message('c1', 'm1', '第一条会话的消息')],
      c2: [message('c2', 'm2', '第二条会话的消息')],
    })
    const { result, rerender } = renderHook(
      ({ conversationId }: { conversationId: string }) => useDirectMessages('p1', conversationId),
      { wrapper, initialProps: { conversationId: 'c1' } },
    )
    await waitFor(() => expect(result.current.messages.map((item) => item.id)).toEqual(['m1']))

    rerender({ conversationId: 'c2' })
    // 切换的同一帧里，上一个会话的消息必须已经不在界面上。
    expect(result.current.messages.map((item) => item.id)).not.toContain('m1')
    await waitFor(() => expect(result.current.messages.map((item) => item.id)).toEqual(['m2']))
  })

  it('keeps conversations with the same id apart across projects', async () => {
    const pages = vi.spyOn(directMessageApi, 'messages').mockImplementation(async (projectId) => ({
      data: [
        message(
          'c1',
          projectId === 'p1' ? 'm1' : 'm2',
          projectId === 'p1' ? '项目一的消息' : '项目二的消息',
        ),
      ],
      page: { hasMore: false, nextCursor: null },
    }))
    vi.spyOn(directMessageApi, 'incremental').mockResolvedValue(emptyPage)
    vi.spyOn(directMessageApi, 'read').mockResolvedValue({
      conversationId: 'c1',
      lastReadSequenceNo: 1,
      unreadCount: 0,
    })
    const { result, rerender } = renderHook(
      ({ projectId }: { projectId: string }) => useDirectMessages(projectId, 'c1'),
      { wrapper, initialProps: { projectId: 'p1' } },
    )
    await waitFor(() => expect(result.current.messages.map((item) => item.id)).toEqual(['m1']))

    rerender({ projectId: 'p2' })
    expect(result.current.messages.map((item) => item.id)).not.toContain('m1')
    await waitFor(() => expect(result.current.messages.map((item) => item.id)).toEqual(['m2']))
    expect(pages).toHaveBeenLastCalledWith('p2', 'c1', undefined, expect.anything())
  })

  it('only syncs on message events that belong to the open conversation', async () => {
    stubPages({ c1: [message('c1', 'm1', '第一条')], c2: [message('c2', 'm2', '第二条')] })
    const incremental = vi.mocked(directMessageApi.incremental)
    const { result } = renderHook(() => useDirectMessages('p1', 'c1'), { wrapper })
    await waitFor(() => expect(result.current.messages).toHaveLength(1))
    const before = incremental.mock.calls.length

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('qgents:message-event', {
          detail: { projectId: 'p1', groupId: 'c2', messageId: 'm3', sequence: 2 },
        }),
      )
    })
    expect(incremental.mock.calls).toHaveLength(before)

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('qgents:message-event', {
          detail: { projectId: 'p1', groupId: 'c1', messageId: 'm3', sequence: 2 },
        }),
      )
    })
    expect(incremental.mock.calls.length).toBeGreaterThan(before)
    expect(incremental.mock.calls.every(([, conversationId]) => conversationId === 'c1')).toBe(true)
  })
})
