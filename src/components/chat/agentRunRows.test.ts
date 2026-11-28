import { describe, expect, it } from 'vitest'
import type { AgentRun, AgentRunTool } from '@/features/agent-runs'
import type { ChatMessage } from '@/types/chat'
import { buildChatEntries, groupRunsByRoot, streamingText } from './agentRunRows'

function run(partial: Partial<AgentRun> & { runId: string; rootRunId: string }): AgentRun {
  return {
    parentRunId: null,
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

function tool(round: number, state: AgentRunTool['state'] = 'ok'): AgentRunTool {
  return { toolCallId: `tool-${round}`, tool: 'read_file', round, state, input: null, output: null }
}

function textFor(partial: Partial<AgentRun>): string {
  const group = groupRunsByRoot([run({ runId: '9001', rootRunId: '9001', ...partial })]).get('9001')!
  return streamingText(group)
}

function message(id: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    groupId: 'g1',
    sequence: 1,
    type: 'TEXT',
    content: { text: id },
    senderType: 'USER',
    senderName: '陈同学',
    createdAt: '2026-10-01T00:00:00Z',
    ...extra,
  }
}

function reply(id: string, rootRunId: string): ChatMessage {
  return message(id, {
    senderType: 'AGENT',
    senderName: '小助手',
    clientMessageId: `qgent-reply:${rootRunId}`,
  })
}

describe('按根运行归组', () => {
  it('根运行排在最前，子运行按 runId 跟在后面', () => {
    const groups = groupRunsByRoot([
      run({ runId: '9003', rootRunId: '9001', parentRunId: '9001' }),
      run({ runId: '9001', rootRunId: '9001' }),
      run({ runId: '9002', rootRunId: '9001', parentRunId: '9001', agentId: '8' }),
    ])
    expect([...groups.keys()]).toEqual(['9001'])
    const group = groups.get('9001')
    expect(group?.runs.map((item) => item.runId)).toEqual(['9001', '9002', '9003'])
    expect(group?.triggerMessageId).toBe('m1')
  })

  it('同一触发消息 @ 多个 Agent 时按 rootRunId 各自成组，互不混在一起', () => {
    const groups = groupRunsByRoot([
      run({ runId: '9010', rootRunId: '9010', agentId: '8' }),
      run({ runId: '9001', rootRunId: '9001' }),
      run({ runId: '9002', rootRunId: '9001', parentRunId: '9001' }),
    ])
    expect([...groups.keys()]).toEqual(['9010', '9001'])
    expect(groups.get('9001')?.runs).toHaveLength(2)
    expect(groups.get('9010')?.runs).toHaveLength(1)
  })
})

describe('消息列表条目', () => {
  it('没有最终消息的根运行紧跟触发消息插入，键为 run:<rootRunId>', () => {
    const messages = [message('m1'), message('m2')]
    const entries = buildChatEntries(
      messages,
      groupRunsByRoot([
        run({ runId: '9001', rootRunId: '9001', triggerMessageId: 'm1' }),
        run({ runId: '9002', rootRunId: '9001', parentRunId: '9001', triggerMessageId: 'm1' }),
      ]),
    )
    expect(entries.map((entry) => entry.key)).toEqual(['m1', 'run:9001', 'm2'])
    const pending = entries[1]
    expect(pending.kind).toBe('run')
    if (pending.kind === 'run') expect(pending.group.runs.map((item) => item.runId)).toEqual([
      '9001',
      '9002',
    ])
  })

  it('多个 Agent 各自待在自己的触发消息后面', () => {
    const messages = [message('m1'), message('m2'), message('m3')]
    const entries = buildChatEntries(
      messages,
      groupRunsByRoot([
        run({ runId: '9010', rootRunId: '9010', triggerMessageId: 'm2', agentId: '8' }),
        run({ runId: '9001', rootRunId: '9001', triggerMessageId: 'm1' }),
      ]),
    )
    expect(entries.map((entry) => entry.key)).toEqual(['m1', 'run:9001', 'm2', 'run:9010', 'm3'])
  })

  it('同一触发消息下多个根运行按 rootRunId 稳定排序', () => {
    const entries = buildChatEntries(
      [message('m1')],
      groupRunsByRoot([
        run({ runId: '9010', rootRunId: '9010', triggerMessageId: 'm1', agentId: '8' }),
        run({ runId: '9001', rootRunId: '9001', triggerMessageId: 'm1' }),
      ]),
    )
    expect(entries.map((entry) => entry.key)).toEqual(['m1', 'run:9001', 'run:9010'])
  })

  it('最终消息入库后不再插入进行中行，避免同一根运行出现两遍', () => {
    const messages = [message('m1'), reply('r1', '9001')]
    const entries = buildChatEntries(
      messages,
      groupRunsByRoot([run({ runId: '9001', rootRunId: '9001', triggerMessageId: 'm1' })]),
    )
    expect(entries.map((entry) => entry.key)).toEqual(['m1', 'r1'])
    expect(entries.every((entry) => entry.kind === 'message')).toBe(true)
  })

  it('另一个根运行交接后，剩下的 Agent 仍然待在自己的触发消息后面', () => {
    const messages = [message('m1'), reply('r1', '9001'), message('m2')]
    const entries = buildChatEntries(
      messages,
      groupRunsByRoot([
        run({ runId: '9001', rootRunId: '9001', triggerMessageId: 'm1' }),
        run({ runId: '9010', rootRunId: '9010', triggerMessageId: 'm2', agentId: '8' }),
      ]),
    )
    expect(entries.map((entry) => entry.key)).toEqual(['m1', 'r1', 'm2', 'run:9010'])
  })

  it('触发消息不在当前消息列表里时不凭空插入进行中行', () => {
    const entries = buildChatEntries(
      [message('m1')],
      groupRunsByRoot([run({ runId: '9001', rootRunId: '9001', triggerMessageId: 'm0' })]),
    )
    expect(entries.map((entry) => entry.key)).toEqual(['m1'])
  })
})

describe('流式正文', () => {
  it('优先展示还在跑的运行的分段', () => {
    const group = groupRunsByRoot([
      run({
        runId: '9001',
        rootRunId: '9001',
        status: 'SUCCEEDED',
        segments: [{ round: 1, text: '根运行正文' }],
      }),
      run({
        runId: '9002',
        rootRunId: '9001',
        parentRunId: '9001',
        segments: [{ round: 1, text: '子 Agent 正文' }],
      }),
    ]).get('9001')
    expect(group && streamingText(group)).toBe('子 Agent 正文')
  })

  it('运行都结束后保留最后一段已收到的正文，最终消息到达前不闪空白', () => {
    const group = groupRunsByRoot([
      run({
        runId: '9001',
        rootRunId: '9001',
        status: 'SUCCEEDED',
        segments: [
          { round: 1, text: '第一段' },
          { round: 2, text: '第二段' },
        ],
      }),
    ]).get('9001')
    expect(group && streamingText(group)).toBe('第二段')
  })

  it('多轮文本只保留最后一轮，旧轮汇报和旧轮工具不影响最终正文', () => {
    expect(textFor({
      round: 3,
      segments: [
        { round: 2, text: '继续验证' },
        { round: 3, text: '最终' },
        { round: 1, text: '先读取文件' },
        { round: 3, text: '正文\n' },
      ],
      tools: [tool(2), tool(1)],
    })).toBe('最终正文\n')
  })

  it.each(['running', 'ok', 'failed', 'done'] as const)(
    '最后一轮已有 %s 工具调用时，不把该轮汇报当成最终正文',
    (state) => {
      expect(textFor({
        round: 2,
        segments: [{ round: 1, text: '先查资料' }, { round: 2, text: '再读文件' }],
        tools: [tool(2, state)],
      })).toBe('')
    },
  )

  it('新一轮还没有文本或工具时，旧轮文本不再作为最终正文', () => {
    expect(textFor({ round: 2, segments: [{ round: 1, text: '中间汇报' }] })).toBe('')
  })

  it('最后轮次也考虑文本与工具数据，不能只依赖 run.round', () => {
    expect(textFor({
      segments: [{ round: 1, text: '旧文本' }, { round: 3, text: '最新正文' }],
    })).toBe('最新正文')
    expect(textFor({
      segments: [{ round: 1, text: '旧文本' }],
      tools: [tool(3)],
    })).toBe('')
  })

  it('无工具纯文本流式保留同轮片段的顺序和原始空白', () => {
    expect(textFor({ segments: [
      { round: 1, text: '  正在' },
      { round: 1, text: '回答\n下一行' },
    ] })).toBe('  正在回答\n下一行')
  })

  it.each(['', '  \n\t'])('最后一轮只有空白 %j 时返回空串，不回退到旧轮文本', (text) => {
    expect(textFor({
      round: 2,
      segments: [{ round: 1, text: '中间汇报' }, { round: 2, text }],
    })).toBe('')
  })

  it('当前运行只有中间汇报时，不回退到已结束运行的正文', () => {
    const group = groupRunsByRoot([
      run({ runId: '9001', rootRunId: '9001', status: 'SUCCEEDED', segments: [{ round: 1, text: '旧正文' }] }),
      run({ runId: '9002', rootRunId: '9001', parentRunId: '9001', segments: [{ round: 1, text: '子运行汇报' }], tools: [tool(1)] }),
    ]).get('9001')!
    expect(streamingText(group)).toBe('')
  })

  it('全部结束后跳过只有工具汇报的运行，保留上一份可用最终正文', () => {
    const group = groupRunsByRoot([
      run({ runId: '9001', rootRunId: '9001', status: 'SUCCEEDED', segments: [{ round: 1, text: '最终正文' }] }),
      run({ runId: '9002', rootRunId: '9001', parentRunId: '9001', status: 'SUCCEEDED', segments: [{ round: 1, text: '工具汇报' }], tools: [tool(1)] }),
    ]).get('9001')!
    expect(streamingText(group)).toBe('最终正文')
  })

  it('没有任何正文时返回空串', () => {
    const group = groupRunsByRoot([run({ runId: '9001', rootRunId: '9001' })]).get('9001')
    expect(group && streamingText(group)).toBe('')
  })
})
