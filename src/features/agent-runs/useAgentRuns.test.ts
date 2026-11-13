import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { refreshAccessToken } from '@/api/client'
import { AGENT_RUN_REFRESH_EVENT } from '@/realtime/realtimeClient'
import type { ChatMessage } from '@/types/chat'
import { fetchAgentRunSnapshots } from './agentRunsApi'
import type { AgentRunSnapshot } from './agentRunState'
import { useAgentRuns } from './useAgentRuns'

vi.mock('@microsoft/fetch-event-source', () => ({ fetchEventSource: vi.fn() }))
vi.mock('./agentRunsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./agentRunsApi')>()),
  fetchAgentRunSnapshots: vi.fn(),
}))
vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  refreshAccessToken: vi.fn(),
}))

type StreamOptions = Parameters<typeof fetchEventSource>[1]
interface OpenResponse {
  ok: boolean
  status: number
  contentType?: string
}

interface Stream {
  url: string
  options: StreamOptions
  signal: AbortSignal
  emit: (event: string, payload: unknown) => void
  close: () => void
}

let streams: Stream[] = []
let openResponses: OpenResponse[] = []

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

function renderAgentRuns(props?: {
  projectId?: string
  groupId?: string
  messages?: ChatMessage[]
}) {
  return renderHook((current) => useAgentRuns(current), {
    initialProps: { projectId: 'p1', groupId: 'g1', messages: [], ...props },
  })
}

function emit(stream: Stream, eventName: string, payload: unknown): void {
  act(() => stream.emit(eventName, payload))
}

beforeEach(() => {
  streams = []
  openResponses = []
  localStorage.clear()
  localStorage.setItem('qgents_access_token', 'token-1')
  vi.mocked(fetchEventSource).mockReset()
  vi.mocked(fetchAgentRunSnapshots).mockReset().mockResolvedValue([])
  vi.mocked(refreshAccessToken).mockReset().mockResolvedValue(null)

  vi.mocked(fetchEventSource).mockImplementation(async (url, options) => {
    const open = openResponses.shift() ?? { ok: true, status: 200 }
    await options.onopen?.({
      ok: open.ok,
      status: open.status,
      headers: new Headers({ 'content-type': open.contentType ?? 'text/event-stream' }),
    } as Response)
    const signal = options.signal as AbortSignal
    return new Promise<void>((resolve) => {
      signal.addEventListener('abort', () => resolve())
      streams.push({
        url: String(url),
        options,
        signal,
        emit: (eventName, payload) =>
          options.onmessage?.({
            event: eventName,
            data: JSON.stringify(payload),
            id: '',
          }),
        close: resolve,
      })
    })
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAgentRuns 连接与快照', () => {
  it('进群先拉快照并建专用群级 SSE，带 access token', async () => {
    vi.mocked(fetchAgentRunSnapshots).mockResolvedValue([snapshot('123')])
    const { result } = renderAgentRuns()

    await waitFor(() => expect(result.current.runs.map((run) => run.runId)).toEqual(['123']))
    expect(result.current.connectionStatus).toBe('connected')
    expect(fetchAgentRunSnapshots).toHaveBeenCalledWith('p1', 'g1', expect.any(AbortSignal))
    expect(streams[0].url).toBe('/api/projects/p1/groups/g1/agent-events')
    expect(streams[0].options.headers).toMatchObject({ Authorization: 'Bearer token-1' })
  })

  it('delta 先到、旧 REST 快照后到时不覆盖实时正文', async () => {
    let resolveSnapshot: (snapshots: AgentRunSnapshot[]) => void = () => {}
    vi.mocked(fetchAgentRunSnapshots).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSnapshot = resolve
      }),
    )
    const { result } = renderAgentRuns()
    await waitFor(() => expect(streams).toHaveLength(1))

    emit(streams[0], 'agent-run.updated', event('123'))
    emit(streams[0], 'agent-run.delta', {
      ...event('123', { revision: 2 }),
      seq: 1,
      text: '实时正文',
    })
    expect(result.current.runs[0]?.segments).toEqual([{ round: 1, text: '实时正文' }])

    await act(async () => resolveSnapshot([snapshot('123', { revision: 0, seq: 0, round: 0 })]))
    expect(result.current.runs[0]?.segments).toEqual([{ round: 1, text: '实时正文' }])
    expect(result.current.runs[0]?.status).toBe('RUNNING')
  })

  it('最终消息按 clientMessageId 删除根/子运行，迟到 SSE 事件不再复活', async () => {
    vi.mocked(fetchAgentRunSnapshots).mockResolvedValue([
      snapshot('123'),
      snapshot('124', { parentRunId: '123', rootRunId: '123' }),
    ])
    const { result, rerender } = renderAgentRuns()
    await waitFor(() => expect(result.current.runs).toHaveLength(2))

    rerender({ projectId: 'p1', groupId: 'g1', messages: [chatMessage('m1', 'qgent-reply:123')] })
    await waitFor(() => expect(result.current.runs).toHaveLength(0))

    emit(streams[0], 'agent-run.delta', { ...event('123'), seq: 1, text: '迟到' })
    expect(result.current.runs).toHaveLength(0)
  })

  it('切群时 abort 旧连接、清空旧运行并连到新群', async () => {
    vi.mocked(fetchAgentRunSnapshots).mockResolvedValueOnce([snapshot('123')])
    const { result, rerender } = renderAgentRuns()
    await waitFor(() => expect(result.current.runs).toHaveLength(1))
    const previous = streams[0]

    rerender({ projectId: 'p1', groupId: 'g2', messages: [] })
    expect(previous.signal.aborted).toBe(true)
    await waitFor(() => expect(result.current.runs).toHaveLength(0))
    await waitFor(() => expect(streams).toHaveLength(2))
    expect(fetchAgentRunSnapshots).toHaveBeenLastCalledWith('p1', 'g2', expect.any(AbortSignal))
    expect(streams[1].url).toBe('/api/projects/p1/groups/g2/agent-events')
  })

  it('卸载时 abort 连接，不再保持流', async () => {
    const { unmount } = renderAgentRuns()
    await waitFor(() => expect(streams).toHaveLength(1))
    unmount()
    expect(streams[0].signal.aborted).toBe(true)
  })
})

describe('useAgentRuns 错误与降级', () => {
  it('403 进入 error 并停止自动重连', async () => {
    vi.useFakeTimers()
    openResponses.push({ ok: false, status: 403 })
    const { result } = renderAgentRuns()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.connectionStatus).toBe('error')
    expect(result.current.error).toContain('权限')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(fetchEventSource).toHaveBeenCalledTimes(1)
  })

  it('401 且 refresh 失败时提示登录过期，不陷入重连', async () => {
    vi.useFakeTimers()
    openResponses.push({ ok: false, status: 401 })
    const { result } = renderAgentRuns()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.connectionStatus).toBe('error')
    expect(result.current.error).toContain('登录已过期')
    expect(refreshAccessToken).toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(fetchEventSource).toHaveBeenCalledTimes(1)
  })

  it('401 且 refresh 成功后退避重连', async () => {
    vi.useFakeTimers()
    openResponses.push({ ok: false, status: 401 })
    vi.mocked(refreshAccessToken).mockResolvedValue('token-2')
    const { result } = renderAgentRuns()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.connectionStatus).toBe('reconnecting')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100)
    })
    expect(fetchEventSource).toHaveBeenCalledTimes(2)
    expect(result.current.connectionStatus).toBe('connected')
  })

  it('快照失败保留可见错误，缺口重查成功后清除', async () => {
    vi.mocked(fetchAgentRunSnapshots)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue([
        snapshot('123', { revision: 2, seq: 5, segments: [{ round: 1, text: '补全正文' }] }),
      ])
    const { result } = renderAgentRuns()
    await waitFor(() => expect(result.current.error).toContain('获取 Agent 运行状态失败'))

    emit(streams[0], 'agent-run.updated', event('123'))
    emit(streams[0], 'agent-run.delta', { ...event('123', { revision: 2 }), seq: 5, text: '缺口' })
    await waitFor(() => expect(result.current.error).toBeNull())
    expect(result.current.runs[0]?.segments).toEqual([{ round: 1, text: '补全正文' }])
  })

  it('200 但不是事件流（代理错误页）按连接失败处理', async () => {
    vi.useFakeTimers()
    openResponses.push({ ok: true, status: 200, contentType: 'text/html' })
    const { result } = renderAgentRuns()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.connectionStatus).toBe('reconnecting')
    expect(result.current.error).toContain('事件流')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100)
    })
    expect(fetchEventSource).toHaveBeenCalledTimes(2)
    expect(result.current.connectionStatus).toBe('connected')
    expect(result.current.error).toBeNull()
  })

  it('断线后每 1s 拉快照降级，WS 刷新信号立即补一次，并退避重连', async () => {
    vi.useFakeTimers()
    const { result } = renderAgentRuns()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.connectionStatus).toBe('connected')
    const afterConnect = vi.mocked(fetchAgentRunSnapshots).mock.calls.length

    await act(async () => {
      streams[0].close()
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.connectionStatus).toBe('reconnecting')

    await act(async () => {
      window.dispatchEvent(new CustomEvent(AGENT_RUN_REFRESH_EVENT))
    })
    expect(vi.mocked(fetchAgentRunSnapshots).mock.calls.length).toBe(afterConnect + 1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(vi.mocked(fetchAgentRunSnapshots).mock.calls.length).toBeGreaterThan(afterConnect + 1)
    expect(fetchEventSource).toHaveBeenCalledTimes(2)
  })

  it('retry 在 error 后重新建连', async () => {
    vi.useFakeTimers()
    openResponses.push({ ok: false, status: 404 })
    const { result } = renderAgentRuns()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.error).toContain('不存在')

    await act(async () => {
      result.current.retry()
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.error).toBeNull()
    expect(fetchEventSource).toHaveBeenCalledTimes(2)
    expect(result.current.connectionStatus).toBe('connected')
  })
})
