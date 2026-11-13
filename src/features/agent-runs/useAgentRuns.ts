import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { ApiError, getApiBaseUrl, getStoredToken, refreshAccessToken } from '@/api/client'
import { AGENT_RUN_REFRESH_EVENT } from '@/realtime/realtimeClient'
import type { ChatMessage } from '@/types/chat'
import { fetchAgentRunSnapshots, agentEventsPath } from './agentRunsApi'
import {
  agentRunsReducer,
  initialAgentRunsState,
  listAgentRuns,
  parseAgentRunEvent,
} from './agentRunState'
import { rootRunIdFromReply, type AgentRun, type AgentRunConnectionStatus } from './types'

/** 断线降级：SSE 断开期间每 1s 拉一次快照，同时按这个序列退避重连。 */
export const AGENT_RUN_POLL_INTERVAL_MS = 1000
export const AGENT_RUN_RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000] as const

export interface UseAgentRunsOptions {
  projectId: string
  groupId: string
  /** 当前消息列表（含增量补齐）；只用于最终消息去重与触发消息可见性。 */
  messages: ChatMessage[]
}

export interface UseAgentRunsResult {
  /** 该群 root + child 运行的最新快照，按 runId 升序。 */
  runs: AgentRun[]
  connectionStatus: AgentRunConnectionStatus
  error: string | null
  retry: () => void
}

type StreamFailure = 'retry' | 'auth' | 'forbidden' | 'missing' | 'http' | 'protocol'

/** 这些失败重连也不会成功：明确停止，等用户处理权限/登录。 */
const TERMINAL_FAILURES: readonly StreamFailure[] = ['auth', 'forbidden', 'missing']

class AgentRunStreamError extends Error {
  readonly failure: StreamFailure
  readonly status?: number

  constructor(failure: StreamFailure, status?: number) {
    super(`agent-run stream failed: ${failure}`)
    this.name = 'AgentRunStreamError'
    this.failure = failure
    this.status = status
  }
}

function failureMessage(failure: StreamFailure, status?: number): string | null {
  if (failure === 'auth') return '登录已过期，请重新登录'
  if (failure === 'forbidden') return '没有查看该群 Agent 运行的权限'
  if (failure === 'missing') return '该群不存在或已不可访问'
  if (failure === 'protocol') return 'Agent 运行状态事件流不可用，正在自动重试'
  if (failure === 'http') return `无法连接 Agent 运行状态（HTTP ${status ?? '?'}）`
  return null
}

/** 快照拉取失败也要可见：delta 缺口后一直等不到快照时，界面不能假装正常。 */
function snapshotFailureMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 401) return '登录已过期，请重新登录'
    if (cause.status === 403) return '没有查看该群 Agent 运行的权限'
    if (cause.status === 404) return '该群不存在或已不可访问'
    return `获取 Agent 运行状态失败（HTTP ${cause.status}），正在自动重试`
  }
  return '获取 Agent 运行状态失败，正在自动重试'
}

/**
 * 群级 Agent 运行流：挂载即拉一次快照 + 建专用 SSE，快照与 delta 按 seq 合并。
 * 断线时每 1s 拉快照降级并退避重连；卸载/切群 abort，不建跨群的错误重连。
 */
export function useAgentRuns({
  projectId,
  groupId,
  messages,
}: UseAgentRunsOptions): UseAgentRunsResult {
  const [state, dispatch] = useReducer(agentRunsReducer, undefined, initialAgentRunsState)
  const [connectionStatus, setConnectionStatus] = useState<AgentRunConnectionStatus>('idle')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [retryNonce, setRetryNonce] = useState(0)
  const loadSnapshotRef = useRef<() => Promise<void>>(async () => {})

  const triggerMessageIds = useMemo(() => messages.map((message) => message.id), [messages])
  const completedRootIds = useMemo(
    () =>
      messages
        .map((message) => rootRunIdFromReply(message.clientMessageId))
        .filter((runId): runId is string => runId !== null),
    [messages],
  )

  useEffect(() => {
    dispatch({ type: 'reset' })
  }, [projectId, groupId])

  useEffect(() => {
    dispatch({ type: 'messages', triggerMessageIds })
  }, [triggerMessageIds])

  useEffect(() => {
    if (completedRootIds.length) dispatch({ type: 'finalize', rootIds: completedRootIds })
  }, [completedRootIds])

  // 增量跳号：由 reducer 计数通知，整体换成一次快照后继续。
  useEffect(() => {
    if (state.resyncToken) void loadSnapshotRef.current()
  }, [state.resyncToken])

  useEffect(() => {
    if (!projectId || !groupId) return
    let stopped = false
    let controller: AbortController | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let snapshotInFlight = false
    let connected = false
    let attempt = 0
    const snapshotAbort = new AbortController()

    async function loadSnapshot(): Promise<void> {
      if (stopped || snapshotInFlight) return
      snapshotInFlight = true
      try {
        const snapshots = await fetchAgentRunSnapshots(projectId, groupId, snapshotAbort.signal)
        if (stopped) return
        setSnapshotError(null)
        dispatch({ type: 'snapshots', snapshots })
      } catch (cause) {
        if (stopped || snapshotAbort.signal.aborted) return
        setSnapshotError(snapshotFailureMessage(cause))
      } finally {
        snapshotInFlight = false
      }
    }
    loadSnapshotRef.current = loadSnapshot

    function stopPolling(): void {
      if (!pollTimer) return
      clearInterval(pollTimer)
      pollTimer = null
    }

    function startPolling(): void {
      if (stopped || pollTimer) return
      pollTimer = setInterval(() => void loadSnapshot(), AGENT_RUN_POLL_INTERVAL_MS)
    }

    function scheduleReconnect(): void {
      if (stopped || reconnectTimer) return
      const index = Math.min(attempt, AGENT_RUN_RECONNECT_DELAYS_MS.length - 1)
      const delay = AGENT_RUN_RECONNECT_DELAYS_MS[index] ?? AGENT_RUN_POLL_INTERVAL_MS
      attempt += 1
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        void connect()
      }, delay)
    }

    function demoted(): void {
      if (stopped) return
      connected = false
      setConnectionStatus('reconnecting')
      startPolling()
      scheduleReconnect()
    }

    async function connect(): Promise<void> {
      if (stopped) return
      setConnectionStatus(attempt === 0 ? 'connecting' : 'reconnecting')
      const abort = new AbortController()
      controller = abort
      const token = getStoredToken()
      try {
        await fetchEventSource(`${getApiBaseUrl()}${agentEventsPath(projectId, groupId)}`, {
          signal: abort.signal,
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          openWhenHidden: true,
          async onopen(response) {
            if (response.ok) {
              // 代理可能回一个 200 的 HTML 错误页；必须是事件流才算连上。
              const contentType = response.headers.get('content-type') ?? ''
              if (!contentType.startsWith('text/event-stream'))
                throw new AgentRunStreamError('protocol', response.status)
              attempt = 0
              connected = true
              if (stopped) return
              setConnectionStatus('connected')
              setConnectionError(null)
              stopPolling()
              // 服务端建连会推 snapshot；本地再补一次，覆盖断开期间的终态变化。
              void loadSnapshot()
              return
            }
            if (response.status === 401) {
              // 刷新成功用新 token 重连；刷新也失败则明确停止，避免 401 死循环。
              const refreshed = await refreshAccessToken()
              throw new AgentRunStreamError(refreshed ? 'retry' : 'auth', 401)
            }
            if (response.status === 403) throw new AgentRunStreamError('forbidden', 403)
            if (response.status === 404) throw new AgentRunStreamError('missing', 404)
            throw new AgentRunStreamError('http', response.status)
          },
          onmessage(message) {
            if (stopped) return
            const event = parseAgentRunEvent(message.event, message.data)
            if (!event) return
            const run = event.run
            // 群级 SSE 只应带本群事件；越界数据在入口丢一次。
            if (run.projectId !== projectId || run.groupId !== groupId) return
            dispatch({ type: 'stream', event })
          },
          onerror(cause) {
            // 必须抛出：返回数字会让 fetchEventSource 用闭包里的旧 token 内部重连。
            throw cause
          },
        })
        // abort 时 fetchEventSource 也会 resolve；只有服务端正常关闭才走降级。
        if (stopped || abort.signal.aborted) return
        demoted()
      } catch (cause) {
        if (stopped) return
        const failure = cause instanceof AgentRunStreamError ? cause.failure : null
        const message = failure
          ? failureMessage(failure, cause instanceof AgentRunStreamError ? cause.status : undefined)
          : null
        if (failure && TERMINAL_FAILURES.includes(failure)) {
          connected = false
          stopPolling()
          setConnectionError(message)
          setConnectionStatus('error')
          return
        }
        setConnectionError(message)
        demoted()
      } finally {
        if (controller === abort) controller = null
      }
    }

    // 群级 SSE 断开时，项目 WS 的 agent-run.updated/tool 可立刻触发一次快照，不必等 1s。
    function handleRefreshSignal(): void {
      if (!connected) void loadSnapshot()
    }
    window.addEventListener(AGENT_RUN_REFRESH_EVENT, handleRefreshSignal)

    setConnectionError(null)
    void loadSnapshot()
    void connect()

    return () => {
      stopped = true
      window.removeEventListener(AGENT_RUN_REFRESH_EVENT, handleRefreshSignal)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      stopPolling()
      snapshotAbort.abort()
      controller?.abort()
    }
  }, [projectId, groupId, retryNonce])

  const retry = useCallback(() => {
    setConnectionError(null)
    setSnapshotError(null)
    setRetryNonce((value) => value + 1)
  }, [])

  const runs = useMemo(() => listAgentRuns(state), [state])

  return { runs, connectionStatus, error: connectionError ?? snapshotError, retry }
}
