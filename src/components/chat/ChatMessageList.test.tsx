import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatMessageList } from './ChatMessageList'
import type { ChatMessage } from '@/types/chat'
const agentId = '101'
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
describe('virtualized chat history', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 900,
      height: 600,
      top: 0,
      left: 0,
      right: 900,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(900)
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      value: vi.fn(),
      configurable: true,
      writable: true,
    })
  })
  it('mounts a bounded number of rows for a thousand-message history', async () => {
    const messages: ChatMessage[] = Array.from({ length: 1000 }, (_, index) => ({
      id: `m${index}`,
      sequence: index + 1,
      groupId: 'g1',
      type: 'TEXT',
      content: { text: `message ${index}` },
      senderType: 'USER',
      senderId: 'u1',
      senderName: '成员',
      createdAt: '2026-10-01T00:00:00Z',
    }))
    const view = render(
      <ChatMessageList
        messages={messages}
        loading={false}
        hasMore={false}
        loadingOlder={false}
        targetId={null}
        onLoadOlder={vi.fn()}
        onReply={vi.fn()}
        onPreview={vi.fn()}
        onLocate={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(view.container.querySelectorAll('.chat-message').length).toBeGreaterThan(0),
    )
    expect(view.container.querySelectorAll('.chat-message').length).toBeLessThan(40)
  })
  it('renders temporary run progress right after its trigger message', async () => {
    const trigger: ChatMessage = {
      id: 't1',
      sequence: 1,
      groupId: 'g1',
      type: 'TEXT',
      content: { text: '@Qgent 开始执行' },
      senderType: 'USER',
      senderId: 'u1',
      senderName: '成员',
      mentions: [{ type: 'AGENT', id: agentId }],
      createdAt: '2026-10-02T00:00:00Z',
    }
    const base = {
      loading: false,
      hasMore: false,
      loadingOlder: false,
      currentUserId: 'u1',
      targetId: null,
      onLoadOlder: vi.fn(),
      onReply: vi.fn(),
      onPreview: vi.fn(),
      onLocate: vi.fn(),
    }
    const progress = () => <div data-testid="run-progress">执行中</div>
    const view = render(
      <ChatMessageList
        {...base}
        messages={[trigger]}
        afterMessage={(item) => (item.id === 't1' ? progress() : null)}
      />,
    )
    await waitFor(() => expect(screen.getByTestId('run-progress')).toBeInTheDocument())
    expect(view.container.querySelectorAll('.chat-timeline__row--runs')).toHaveLength(1)
    // 终态且最终消息到达后 hook 会移除 run，临时行随之消失。
    view.rerender(<ChatMessageList {...base} messages={[trigger]} afterMessage={() => null} />)
    await waitFor(() => expect(screen.queryByTestId('run-progress')).not.toBeInTheDocument())
  })
  it('does not guess a stop action from a message that mentions an agent', async () => {
    const trigger: ChatMessage = {
      id: 'trigger',
      sequence: 1,
      groupId: 'g1',
      type: 'TEXT',
      content: { text: '一起分析' },
      senderId: 'u1',
      senderType: 'USER',
      mentions: [{ type: 'AGENT', id: agentId }],
      createdAt: '2026-10-02T00:00:00Z',
    }
    render(
      <ChatMessageList
        messages={[trigger]}
        loading={false}
        hasMore={false}
        loadingOlder={false}
        currentUserId="u1"
        targetId={null}
        onLoadOlder={vi.fn()}
        onReply={vi.fn()}
        onPreview={vi.fn()}
        onLocate={vi.fn()}
      />,
    )
    await waitFor(() => expect(screen.getByText('一起分析')).toBeInTheDocument())
    // 停止入口只在真实运行进度卡里出现，消息行不再根据「提及但没回复」猜测。
    expect(screen.queryByRole('button', { name: /停止/ })).not.toBeInTheDocument()
  })
})
