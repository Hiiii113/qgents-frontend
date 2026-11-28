import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentRun } from '@/features/agent-runs'
import type { ChatMember, ChatMessage } from '@/types/chat'
import { ChatMessageList } from './ChatMessageList'

// jsdom 没有真实滚动高度：虚拟列表按条目数全部渲染，测的是行内容与顺序。
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 120,
        end: (index + 1) * 120,
        size: 120,
      })),
    getTotalSize: () => count * 120,
    measureElement: () => undefined,
    scrollToIndex: () => undefined,
  }),
}))

vi.mock('./LazyChatMarkdown', () => ({
  LazyChatMarkdown: ({ text }: { text: string }) => <div data-testid="markdown">{text}</div>,
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const participants: ChatMember[] = [
  { id: '7', displayName: '小助手', memberType: 'AGENT' },
  { id: '8', displayName: '数据助手', memberType: 'AGENT' },
  { id: '2', displayName: '陈同学', memberType: 'USER' },
]

function message(id: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    groupId: 'g1',
    sequence: 1,
    type: 'TEXT',
    content: { text: `${id} 的正文` },
    senderId: '2',
    senderType: 'USER',
    senderName: '陈同学',
    createdAt: '2026-10-01T00:00:00Z',
    ...extra,
  }
}

function reply(id: string, rootRunId: string, text = '最终回复'): ChatMessage {
  return message(id, {
    senderType: 'AGENT',
    senderId: '7',
    senderName: '小助手',
    content: { text },
    clientMessageId: `qgent-reply:${rootRunId}`,
  })
}

function run(partial: Partial<AgentRun> & { runId: string }): AgentRun {
  return {
    parentRunId: null,
    rootRunId: partial.runId,
    projectId: 'p1',
    groupId: 'g1',
    agentId: '7',
    triggerMessageId: 'm1',
    status: 'RUNNING',
    round: 1,
    segments: [],
    tools: [],
    result: null,
    lastSeq: 0,
    revision: 1,
    createdAt: '2026-10-01T00:00:00Z',
    ...partial,
  }
}

const noop = () => undefined

type ListProps = Parameters<typeof ChatMessageList>[0]

const baseProps: ListProps = {
  messages: [],
  participants,
  runs: [],
  loading: false,
  hasMore: false,
  loadingOlder: false,
  targetId: null,
  onLoadOlder: async () => undefined,
  onReply: noop,
  onPreview: noop,
  onLocate: noop,
  onStop: noop,
}

function renderList(initial: Partial<ListProps> = {}) {
  const view = render(<ChatMessageList {...baseProps} {...initial} />)
  return {
    ...view,
    update: (next: Partial<ListProps>) =>
      view.rerender(<ChatMessageList {...baseProps} {...initial} {...next} />),
  }
}

function rowsOf(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('.chatlog__row')]
}

const trigger = message('m1', { content: { text: '帮我看看这个接口' } })

describe('工具调用与流式回复的落点', () => {
  it('运行卡与流式正文都在 Agent 行里，触发消息行只剩自己的正文', () => {
    const { container } = renderList({
      messages: [trigger],
      runs: [run({ runId: '9001', segments: [{ round: 1, text: '流式第一句' }] })],
    })
    const rows = rowsOf(container)
    expect(rows).toHaveLength(2)

    // 用户触发消息那一行不带任何运行卡。
    expect(rows[0].querySelector('#message-m1')).not.toBeNull()
    expect(rows[0].querySelector('.run')).toBeNull()
    expect(rows[0].querySelector('[aria-label$="正在回复"]')).toBeNull()

    // 进行中的 Agent 行：运行卡在上，流式正文在卡片下方、不在同一个框里。
    const live = rows[1].querySelector('.msg--agent')
    expect(live).not.toBeNull()
    expect(live).toHaveAttribute('aria-label', '小助手正在回复')
    expect(rows[1].querySelector('.run')).not.toBeNull()
    const content = rows[1].querySelector('.msg__content-row')
    expect(content).not.toBeNull()
    expect(content).toHaveTextContent('流式第一句')
    expect(content?.closest('.run')).toBeNull()
    expect(rows[1].querySelector('.run__live')).toBeNull()
    expect(rows[1].querySelector('.avatar--agent')).not.toBeNull()
  })

  it('多个 Agent 同时运行时各自待在自己的触发消息下方', () => {
    const { container } = renderList({
      messages: [message('m1'), message('m2')],
      runs: [
        run({ runId: '9001', triggerMessageId: 'm1' }),
        run({ runId: '9010', rootRunId: '9010', triggerMessageId: 'm2', agentId: '8' }),
      ],
    })
    const rows = rowsOf(container)
    expect(rows).toHaveLength(4)
    expect(rows[0].querySelector('#message-m1')).not.toBeNull()
    expect(rows[1].querySelector('.msg--agent')).toHaveAttribute('aria-label', '小助手正在回复')
    expect(rows[2].querySelector('#message-m2')).not.toBeNull()
    expect(rows[3].querySelector('.msg--agent')).toHaveAttribute(
      'aria-label',
      '数据助手正在回复',
    )
  })

  it('单 Agent / 私聊场景里进行中行就在列表末尾', () => {
    const { container } = renderList({
      messages: [message('m1'), message('m2')],
      runs: [run({ runId: '9001', triggerMessageId: 'm2' })],
    })
    const rows = rowsOf(container)
    expect(rows).toHaveLength(3)
    expect(rows[2].querySelector('.msg--agent')).not.toBeNull()
  })
})

describe('最终消息到达后的交接', () => {
  it('运行卡搬进最终 Agent 消息、进行中行消失，正文换成最终文本', () => {
    const runs = [run({ runId: '9001', segments: [{ round: 1, text: '流式第一句' }] })]
    const view = renderList({ messages: [trigger], runs })
    expect(rowsOf(view.container)).toHaveLength(2)

    view.update({ messages: [trigger, reply('r1', '9001')] })

    const rows = rowsOf(view.container)
    expect(rows).toHaveLength(2)
    // 不再有进行中的 Agent 行，也不会出现同一根运行的第二张卡。
    expect(view.container.querySelectorAll('[aria-label$="正在回复"]')).toHaveLength(0)
    expect(view.container.querySelectorAll('.run')).toHaveLength(1)

    expect(rows[0].querySelector('.run')).toBeNull()
    const finalRow = rows[1].querySelector('#message-r1')
    expect(finalRow).toHaveAttribute('aria-label', '小助手的消息')
    expect(finalRow?.querySelector('.run')).not.toBeNull()
    const content = finalRow?.querySelector('.msg__content-row')
    expect(content).toHaveTextContent('最终回复')
    expect(content?.previousElementSibling?.classList.contains('run')).toBe(true)
  })

  it('一个 Agent 交接不影响另一个 Agent 的进行中行', () => {
    const { container } = renderList({
      messages: [message('m1'), reply('r1', '9001'), message('m2')],
      runs: [
        run({ runId: '9001', triggerMessageId: 'm1' }),
        run({ runId: '9010', rootRunId: '9010', triggerMessageId: 'm2', agentId: '8' }),
      ],
    })
    const rows = rowsOf(container)
    expect(rows).toHaveLength(4)
    // m1 → 已交接的 r1（带运行卡） → m2 → 仍在跑的 9010。
    expect(rows[0].querySelector('#message-m1')).not.toBeNull()
    expect(rows[0].querySelector('.run')).toBeNull()
    expect(rows[1].querySelector('#message-r1')).toHaveAttribute('aria-label', '小助手的消息')
    expect(rows[1].querySelector('.run')).not.toBeNull()
    expect(rows[2].querySelector('#message-m2')).not.toBeNull()
    expect(rows[2].querySelector('.run')).toBeNull()
    expect(rows[3].querySelector('.msg--agent')).toHaveAttribute(
      'aria-label',
      '数据助手正在回复',
    )
  })
})

describe('停止执行', () => {
  it('最终消息行的停止按钮回传触发消息，而不是 Agent 自己的消息', () => {
    const onStop = vi.fn()
    const { container } = renderList({
      messages: [trigger, reply('r1', '9001')],
      runs: [run({ runId: '9001' })],
      canStop: () => true,
      onStop,
    })
    fireEvent.click(screen.getByRole('button', { name: '停止' }))
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onStop.mock.calls[0][0].id).toBe('m1')
    expect(container.querySelector('#message-r1 .run')).not.toBeNull()
  })

  it('canStop(触发消息) 为假时进行中行也不显示停止按钮', () => {
    renderList({
      messages: [message('m1')],
      runs: [run({ runId: '9001' })],
      canStop: () => false,
    })
    expect(screen.queryByRole('button', { name: '停止' })).toBeNull()
  })

  it('正在停止时按钮显示停止中', () => {
    renderList({
      messages: [message('m1')],
      runs: [run({ runId: '9001' })],
      canStop: () => true,
      stoppingMessageId: 'm1',
    })
    expect(screen.getByRole('button', { name: '停止中' })).toBeDisabled()
  })
})
