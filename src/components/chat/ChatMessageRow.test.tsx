import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ChatMessageRow } from './ChatMessageRow'
import type { ChatMember, ChatMessage } from '@/types/chat'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const agentMember: ChatMember = {
  id: '102',
  memberType: 'AGENT',
  displayName: '前端助手',
  avatarUrl: 'https://example.com/avatar.png',
}

function humanMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm2',
    groupId: 'g1',
    type: 'TEXT',
    content: { text: '普通讨论' },
    senderId: 'u1',
    senderType: 'USER',
    senderName: '张工',
    createdAt: '2026-10-04T00:00:00Z',
    ...overrides,
  }
}

function renderRow(item: ChatMessage, props: Partial<Parameters<typeof ChatMessageRow>[0]> = {}) {
  return render(
    <ChatMessageRow
      item={item}
      onReply={vi.fn()}
      onPreview={vi.fn()}
      onLocate={vi.fn()}
      {...props}
    />,
  )
}

it('does not treat an agent as the current user when their numeric ids collide', () => {
  const view = renderRow(
    {
      id: 'm9',
      groupId: 'g1',
      type: 'TEXT',
      content: { text: '执行完成' },
      senderId: '1',
      senderType: 'AGENT',
      senderName: 'Qgent',
      createdAt: '2026-10-04T00:00:00Z',
    },
    { currentUserId: '1' },
  )
  const article = view.container.querySelector('.chat-message')
  expect(article?.className).toContain('chat-message--agent')
  expect(article?.className).not.toContain('chat-message--own')
})

it('shows each agent with its own member profile and marks it as an agent', () => {
  renderRow(
    {
      id: 'm1',
      groupId: 'g1',
      type: 'TEXT',
      content: { text: '收到' },
      senderId: '102',
      senderType: 'AGENT',
      senderName: '旧昵称',
      createdAt: '2026-10-04T00:00:00Z',
    },
    { sender: agentMember },
  )
  expect(screen.getByRole('article', { name: '前端助手的消息' })).toBeInTheDocument()
  expect(screen.getByRole('article').querySelector('.chat-message__head strong')).toHaveTextContent(
    '前端助手',
  )
  expect(screen.getByRole('article').querySelector('.chat-message__head')).toHaveTextContent(
    'Agent',
  )
  expect(screen.getByRole('article').querySelector('.chat-message__avatar img')).toHaveAttribute(
    'src',
    'https://example.com/avatar.png',
  )
})

it('falls back to the sender name the backend returns for an agent', () => {
  renderRow({
    id: 'm3',
    groupId: 'g1',
    type: 'TEXT',
    content: { text: '收到' },
    senderId: '103',
    senderType: 'AGENT',
    senderName: '后端联调助手',
    createdAt: '2026-10-04T00:00:00Z',
  })
  expect(screen.getByRole('article', { name: '后端联调助手的消息' })).toBeInTheDocument()
})

it('builds image URLs from the current project and attachment id', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(new Blob(['x'], { type: 'image/png' }), { status: 200 }))
  renderRow(
    {
      id: 'm4',
      groupId: 'g1',
      type: 'IMAGE',
      content: { attachmentId: 'a1', url: 'https://evil.example/image.png' },
      senderId: 'u1',
      senderType: 'USER',
      senderName: '成员',
      createdAt: '2026-10-04T00:00:00Z',
    },
    { projectId: 'p1' },
  )
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/projects/p1/attachments/a1/content')
  expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('evil.example')
})

it('renders agent text as markdown but keeps human text plain', () => {
  const markdown = renderRow(
    {
      id: 'm5',
      groupId: 'g1',
      type: 'TEXT',
      content: {
        text: [
          '## 结论',
          '',
          '- 头像固定顶部',
          '- 代码块自己横滚',
          '',
          '| 方案 | 结论 |',
          '| --- | --- |',
          '| 气泡 | 否决 |',
        ].join('\n'),
      },
      senderId: '102',
      senderType: 'AGENT',
      createdAt: '2026-10-04T00:00:00Z',
    },
    { sender: agentMember },
  )
  expect(screen.getByRole('heading', { name: '结论' })).toBeInTheDocument()
  expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0)
  expect(markdown.container.querySelector('.chat-md__table')).not.toBeNull()
  markdown.unmount()

  const human = renderRow(
    humanMessage({ content: { text: '## 这不是标题\n保留换行与星号 **原样**' } }),
  )
  expect(human.container.querySelector('.chat-md')).toBeNull()
  expect(screen.queryByRole('heading')).toBeNull()
  expect(human.container.querySelector('.chat-message__text')).toHaveTextContent(
    '## 这不是标题 保留换行与星号 **原样**',
  )
})

it('opens the mention menu on right click and only mentions after choosing it', async () => {
  const onMention = vi.fn()
  renderRow(humanMessage(), {
    sender: { id: 'u1', memberType: 'USER', displayName: '张工' },
    onMention,
  })
  const trigger = screen.getByRole('button', { name: '提及 张工' })
  expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  fireEvent.contextMenu(trigger)
  const item = await screen.findByRole('menuitem', { name: '@张工' })
  // 右键只弹菜单，不直接改动草稿/触发提及。
  expect(onMention).not.toHaveBeenCalled()
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(item)
  expect(onMention).toHaveBeenCalledOnce()
  expect(onMention).toHaveBeenCalledWith({ id: 'u1', memberType: 'USER', displayName: '张工' })
})

it('supports keyboard opening, arrow selection and Escape', async () => {
  const onMention = vi.fn()
  renderRow(humanMessage(), {
    sender: { id: 'u1', memberType: 'USER', displayName: '张工' },
    onMention,
  })
  const trigger = screen.getByRole('button', { name: '提及 张工' })
  fireEvent.click(trigger)
  await screen.findByRole('menuitem', { name: '@张工' })
  // antd Dropdown 的 autoFocus：打开后焦点已进入菜单项。
  await waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('menuitem'))
  expect(onMention).not.toHaveBeenCalled()
  fireEvent.keyDown(document.activeElement as Element, { key: 'Enter', which: 13, keyCode: 13 })
  expect(onMention).toHaveBeenCalledOnce()

  cleanup()
  renderRow(humanMessage(), {
    sender: { id: 'u1', memberType: 'USER', displayName: '张工' },
    onMention,
  })
  const reopened = screen.getByRole('button', { name: '提及 张工' })
  fireEvent.click(reopened)
  await screen.findByRole('menuitem', { name: '@张工' })
  fireEvent.keyDown(window, { key: 'Escape', keyCode: 27, which: 27 })
  await waitFor(() => expect(reopened).toHaveAttribute('aria-expanded', 'false'))
})

it('leaves the stop action to the run progress card', () => {
  // 只在消息里 @ 了 Agent 不代表它还在跑：行内不做猜测式停止，避免重启后永久假停止。
  const view = renderRow(humanMessage({ mentions: [{ type: 'AGENT', id: '102' }] }), {
    sender: { id: 'u1', memberType: 'USER', displayName: '张工' },
  })
  expect(view.container.querySelector('.chat-message--stoppable')).toBeNull()
  expect(screen.queryByRole('button', { name: /停止/ })).not.toBeInTheDocument()
})

it('offers no mention menu for own messages or senders outside the group', () => {
  // 自己不发自己的消息头像，也不需要占位格（网格退化成单列）。
  const own = renderRow(humanMessage(), {
    sender: { id: 'u1', memberType: 'USER', displayName: '张工' },
    currentUserId: 'u1',
    onMention: vi.fn(),
  })
  expect(own.container.querySelector('.chat-message__avatar-hit')).toBeNull()
  expect(own.container.querySelector('.chat-message__avatar-static')).toBeNull()
  expect(own.container.querySelector('.chat-message__avatar-placeholder')).toBeNull()
  own.unmount()

  // 历史发送者不在当前参与者列表里：头像不可交互，右键也不会弹菜单。
  const stranger = renderRow(humanMessage({ senderId: 'gone-user', senderName: '离群成员' }), {
    onMention: vi.fn(),
  })
  const avatar = stranger.container.querySelector('.chat-message__avatar-static')
  expect(avatar).not.toBeNull()
  expect(stranger.container.querySelector('.chat-message__avatar-hit')).toBeNull()
  fireEvent.contextMenu(avatar as Element)
  expect(screen.queryByRole('menuitem')).toBeNull()
})
