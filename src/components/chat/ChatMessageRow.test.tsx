import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ChatMessageRow } from './ChatMessageRow'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('shows the fixed Qgent identity regardless of member profile data', () => {
  render(<ChatMessageRow item={{ id: 'm1', groupId: 'g1', type: 'TEXT', content: { text: '收到' }, senderId: '00000000-0000-0000-0000-000000000001', senderType: 'AGENT', senderName: '旧昵称', createdAt: '2026-10-04T00:00:00Z' }}
    sender={{ id: '00000000-0000-0000-0000-000000000001', memberType: 'AGENT', displayName: '小青', avatarUrl: 'https://example.com/avatar.png' }}
    canStop={false} stopping={false} onReply={vi.fn()} onStop={vi.fn()} onPreview={vi.fn()} onLocate={vi.fn()} />)
  expect(screen.getByRole('article', { name: 'Qgent的消息' })).toBeInTheDocument()
  expect(screen.getByRole('article').querySelector('.chat-message__meta strong')).toHaveTextContent('Qgent')
  expect(screen.getByRole('article').querySelector('.chat-message__avatar img')).toBeNull()
})

it('builds image URLs from the current project and attachment id', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(new Blob(['x'], { type: 'image/png' }), { status: 200 }),
  )
  render(<ChatMessageRow projectId="p1"
    item={{ id: 'm2', groupId: 'g1', type: 'IMAGE', content: { attachmentId: 'a1', url: 'https://evil.example/image.png' }, senderId: 'u1', senderType: 'USER', senderName: '成员', createdAt: '2026-10-04T00:00:00Z' }}
    canStop={false} stopping={false} onReply={vi.fn()} onStop={vi.fn()} onPreview={vi.fn()} onLocate={vi.fn()} />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/projects/p1/attachments/a1/content')
  expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('evil.example')
})
