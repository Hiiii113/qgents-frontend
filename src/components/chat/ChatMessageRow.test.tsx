import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ChatMessageRow } from './ChatMessageRow'

afterEach(cleanup)
it('shows the fixed Qgent identity regardless of member profile data', () => {
  render(<ChatMessageRow item={{ id: 'm1', groupId: 'g1', type: 'TEXT', content: { text: '收到' }, senderId: '00000000-0000-0000-0000-000000000001', senderType: 'AGENT', senderName: '旧昵称', createdAt: '2026-10-04T00:00:00Z' }}
    sender={{ id: '00000000-0000-0000-0000-000000000001', memberType: 'AGENT', displayName: '小青', avatarUrl: 'https://example.com/avatar.png' }}
    canStop={false} stopping={false} onReply={vi.fn()} onStop={vi.fn()} onPreview={vi.fn()} onLocate={vi.fn()} />)
  expect(screen.getByRole('article', { name: 'Qgent的消息' })).toBeInTheDocument()
  expect(screen.getByRole('article').querySelector('.chat-message__meta strong')).toHaveTextContent('Qgent')
  expect(screen.getByRole('article').querySelector('.chat-message__avatar img')).toBeNull()
})
