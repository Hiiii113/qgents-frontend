import { describe, expect, it } from 'vitest'
import {
  agentRunsReducer,
  initialAgentRunsState,
  listAgentRuns,
  parseAgentRunEvent,
  parseAgentRunSnapshots,
  type AgentRunsState,
} from './agentRunState'

const identity = { projectId: 'p1', groupId: 'g1', agentId: '7', triggerMessageId: '8801' }

type Extra = Record<string, unknown>

function root(runId: string, extra: Extra = {}) {
  return {
    runId,
    parentRunId: null,
    rootRunId: runId,
    ...identity,
    status: 'RUNNING',
    round: 1,
    ...extra,
  }
}

function snapshot(runId: string, extra: Extra = {}) {
  return {
    ...root(runId),
    revision: 1,
    seq: 0,
    segments: [],
    tools: [],
    result: null,
    createdAt: '2026-06-20T03:01:02.123Z',
    finishedAt: null,
    ...extra,
  }
}

function delta(runId: string, revision: number, seq: number, text: string, extra: Extra = {}) {
  return { ...root(runId), revision, seq, text, ...extra }
}

function stream(state: AgentRunsState, eventName: string, data: unknown): AgentRunsState {
  const event = parseAgentRunEvent(eventName, JSON.stringify(data))
  if (!event) throw new Error(`event did not parse: ${eventName}`)
  return agentRunsReducer(state, { type: 'stream', event })
}

function snapshots(state: AgentRunsState, list: unknown[]): AgentRunsState {
  return agentRunsReducer(state, { type: 'snapshots', snapshots: parseAgentRunSnapshots(list) })
}

function withVisibleTriggers(...ids: string[]): AgentRunsState {
  return agentRunsReducer(initialAgentRunsState(), { type: 'messages', triggerMessageIds: ids })
}

function textOf(state: AgentRunsState, runId: string): string {
  return (state.runs[runId]?.segments ?? []).map((segment) => segment.text).join('|')
}

describe('agent-run 增量与快照合并', () => {
  it('同一触发消息的两个运行各自累加正文，互不覆盖', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [snapshot('101'), snapshot('102')])
    state = stream(state, 'agent-run.delta', delta('101', 2, 1, '第一个'))
    state = stream(state, 'agent-run.delta', delta('102', 2, 1, '第二个'))

    expect(textOf(state, '101')).toBe('第一个')
    expect(textOf(state, '102')).toBe('第二个')
    expect(state.runs['101'].triggerMessageId).toBe(state.runs['102'].triggerMessageId)
  })

  it('重复与过期 seq 丢弃，不重复拼接正文', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [snapshot('101')])
    state = stream(state, 'agent-run.delta', delta('101', 2, 1, 'A'))
    state = stream(state, 'agent-run.delta', delta('101', 3, 2, 'B'))
    // 服务端重新投递：revision 更新但 seq 未前进
    state = stream(state, 'agent-run.delta', delta('101', 4, 2, 'B'))
    state = stream(state, 'agent-run.delta', delta('101', 5, 1, 'A'))

    expect(textOf(state, '101')).toBe('AB')
    expect(state.runs['101'].lastSeq).toBe(2)
    expect(state.resyncToken).toBe(0)
  })

  it('seq 跳号时不拼接，交给快照替换后继续接收', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [snapshot('101')])
    state = stream(state, 'agent-run.delta', delta('101', 2, 1, 'A'))
    state = stream(state, 'agent-run.delta', delta('101', 3, 4, 'D'))

    expect(textOf(state, '101')).toBe('A')
    expect(state.runs['101'].lastSeq).toBe(1)
    expect(state.resyncToken).toBe(1)

    state = stream(state, 'agent-run.snapshot', {
      run: snapshot('101', { revision: 4, seq: 4, segments: [{ round: 1, text: 'ABCD' }] }),
    })
    expect(textOf(state, '101')).toBe('ABCD')
    expect(state.runs['101'].lastSeq).toBe(4)

    state = stream(state, 'agent-run.delta', delta('101', 5, 5, 'E'))
    expect(textOf(state, '101')).toBe('ABCDE')
  })

  it('seq 更旧但 revision 更新的快照只合并状态，不覆盖已收到的正文', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [snapshot('101', { seq: 2 })])
    state = stream(state, 'agent-run.delta', delta('101', 2, 3, '新内容'))
    state = stream(state, 'agent-run.snapshot', {
      run: snapshot('101', {
        revision: 3,
        seq: 2,
        round: 2,
        segments: [{ round: 1, text: '旧快照' }],
      }),
    })

    expect(textOf(state, '101')).toBe('新内容')
    expect(state.runs['101'].lastSeq).toBe(3)
    expect(state.runs['101'].round).toBe(2)
    expect(state.runs['101'].revision).toBe(3)
  })

  it('每轮一段：round 变化后新段追加，此前正文保留', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [snapshot('101')])
    state = stream(state, 'agent-run.delta', delta('101', 2, 1, '第一轮'))
    state = stream(state, 'agent-run.updated', root('101', { revision: 3, round: 2 }))
    state = stream(state, 'agent-run.delta', delta('101', 4, 2, '第二轮', { round: 2 }))

    expect(state.runs['101'].segments).toEqual([
      { round: 1, text: '第一轮' },
      { round: 2, text: '第二轮' },
    ])
    expect(state.runs['101'].round).toBe(2)
  })
})

describe('revision 防旧状态 / 终态恢复', () => {
  it('迟到的初始 REST 快照（round 更低、revision 更低）不复活已完成 root', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [snapshot('101')])
    state = stream(state, 'agent-run.updated', root('101', { revision: 2, status: 'SUCCEEDED' }))
    state = stream(state, 'agent-run.snapshot', {
      run: snapshot('101', { revision: 0, round: 0, status: 'RUNNING' }),
    })
    state = stream(state, 'agent-run.updated', root('101', { revision: 1, status: 'RUNNING' }))

    expect(state.runs['101'].status).toBe('SUCCEEDED')
    expect(state.runs['101'].revision).toBe(2)
  })

  it('断线期间 root 结束：revision=0 的终态快照仍收尾，保留正文并丢掉未完成工具', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [snapshot('101')])
    state = stream(state, 'agent-run.delta', delta('101', 2, 1, '断线前正文'))
    state = stream(state, 'agent-run.tool', {
      ...root('101'),
      revision: 3,
      phase: 'started',
      toolCallId: 'call_a',
      tool: 'run_command',
      ok: null,
    })

    state = stream(state, 'agent-run.snapshot', {
      run: snapshot('101', {
        revision: 0,
        round: 0,
        status: 'FAILED',
        result: '服务重启，运行已中断',
      }),
    })

    expect(state.runs['101'].status).toBe('FAILED')
    expect(state.runs['101'].result).toBe('服务重启，运行已中断')
    expect(textOf(state, '101')).toBe('断线前正文')
    expect(state.runs['101'].tools).toEqual([])
  })

  it('root 终态的 revision=0 事件同样接受，RUNNING 不能借此复活', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [snapshot('101', { revision: 5 })])
    state = stream(state, 'agent-run.updated', root('101', { revision: 0, status: 'FAILED' }))
    expect(state.runs['101'].status).toBe('FAILED')

    state = stream(
      state,
      'agent-run.updated',
      root('101', { revision: 6, status: 'RUNNING', round: 3 }),
    )
    expect(state.runs['101'].status).toBe('FAILED')
  })

  it('child 续接后，旧的 child 终态快照（revision 更小）不覆盖新的 RUNNING', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [
      snapshot('101'),
      snapshot('201', { parentRunId: '101', rootRunId: '101' }),
    ])
    const childScope = { parentRunId: '101', rootRunId: '101' }
    state = stream(state, 'agent-run.delta', delta('201', 2, 1, '上一段', childScope))
    state = stream(
      state,
      'agent-run.updated',
      root('201', { ...childScope, revision: 3, status: 'SUCCEEDED' }),
    )
    state = stream(
      state,
      'agent-run.updated',
      root('201', { ...childScope, revision: 4, status: 'RUNNING', round: 2 }),
    )
    state = stream(
      state,
      'agent-run.delta',
      delta('201', 5, 2, '续接', { ...childScope, round: 2 }),
    )

    state = stream(state, 'agent-run.snapshot', {
      run: snapshot('201', {
        ...childScope,
        revision: 1,
        status: 'SUCCEEDED',
        seq: 1,
        segments: [{ round: 1, text: '上一段' }],
      }),
    })
    expect(state.runs['201'].status).toBe('RUNNING')
    expect(textOf(state, '201')).toBe('续接')
  })

  it('root 终态不被更高 round 复活，只有 child 能以更高 round 续接并清空旧段', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [snapshot('101')])
    state = stream(state, 'agent-run.updated', root('101', { revision: 2, status: 'FAILED' }))
    state = stream(
      state,
      'agent-run.updated',
      root('101', { revision: 3, status: 'RUNNING', round: 2 }),
    )
    expect(state.runs['101'].status).toBe('FAILED')

    state = snapshots(state, [snapshot('201', { parentRunId: '101', rootRunId: '101' })])
    state = stream(
      state,
      'agent-run.delta',
      delta('201', 2, 1, '上一段', { parentRunId: '101', rootRunId: '101' }),
    )
    state = stream(
      state,
      'agent-run.updated',
      root('201', { parentRunId: '101', rootRunId: '101', revision: 3, status: 'SUCCEEDED' }),
    )
    state = stream(
      state,
      'agent-run.updated',
      root('201', {
        parentRunId: '101',
        rootRunId: '101',
        revision: 4,
        status: 'RUNNING',
        round: 2,
      }),
    )
    expect(state.runs['201'].status).toBe('RUNNING')
    expect(state.runs['201'].round).toBe(2)
    expect(state.runs['201'].segments).toEqual([])
    expect(state.runs['201'].lastSeq).toBe(1)

    state = stream(
      state,
      'agent-run.delta',
      delta('201', 5, 2, '续接', { parentRunId: '101', rootRunId: '101', round: 2 }),
    )
    expect(textOf(state, '201')).toBe('续接')
  })

  it('终态粘滞：终态后的 delta 与同轮 RUNNING 都不生效', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [snapshot('101')])
    state = stream(state, 'agent-run.delta', delta('101', 2, 1, '已完成的内容'))
    state = stream(state, 'agent-run.updated', root('101', { revision: 3, status: 'CANCELLED' }))
    state = stream(
      state,
      'agent-run.updated',
      root('101', { revision: 4, status: 'RUNNING', round: 1 }),
    )
    state = stream(state, 'agent-run.delta', delta('101', 5, 2, '迟到'))

    expect(state.runs['101'].status).toBe('CANCELLED')
    expect(textOf(state, '101')).toBe('已完成的内容')
  })
})

describe('工具阶段', () => {
  it('同名并行工具按 toolCallId 区分，完成状态各自独立', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [snapshot('101')])
    state = stream(state, 'agent-run.tool', {
      ...root('101'),
      revision: 2,
      phase: 'started',
      toolCallId: 'call_a',
      tool: 'run_command',
      ok: null,
    })
    state = stream(state, 'agent-run.tool', {
      ...root('101'),
      revision: 3,
      phase: 'started',
      toolCallId: 'call_b',
      tool: 'run_command',
      ok: null,
    })
    // 同一 toolCallId 的重复 started 不新增行
    state = stream(state, 'agent-run.tool', {
      ...root('101'),
      revision: 4,
      phase: 'started',
      toolCallId: 'call_a',
      tool: 'run_command',
      ok: null,
    })

    expect(state.runs['101'].tools).toEqual([
      { toolCallId: 'call_a', tool: 'run_command', round: 1, state: 'running' },
      { toolCallId: 'call_b', tool: 'run_command', round: 1, state: 'running' },
    ])

    state = stream(state, 'agent-run.tool', {
      ...root('101'),
      revision: 5,
      phase: 'finished',
      toolCallId: 'call_b',
      tool: 'run_command',
      ok: false,
    })
    expect(state.runs['101'].tools).toEqual([
      { toolCallId: 'call_a', tool: 'run_command', round: 1, state: 'running' },
      { toolCallId: 'call_b', tool: 'run_command', round: 1, state: 'failed' },
    ])
  })

  it('工具结束但结果未知（ok=null）显示中性结束，不标成功', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [snapshot('101')])
    state = stream(state, 'agent-run.tool', {
      ...root('101'),
      revision: 2,
      phase: 'started',
      toolCallId: 'call_a',
      tool: 'run_command',
      ok: null,
    })
    expect(state.runs['101'].tools[0].state).toBe('running')

    state = stream(state, 'agent-run.tool', {
      ...root('101'),
      revision: 3,
      phase: 'finished',
      toolCallId: 'call_a',
      tool: 'run_command',
      ok: null,
    })
    expect(state.runs['101'].tools[0].state).toBe('done')
  })

  it('工具完成后迟到的同 seq 旧快照（revision 更小）不把工具重置为执行中', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [snapshot('101')])
    state = stream(state, 'agent-run.tool', {
      ...root('101'),
      revision: 2,
      phase: 'started',
      toolCallId: 'call_a',
      tool: 'run_command',
      ok: null,
    })
    state = stream(state, 'agent-run.tool', {
      ...root('101'),
      revision: 3,
      phase: 'finished',
      toolCallId: 'call_a',
      tool: 'run_command',
      ok: true,
    })
    expect(state.runs['101'].tools[0].state).toBe('ok')

    // 旧 REST 快照：seq 相同、revision 落后，必须整条丢弃
    state = stream(state, 'agent-run.snapshot', {
      run: snapshot('101', {
        revision: 2,
        seq: 0,
        tools: [{ toolCallId: 'call_a', tool: 'run_command', round: 1, state: 'running' }],
      }),
    })
    expect(state.runs['101'].tools[0].state).toBe('ok')
    expect(state.runs['101'].revision).toBe(3)

    state = stream(state, 'agent-run.delta', delta('101', 4, 1, '后续正文'))
    expect(textOf(state, '101')).toBe('后续正文')
  })

  it('快照 tools 整体替换，终态清掉仍在执行的工具行', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [snapshot('101')])
    state = stream(state, 'agent-run.tool', {
      ...root('101'),
      revision: 2,
      phase: 'started',
      toolCallId: 'call_a',
      tool: 'read_attachment',
      ok: null,
    })
    state = stream(state, 'agent-run.snapshot', {
      run: snapshot('101', {
        revision: 3,
        tools: [{ toolCallId: 'call_c', tool: 'run_command', round: 2, state: 'running' }],
        round: 2,
      }),
    })
    expect(state.runs['101'].tools).toEqual([
      { toolCallId: 'call_c', tool: 'run_command', round: 2, state: 'running' },
    ])

    state = stream(
      state,
      'agent-run.updated',
      root('101', { revision: 4, status: 'SUCCEEDED', round: 2 }),
    )
    expect(state.runs['101'].tools).toEqual([])
  })
})

describe('终态、最终消息与刷新中断', () => {
  it('最终消息封存对应根运行与子运行：保留运行卡数据，后续事件不复活', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [
      snapshot('101'),
      snapshot('102', { parentRunId: '101', rootRunId: '101' }),
      snapshot('201'),
    ])

    state = agentRunsReducer(state, { type: 'finalize', rootIds: ['101'] })
    expect(Object.keys(state.runs)).toEqual(['101', '102', '201'])

    state = stream(state, 'agent-run.delta', delta('101', 9, 1, '迟到增量'))
    state = stream(state, 'agent-run.snapshot', { run: snapshot('101', { revision: 9 }) })
    expect(Object.keys(state.runs)).toEqual(['101', '102', '201'])
  })

  it('最终消息先到、快照后到：首次插入仍保留运行卡', () => {
    let state = withVisibleTriggers('8801')
    state = agentRunsReducer(state, { type: 'finalize', rootIds: ['101'] })
    expect(state.runs['101']).toBeUndefined()

    state = stream(state, 'agent-run.snapshot', {
      run: snapshot('101', { status: 'SUCCEEDED', result: '已完成' }),
    })
    expect(state.runs['101']?.status).toBe('SUCCEEDED')
    // 封存后仍不接受后续事件改写。
    state = stream(state, 'agent-run.delta', delta('101', 9, 1, '迟到'))
    expect(state.runs['101']?.segments).toEqual([])
  })

  it('刷新后残留 FAILED（服务重启）显示结果：触发消息已加载且无最终消息', () => {
    let state = withVisibleTriggers('8801')
    state = stream(state, 'agent-run.snapshot', {
      run: snapshot('101', { status: 'FAILED', revision: 0, result: '服务重启，运行已中断' }),
    })
    expect(state.runs['101'].status).toBe('FAILED')
    expect(state.runs['101'].result).toBe('服务重启，运行已中断')

    const unseen = stream(withVisibleTriggers('other'), 'agent-run.snapshot', {
      run: snapshot('102', { status: 'FAILED', revision: 0, result: '服务重启，运行已中断' }),
    })
    expect(unseen.runs['102']).toBeUndefined()

    const empty = stream(withVisibleTriggers('8801'), 'agent-run.snapshot', {
      run: snapshot('103', { status: 'SUCCEEDED', revision: 0 }),
    })
    expect(empty.runs['103']).toBeUndefined()
  })

  it('未知子运行的终态不单独成气泡', () => {
    const state = stream(withVisibleTriggers('8801'), 'agent-run.snapshot', {
      run: snapshot('102', {
        parentRunId: '101',
        rootRunId: '101',
        status: 'SUCCEEDED',
        result: '子任务完成',
      }),
    })
    expect(state.runs).toEqual({})
  })

  it('终态快照保留已流式收到的正文并补上结果', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [snapshot('101')])
    state = stream(state, 'agent-run.delta', delta('101', 2, 1, '流式正文'))
    state = stream(state, 'agent-run.snapshot', {
      run: snapshot('101', { revision: 3, status: 'SUCCEEDED', seq: 1, result: '最终结果' }),
    })

    expect(textOf(state, '101')).toBe('流式正文')
    expect(state.runs['101'].status).toBe('SUCCEEDED')
    expect(state.runs['101'].result).toBe('最终结果')
  })
})

describe('入口校验', () => {
  it('拒绝缺字段、非整数 round/seq/revision 的事件，不默认成 0', () => {
    expect(parseAgentRunEvent('agent-run.delta', '{')).toBeNull()
    expect(parseAgentRunEvent('agent-run.delta', JSON.stringify({ runId: '1' }))).toBeNull()
    expect(parseAgentRunEvent('unknown.event', JSON.stringify(root('1')))).toBeNull()
    expect(parseAgentRunEvent('agent-run.updated', JSON.stringify(root('1')))).toBeNull()
    expect(
      parseAgentRunEvent(
        'agent-run.updated',
        JSON.stringify(root('1', { round: 1.5, revision: 1 })),
      ),
    ).toBeNull()
    expect(
      parseAgentRunEvent(
        'agent-run.updated',
        JSON.stringify(root('1', { round: -1, revision: 1 })),
      ),
    ).toBeNull()
    expect(
      parseAgentRunEvent(
        'agent-run.delta',
        JSON.stringify({ ...root('1'), seq: 1, text: 'x', revision: 1.5 }),
      ),
    ).toBeNull()
    expect(
      parseAgentRunEvent('agent-run.delta', JSON.stringify({ ...root('1'), seq: 1, text: 'x' })),
    ).toBeNull()
    expect(
      parseAgentRunEvent(
        'agent-run.tool',
        JSON.stringify({ ...root('1'), phase: 'started', tool: 'run_command' }),
      ),
    ).toBeNull()
    expect(
      parseAgentRunEvent(
        'agent-run.snapshot',
        JSON.stringify({ run: snapshot('1', { seq: undefined }) }),
      ),
    ).toBeNull()
  })

  it('快照数组坏条目跳过，整体形状不对时报错', () => {
    expect(() => parseAgentRunSnapshots({ data: [] })).toThrow()
    expect(parseAgentRunSnapshots([snapshot('101'), { runId: 'bad' }])).toHaveLength(1)
  })

  it('runs 输出按 runId 升序，方便按触发消息分组', () => {
    let state = withVisibleTriggers('8801')
    state = snapshots(state, [snapshot('102'), snapshot('101')])
    expect(listAgentRuns(state).map((run) => run.runId)).toEqual(['101', '102'])
  })
})
