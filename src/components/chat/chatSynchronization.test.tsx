import { useChatMessages, chatKeys } from './useChatMessages'
import { chatApi } from '@/api/chat'
import type { ChatMessage } from '@/types/chat'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
const msg = (id: string, sequence: number): ChatMessage => ({ id, sequence, groupId: 'g1', type: 'TEXT', content: { text: id }, senderType: 'USER', createdAt: '2026-10-01T00:00:00Z' })
const page = (messages: ChatMessage[]) => ({ data: messages, page: { hasMore: false, nextCursor: null } })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe('chat synchronization', () => {
  it('uses the new chat cursor when switching groups, even when both histories are already cached', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(chatKeys.messages('p1', 'g1'), { pages: [page([msg('old', 80)])], pageParams: [undefined] })
    client.setQueryData(chatKeys.messages('p1', 'g2'), { pages: [page([{ ...msg('new', 2), groupId: 'g2' }])], pageParams: [undefined] })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const incremental = vi.spyOn(chatApi, 'incremental').mockResolvedValue(page([]))
    const hook = renderHook(({ groupId }) => useChatMessages('p1', groupId, false), { wrapper, initialProps: { groupId: 'g1' } })
    await waitFor(() => expect(incremental).toHaveBeenCalledWith('p1', 'g1', 80, expect.any(AbortSignal)))
    hook.rerender({ groupId: 'g2' })
    await waitFor(() => expect(incremental).toHaveBeenCalledWith('p1', 'g2', 2, expect.any(AbortSignal)))
    hook.unmount(); client.clear()
  })
  it('does not automatically mark new messages read while reading older history', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    vi.spyOn(chatApi, 'messages').mockResolvedValue(page([msg('m1', 1)]))
    vi.spyOn(chatApi, 'incremental').mockResolvedValue(page([]))
    const read = vi.spyOn(chatApi, 'read').mockResolvedValue({ lastReadSequenceNo: 1 })
    const hook = renderHook(({ reading }) => useChatMessages('p1', 'g1', reading), { wrapper, initialProps: { reading: false } })
    await waitFor(() => expect(hook.result.current.query.isSuccess).toBe(true))
    expect(read).not.toHaveBeenCalled()
    hook.rerender({ reading: true })
    await waitFor(() => expect(read).toHaveBeenCalledOnce())
    hook.unmount(); client.clear()
  })
  it('fills sequence gaps after sending and does not reload history on sends, reads or realtime signals', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const history = vi.spyOn(chatApi, 'messages').mockResolvedValue(page([msg('m1', 1)]))
    const incremental = vi.spyOn(chatApi, 'incremental').mockResolvedValue(page([]))
    vi.spyOn(chatApi, 'read').mockResolvedValue({ lastReadSequenceNo: 3 })
    vi.spyOn(chatApi, 'send').mockResolvedValue(msg('m3', 3))
    const hook = renderHook(() => useChatMessages('p1', 'g1'), { wrapper })
    await waitFor(() => expect(hook.result.current.messages).toHaveLength(1))
    await waitFor(() => expect(incremental).toHaveBeenCalled())
    await act(() => hook.result.current.send.mutateAsync({ type: 'TEXT', content: { text: 'm3' }, mentions: [], clientMessageId: 'c3' }))
    await act(() => hook.result.current.markRead())
    incremental.mockResolvedValue(page([msg('m2', 2), msg('m3', 3)]))
    act(() => window.dispatchEvent(new CustomEvent('qgents:message-event', { detail: { projectId: 'p1', groupId: 'g1' } })))
    await waitFor(() => expect(hook.result.current.messages.map(item => item.id)).toEqual(['m1', 'm2', 'm3']))
    expect(incremental).toHaveBeenLastCalledWith('p1', 'g1', 1, expect.any(AbortSignal))
    expect(history).toHaveBeenCalledOnce()
    expect(client.getQueryData(chatKeys.messages('p1', 'g1'))).toBeDefined()
    hook.unmount(); client.clear()
  })
})
