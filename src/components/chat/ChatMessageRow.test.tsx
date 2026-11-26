import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentRun } from '@/features/agent-runs'
import type { ChatMessage } from '@/types/chat'
import { AgentRunRow, ChatMessageRow } from './ChatMessageRow'
import { groupRunsByRoot } from './agentRunRows'

vi.mock('./LazyChatMarkdown', () => ({
  LazyChatMarkdown: ({ text }: { text: string }) => <div data-testid="markdown">{text}</div>,
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function message(id: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    groupId: 'g1',
    sequence: 1,
    type: 'TEXT',
    content: { text: `${id} 的正文` },
    senderType: 'USER',
    senderName: '陈同学',
    createdAt: '2026-10-01T00:00:00Z',
    ...extra,
  }
}

function reply(id: string, rootRunId: string, text = '最终回复'): ChatMessage {
  return message(id, {
    senderType: 'AGENT',
    senderName: '小助手',
    content: { text },
    clientMessageId: `qgent-reply:${rootRunId}`,
  })
}

function run(partial: Partial<AgentRun> & { runId: string; rootRunId?: string }): AgentRun {
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
const trigger = message('m1')

function rowProps(item: ChatMessage, extra: Partial<Parameters<typeof ChatMessageRow>[0]> = {}) {
  return {
    item,
    agentNames: new Map([['7', '小助手']]),
    trigger,
    canStop: true,
    onReply: noop,
    onPreview: noop,
    onLocate: noop,
    onStop: noop,
    ...extra,
  }
}

describe('ChatMessageRow 的 Agent 行', () => {
  it('运行卡渲染在 Agent 消息的正文上方，正文在独立的 .msg__content-row 里', () => {
    const view = render(
      <ChatMessageRow
        {...rowProps(reply('r1', '9001'))}
        runs={[run({ runId: '9001' })]}
      />,
    )
    const article = view.container.querySelector('.msg--agent')
    expect(article).not.toBeNull()
    expect(article).toHaveAttribute('aria-label', '小助手的消息')
    // Agent 头像与 Agent 标签都在这一行。
    expect(article?.querySelector('.avatar--agent')).not.toBeNull()
    expect(article).toHaveTextContent('Agent')

    const body = article?.querySelector('.msg__body')
    const card = body?.querySelector(':scope > .run')
    const contentRow = body?.querySelector(':scope > .msg__content-row')
    expect(card).not.toBeNull()
    expect(contentRow).not.toBeNull()
    // 卡片在正文上方，且正文不在运行卡的框里。
    expect(contentRow?.previousElementSibling).toBe(card)
    expect(contentRow?.closest('.run')).toBeNull()
    expect(contentRow).toHaveTextContent('最终回复')
    // 运行卡只剩状态与工具时间线。
    expect(view.container.querySelector('.run__live')).toBeNull()
  })

  it('用户触发消息行不挂任何运行卡', () => {
    const view = render(<ChatMessageRow {...rowProps(trigger)} runs={[run({ runId: '9001' })]} />)
    expect(view.container.querySelector('.run')).toBeNull()
    expect(view.container.querySelector('.msg--agent')).toBeNull()
  })

  it('停止按钮挂在根运行上，回调收到的是触发消息', () => {
    const onStop = vi.fn()
    render(
      <ChatMessageRow
        {...rowProps(reply('r1', '9001'), { onStop })}
        runs={[
          run({ runId: '9001' }),
          run({ runId: '9002', parentRunId: '9001', agentId: '8' }),
        ]}
      />,
    )
    const stop = screen.getAllByRole('button', { name: '停止' })
    // 子运行跟着根一起被叫停，不再给第二个按钮。
    expect(stop).toHaveLength(1)
    fireEvent.click(stop[0])
    expect(onStop).toHaveBeenCalledWith(trigger)
  })

  it('没有停止权限时不显示停止按钮', () => {
    render(
      <ChatMessageRow
        {...rowProps(reply('r1', '9001'), { canStop: false })}
        runs={[run({ runId: '9001' })]}
      />,
    )
    expect(screen.queryByRole('button', { name: '停止' })).toBeNull()
  })

  it('最终消息已入库时不再重复失败说明', () => {
    const failed = run({ runId: '9001', status: 'FAILED', result: '工具执行失败' })
    const view = render(<ChatMessageRow {...rowProps(reply('r1', '9001'))} runs={[failed]} />)
    expect(view.container.querySelector('.run--fail')).not.toBeNull()
    expect(view.container.querySelector('.run__note')).toBeNull()
  })
})

describe('AgentRunRow 进行中行', () => {
  const group = groupRunsByRoot([
    run({ runId: '9001', segments: [{ round: 1, text: '流式第一句' }] }),
  ]).get('9001')

  it('流式正文渲染在运行卡下方，与最终消息共用 .msg__content-row 容器', () => {
    render(
      <AgentRunRow
        group={group!}
        agentName="小助手"
        trigger={trigger}
        canStop
        onStop={noop}
      />,
    )
    const card = screen.getByRole('region', { name: '小助手 运行状态' })
    const content = screen.getByTestId('markdown')
    expect(content).toHaveTextContent('流式第一句')
    expect(content.closest('.msg__content-row')).not.toBeNull()
    expect(content.closest('.run')).toBeNull()
    // 卡片在前，正文紧跟在后。
    expect(card.nextElementSibling).toBe(content.closest('.msg__content-row'))
  })

  it('进行中行也是标准 Agent 消息行', () => {
    const view = render(
      <AgentRunRow group={group!} agentName="小助手" trigger={trigger} onStop={noop} />,
    )
    const article = view.container.querySelector('.msg--agent')
    expect(article).not.toBeNull()
    expect(article?.querySelector('.avatar--agent')).not.toBeNull()
    expect(article).toHaveTextContent('小助手')
    expect(article).toHaveTextContent('Agent')
    expect(article).toHaveAttribute('aria-label', '小助手正在回复')
  })

  it('失败且没有最终回复时把原因留在卡片上', () => {
    const failed = groupRunsByRoot([
      run({ runId: '9001', status: 'FAILED', result: '模型超时' }),
    ]).get('9001')
    const view = render(<AgentRunRow group={failed!} agentName="小助手" onStop={noop} />)
    expect(view.container.querySelector('.run__note')).toHaveTextContent('模型超时')
  })

  it('进行中行的停止按钮回调触发消息', () => {
    const onStop = vi.fn()
    render(
      <AgentRunRow
        group={group!}
        agentName="小助手"
        trigger={trigger}
        canStop
        onStop={onStop}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '停止' }))
    expect(onStop).toHaveBeenCalledWith(trigger)
  })
})
