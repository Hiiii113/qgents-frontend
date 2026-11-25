import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dispatchRealtimeFrame } from '@/realtime/realtimeClient'
import type { ChatMessage } from '@/types/chat'
import { fetchAgentRunSnapshots } from './agentRunsApi'
import type { AgentRunSnapshot } from './agentRunState'
import { AGENT_RUN_POLL_INTERVAL_MS, useAgentRuns } from './useAgentRuns'

const realtime = vi.hoisted(() => ({
  status: 'connected' as 'idle' | 'connecting' | 'connected' | 'disconnected',
  reconnectListeners: new Set<() => void>(),
}))

vi.mock('./agentRunsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./agentRunsApi')>()),
  fetchAgentRunSnapshots: vi.fn(),
}))

// 帧订阅用真实实现（subscribeAgentRunFrames + dispatchRealtimeFrame 共享注册表），
// 只替换全局连接状态与重连通知，测试里手动驱动。
vi.mock('@/realtime/realtimeClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/realtime/realtimeClient')>()
  return {
    ...actual,
    useRealtimeConnectionStatus: () => realtime.status,
    subscribeRealtimeReconnect: (listener: () => void) => {
      realtime.reconnectListeners.add(listener)
      return () => {
        realtime.reconnectListeners.delete(listener)
      }
    },
  }
})

const identity = { projectId: 'p1', groupId: 'g1', agentId: '7', triggerMessageId: '8801' }

function snapshot(runId: string, extra: Record<string, unknown> = {}): AgentRunSnapshot {
  return {
    runId,
    parentRunId: null,
    rootRunId: runId,
    ...identity,
    status: 'RUNNING',
    round: 1,
    seq: 0,
    revision: 1,
    segments: [],
    tools: [],
    result: null,
    createdAt: '2026-06-20T03:01:02.123Z',
    ...extra,
  }
}

function event(runId: string, extra: Record<string, unknown> = {}) {
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

function chatMessage(id: string, clientMessageId: string | null = null): ChatMessage {
  return {
    id,
    groupId: 'g1',
    type: 'TEXT',
    content: { text: '消息' },
    senderType: 'USER',
    senderName: '陈同学',
    createdAt: '2026-06-20T03:00:00.000Z',
    clientMessageId,
  }
}

/** 模拟全局 WS 推来的一帧（与我方约定的帧信封一致）。 */
function pushFrame(
  type: string,
  payload: Record<string, unknown>,
  scope: { projectId?: string; groupId?: string | null } = {},
): void {
  dispatchRealtimeFrame({
    type,
    scope: 'project',
    projectId: scope.projectId ?? 'p1',
    groupId: scope.groupId === undefined ? 'g1' : scope.groupId,
    payload,
  })
}

function renderAgentRuns(props?: {
  projectId?: string
  groupId?: string
  messages?: ChatMessage[]
}) {
  return renderHook((current) => useAgentRuns(current), {
    initialProps: { projectId: 'p1', groupId: 'g1', messages: [], ...props },
  })
}

beforeEach(() => {
  realtime.status = 'connected'
  realtime.reconnectListeners.clear()
  vi.mocked(fetchAgentRunSnapshots).mockReset().mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAgentRuns 快照与 WS 帧', () => {
  it('进群先拉一次快照，连接的运行状态跟随全局 WS', async () => {
    vi.mocked(fetchAgentRunSnapshots).mockResolvedValue([snapshot('123')])
    const { result } = renderAgentRuns()

    await waitFor(() => expect(result.current.runs.map((run) => run.runId)).toEqual(['123']))
    expect(result.current.connectionStatus).toBe('connected')
    expect(fetchAgentRunSnapshots).toHaveBeenCalledWith('p1', 'g1', expect.any(AbortSignal))
  })

  it('只接收本群帧：别的项目/群与缺 groupId 的帧都不进状态', async () => {
    const { result } = renderAgentRuns()
    await waitFor(() => expect(fetchAgentRunSnapshots).toHaveBeenCalled())

    act(() => pushFrame('agent-run.updated', event('900', { revision: 1 }), { projectId: 'p2' }))
    act(() => pushFrame('agent-run.updated', event('901', { revision: 1 }), { groupId: 'g2' }))
    act(() =>
      pushFrame('agent-run.updated', { ...event('902', { revision: 1 }), groupId: '' }, { groupId: null }),
    )
    expect(result.current.runs).toHaveLength(0)

    // groupId 只出现在 payload 时也要能路由（帧信封可为空）
    act(() => pushFrame('agent-run.updated', event('123', { revision: 1 }), { groupId: null }))
    expect(result.current.runs.map((run) => run.runId)).toEqual(['123'])
  })

  it('delta 先到、旧 REST 快照后到时不覆盖实时正文', async () => {
    let resolveSnapshot: (snapshots: AgentRunSnapshot[]) => void = () => {}
    vi.mocked(fetchAgentRunSnapshots).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSnapshot = resolve
      }),
    )
    const { result } = renderAgentRuns()
    await waitFor(() => expect(fetchAgentRunSnapshots).toHaveBeenCalled())

    act(() => pushFrame('agent-run.updated', event('123')))
    act(() =>
      pushFrame('agent-run.delta', { ...event('123', { revision: 2 }), seq: 1, text: '实时正文' }),
    )
    expect(result.current.runs[0]?.segments).toEqual([{ round: 1, text: '实时正文' }])

    await act(async () => resolveSnapshot([snapshot('123', { revision: 0, seq: 0, round: 0 })]))
    expect(result.current.runs[0]?.segments).toEqual([{ round: 1, text: '实时正文' }])
    expect(result.current.runs[0]?.status).toBe('RUNNING')
  })

  it('工具阶段按帧类型推进（tool-started / tool-finished）', async () => {
    const { result } = renderAgentRuns()
    await waitFor(() => expect(fetchAgentRunSnapshots).toHaveBeenCalled())
    act(() => pushFrame('agent-run.updated', event('123', { revision: 2 })))

    act(() =>
      pushFrame('agent-run.tool-started', {
        ...event('123', { revision: 3 }),
        toolCallId: 'call_a',
        tool: 'run_command',
        input: '{"command":"ls"}',
      }),
    )
    expect(result.current.runs[0]?.tools[0]).toMatchObject({
      toolCallId: 'call_a',
      state: 'running',
    })

    act(() =>
      pushFrame('agent-run.tool-finished', {
        ...event('123', { revision: 4 }),
        toolCallId: 'call_a',
        tool: 'run_command',
        ok: true,
        output: 'src',
      }),
    )
    expect(result.current.runs[0]?.tools[0]).toMatchObject({
      toolCallId: 'call_a',
      state: 'ok',
      output: 'src',
    })
  })

  it('最终消息封存根/子运行：保留运行卡数据，迟到帧不再改写', async () => {
    vi.mocked(fetchAgentRunSnapshots).mockResolvedValue([
      snapshot('123'),
      snapshot('124', { parentRunId: '123', rootRunId: '123' }),
    ])
    const { result, rerender } = renderAgentRuns()
    await waitFor(() => expect(result.current.runs).toHaveLength(2))

    rerender({ projectId: 'p1', groupId: 'g1', messages: [chatMessage('m1', 'qgent-reply:123')] })
    expect(result.current.runs).toHaveLength(2)

    act(() => pushFrame('agent-run.delta', { ...event('123'), seq: 1, text: '迟到' }))
    expect(result.current.runs).toHaveLength(2)
    expect(result.current.runs[0]?.segments).not.toEqual([{ round: 1, text: '迟到' }])
  })

  it('切群时清空旧运行、退回旧群订阅并拉新群快照', async () => {
    vi.mocked(fetchAgentRunSnapshots)
      .mockResolvedValueOnce([snapshot('123')])
      .mockResolvedValueOnce([snapshot('456', { groupId: 'g2' })])
    const { result, rerender } = renderAgentRuns()
    await waitFor(() => expect(result.current.runs).toHaveLength(1))

    rerender({ projectId: 'p1', groupId: 'g2', messages: [] })
    await waitFor(() => expect(result.current.runs.map((run) => run.runId)).toEqual(['456']))
    expect(fetchAgentRunSnapshots).toHaveBeenLastCalledWith('p1', 'g2', expect.any(AbortSignal))

    // 旧群的帧已经被退订，不会改到当前状态
    act(() => pushFrame('agent-run.delta', { ...event('123'), seq: 1, text: '旧群' }))
    expect(result.current.runs.map((run) => run.runId)).toEqual(['456'])
  })

  it('卸载后退订帧，跳号不再触发补快照', async () => {
    const { unmount } = renderAgentRuns()
    await waitFor(() => expect(fetchAgentRunSnapshots).toHaveBeenCalledTimes(1))
    unmount()

    act(() =>
      pushFrame('agent-run.delta', { ...event('123', { revision: 2 }), seq: 5, text: '缺口' }),
    )
    expect(fetchAgentRunSnapshots).toHaveBeenCalledTimes(1)
  })

  it('delta 跳号时拉一次快照整体校准', async () => {
    const { result } = renderAgentRuns()
    await waitFor(() => expect(fetchAgentRunSnapshots).toHaveBeenCalledTimes(1))
    act(() => pushFrame('agent-run.updated', event('123', { revision: 1 })))

    vi.mocked(fetchAgentRunSnapshots).mockResolvedValue([
      snapshot('123', { revision: 2, seq: 5, segments: [{ round: 1, text: '补全正文' }] }),
    ])
    act(() =>
      pushFrame('agent-run.delta', { ...event('123', { revision: 2 }), seq: 5, text: '缺口' }),
    )

    await waitFor(() => expect(fetchAgentRunSnapshots).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(result.current.runs[0]?.segments).toEqual([{ round: 1, text: '补全正文' }]),
    )
  })

  it('快照失败保留可见错误，重试成功后清除', async () => {
    vi.mocked(fetchAgentRunSnapshots).mockRejectedValueOnce(new Error('network'))
    const { result } = renderAgentRuns()
    await waitFor(() => expect(result.current.error).toContain('获取 Agent 运行状态失败'))

    vi.mocked(fetchAgentRunSnapshots).mockResolvedValue([snapshot('123')])
    act(() => result.current.retry())

    await waitFor(() => expect(result.current.error).toBeNull())
    await waitFor(() => expect(result.current.runs.map((run) => run.runId)).toEqual(['123']))
    expect(result.current.connectionStatus).toBe('connected')
  })
})

describe('useAgentRuns 重连与轮询兜底', () => {
  it('WS 重连成功时补拉一次快照', async () => {
    renderAgentRuns()
    await waitFor(() => expect(fetchAgentRunSnapshots).toHaveBeenCalledTimes(1))

    await act(async () => {
      for (const listener of realtime.reconnectListeners) listener()
    })
    expect(fetchAgentRunSnapshots).toHaveBeenCalledTimes(2)
  })

  it('WS 断开期间每 1s 拉快照，连接恢复后停止轮询', async () => {
    vi.useFakeTimers()
    realtime.status = 'disconnected'
    const { result, rerender } = renderAgentRuns()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetchAgentRunSnapshots).toHaveBeenCalledTimes(1)
    expect(result.current.connectionStatus).toBe('reconnecting')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AGENT_RUN_POLL_INTERVAL_MS)
    })
    expect(fetchAgentRunSnapshots).toHaveBeenCalledTimes(2)

    realtime.status = 'connected'
    rerender({ projectId: 'p1', groupId: 'g1', messages: [] })
    expect(result.current.connectionStatus).toBe('connected')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AGENT_RUN_POLL_INTERVAL_MS * 3)
    })
    expect(fetchAgentRunSnapshots).toHaveBeenCalledTimes(2)
  })
})
