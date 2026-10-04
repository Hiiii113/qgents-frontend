import { describe, expect, it } from 'vitest'
import { mergeChatMessages } from './useChatMessages'
import type { ChatMessage } from '@/types/chat'
const msg = (id: string, sequence: number, text = id): ChatMessage => ({ id, sequence, groupId: 'g1', type: 'TEXT', content: { text }, senderType: 'USER', createdAt: '2026-10-01T00:00:00Z' })
describe('incremental history merge', () => {
  it('deduplicates repeated incoming messages and preserves pagination cursors', () => {
    const data = { pages: [{ data: [msg('m3', 3), msg('m2', 2)], page: { hasMore: true, nextCursor: '2' } }, { data: [msg('m1', 1)], page: { hasMore: false, nextCursor: null } }], pageParams: [undefined, '2'] }
    const merged = mergeChatMessages(data, [msg('m4', 4), msg('m4', 4), msg('m1', 1, 'updated')])
    expect(merged?.pages[0].data.map(item => item.id)).toEqual(['m4', 'm3', 'm2'])
    expect(merged?.pages[1].data[0].content).toEqual({ text: 'updated' })
    expect(merged?.pages.map(page => page.page)).toEqual(data.pages.map(page => page.page))
    expect(merged?.pageParams).toEqual([undefined, '2'])
    expect(data.pages[1].data[0].content).toEqual({ text: 'm1' })
  })
  it('keeps unchanged cache identity for empty incremental responses', () => {
    const data = { pages: [], pageParams: [] }
    expect(mergeChatMessages(data, [])).toBe(data)
    expect(mergeChatMessages(undefined, [msg('m1', 1)])).toBeUndefined()
  })
})
