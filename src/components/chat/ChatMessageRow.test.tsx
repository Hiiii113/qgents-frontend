import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ChatMessageRow } from './ChatMessageRow'

afterEach(cleanup)
it('shows the current Agent nickname and avatar in a message', () => {
  render(<ChatMessageRow item={{ id: 'm1', groupId: 'g1', type: 'TEXT', content: { text: '收到' }, senderId: 'a1', senderType: 'AGENT', senderName: '旧昵称', createdAt: '2026-10-04T00:00:00Z' }}
    sender={{ id: 'a1', memberType: 'AGENT', displayName: '小青', avatarUrl: 'https://example.com/avatar.png' }}
    canStop={false} stopping={false} onReply={vi.fn()} onStop={vi.fn()} onPreview={vi.fn()} onLocate={vi.fn()} />)
  expect(screen.getByRole('article', { name: '小青的消息' })).toBeInTheDocument()
  expect(screen.getByRole('img').querySelector('img') ?? screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/avatar.png')
})
