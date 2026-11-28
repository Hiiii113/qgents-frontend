import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentRun, AgentRunTool } from '@/features/agent-runs'
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

function tool(round: number, name: string, extra: Partial<AgentRunTool> = {}): AgentRunTool {
  return { toolCallId: name, tool: name, round, state: 'ok', input: null, output: null, ...extra }
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

  it('最终消息交接后仍可展开查看中间汇报，最终轮文本不重复出现在卡片里', () => {
    const view = render(
      <ChatMessageRow
        {...rowProps(reply('r1', '9001', '最终回复'))}
        runs={[run({
          runId: '9001',
          status: 'SUCCEEDED',
          round: 2,
          segments: [{ round: 1, text: '读取完成' }, { round: 2, text: '流式最终回复' }],
          tools: [tool(1, 'read_file')],
        })]}
      />,
    )
    const details = view.container.querySelector('.run__tools')
    expect(details).not.toHaveAttribute('open')
    fireEvent.click(screen.getByText('执行进度'))
    expect(details).toHaveAttribute('open')
    expect(view.container.querySelector('.run__progress')).toHaveTextContent('读取完成')
    expect(screen.queryByText('流式最终回复')).toBeNull()
    expect(screen.getByTestId('markdown')).toHaveTextContent('最终回复')
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

  it('按轮次交错展示明文汇报与工具，工具序号连续且同轮工具保持接收顺序', () => {
    const running = groupRunsByRoot([run({
      runId: '9001',
      round: 3,
      segments: [
        { round: 2, text: '验证修改' },
        { round: 3, text: '最终正文' },
        { round: 1, text: '**读取文件**\n' },
        { round: 1, text: '<script>保持明文</script>' },
        { round: 2, text: '  ' },
      ],
      tools: [
        tool(2, 'run_tests'),
        tool(1, 'read_file', { input: '{"path":"src/index.ts"}', output: '文件内容' }),
        tool(1, 'search_code'),
      ],
    })]).get('9001')!
    const view = render(<AgentRunRow group={running} agentName="小助手" onStop={noop} />)
    const timeline = view.container.querySelector('.run__timeline')!
    const items = [...timeline.children]
    expect(items).toHaveLength(5)
    expect(items[0].textContent).toBe('**读取文件**\n<script>保持明文</script>')
    expect(items[1]).toHaveTextContent('read_file')
    expect(items[2]).toHaveTextContent('search_code')
    expect(items[3].textContent).toBe('验证修改  ')
    expect(items[4]).toHaveTextContent('run_tests')
    expect([...timeline.querySelectorAll('.tool__step')].map((node) => node.textContent)).toEqual(['01', '02', '03'])
    expect(timeline.querySelector('strong, script')).toBeNull()
    expect(view.container.querySelector('.run__tools')).toHaveAttribute('open')
    expect(view.container.querySelector('.run__tools-count')).toHaveTextContent('3')
    expect(screen.getByTestId('markdown').textContent).toBe('最终正文')
    expect(screen.getAllByText('最终正文')).toHaveLength(1)
    const detail = timeline.querySelector('.tool__detail')
    fireEvent.click(screen.getByText('read_file'))
    expect(detail).toHaveAttribute('open')
    expect(detail).toHaveTextContent('{"path":"src/index.ts"}')
    expect(detail).toHaveTextContent('文件内容')
  })

  it('尚无工具调用时，旧轮中间汇报也显示在运行卡内', () => {
    const running = groupRunsByRoot([run({
      runId: '9001',
      round: 3,
      segments: [{ round: 2, text: '继续整理' }, { round: 1, text: '已理解需求' }],
    })]).get('9001')!
    const view = render(<AgentRunRow group={running} agentName="小助手" onStop={noop} />)
    expect([...view.container.querySelectorAll('.run__progress')].map((node) => node.textContent)).toEqual(['已理解需求', '继续整理'])
    expect(view.container.querySelector('.run__tools')).toHaveAttribute('open')
    expect(view.container.querySelector('.run__tools-count')).toBeNull()
    expect(view.container.querySelector('.tool')).toBeNull()
    expect(screen.queryByTestId('markdown')).toBeNull()
  })

  it('最新轮工具开始后将正文移入卡片，下一轮正文仍在卡片下方流式显示', () => {
    const initial = run({ runId: '9001', segments: [{ round: 1, text: '先读取代码' }] })
    const renderRow = (current: AgentRun) => (
      <AgentRunRow group={groupRunsByRoot([current]).get('9001')!} agentName="小助手" onStop={noop} />
    )
    const view = render(renderRow(initial))
    expect(screen.getByTestId('markdown')).toHaveTextContent('先读取代码')
    view.rerender(renderRow({ ...initial, tools: [tool(1, 'read_file', { state: 'running' })] }))
    expect(screen.queryByTestId('markdown')).toBeNull()
    expect(view.container.querySelector('.run__progress')).toHaveTextContent('先读取代码')
    expect(screen.getAllByText('先读取代码')).toHaveLength(1)
    view.rerender(renderRow({
      ...initial,
      round: 2,
      tools: [tool(1, 'read_file')],
      segments: [...initial.segments, { round: 2, text: '整理后的答案' }],
    }))
    expect(view.container.querySelector('.run__progress')).toHaveTextContent('先读取代码')
    expect(screen.getByTestId('markdown')).toHaveTextContent('整理后的答案')
  })

  it('无工具纯文本流式不创建进度时间线', () => {
    const view = render(<AgentRunRow group={group!} agentName="小助手" onStop={noop} />)
    expect(view.container.querySelector('.run__timeline')).toBeNull()
    expect(screen.getByTestId('markdown')).toHaveTextContent('流式第一句')
  })

  it('忽略空白汇报，保留没有对应文本的工具轮次', () => {
    const running = groupRunsByRoot([run({
      runId: '9001',
      round: 3,
      segments: [{ round: 1, text: '' }, { round: 2, text: ' \n\t' }, { round: 3, text: '' }],
      tools: [tool(2, 'search_code'), tool(1, 'read_file')],
    })]).get('9001')!
    const view = render(<AgentRunRow group={running} onStop={noop} />)
    expect(view.container.querySelector('.run__progress')).toBeNull()
    expect([...view.container.querySelectorAll('.tool__name')].map((node) => node.textContent)).toEqual(['read_file', 'search_code'])
    expect(screen.queryByTestId('markdown')).toBeNull()
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
