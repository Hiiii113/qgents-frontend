import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { ApiError } from '@/api/client'
import {
  subscribeAgentRunFrames,
  subscribeRealtimeReconnect,
  useRealtimeConnectionStatus,
  type RealtimeConnectionStatus,
} from '@/realtime/realtimeClient'
import type { ChatMessage } from '@/types/chat'
import { fetchAgentRunSnapshots } from './agentRunsApi'
import {
  agentRunsReducer,
  initialAgentRunsState,
  listAgentRuns,
  parseAgentRunFrame,
} from './agentRunState'
import { rootRunIdFromReply, type AgentRun, type AgentRunConnectionStatus } from './types'

/** WS 断开期间的快照兜底间隔；连接恢复后立即停止轮询。 */
export const AGENT_RUN_POLL_INTERVAL_MS = 1000

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

/** 全局 WS 状态 → 运行流的连接状态（运行流与全局连接同生共死）。 */
function connectionStatusOf(status: RealtimeConnectionStatus): AgentRunConnectionStatus {
  if (status === 'connected') return 'connected'
  if (status === 'connecting') return 'connecting'
  if (status === 'disconnected') return 'reconnecting'
  return 'idle'
}

/**
 * 群级 Agent 运行流：挂载即拉一次快照，增量事件从全局 WebSocket 的
 * agent-run.* 帧来（按 projectId + groupId 过滤），快照与 delta 按 seq 合并。
 * WS 重连时重查快照补齐缺口；仅在 WS 断开期间每 1s 拉快照兜底。
 */
export function useAgentRuns({
  projectId,
  groupId,
  messages,
}: UseAgentRunsOptions): UseAgentRunsResult {
  const [state, dispatch] = useReducer(agentRunsReducer, undefined, initialAgentRunsState)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [retryNonce, setRetryNonce] = useState(0)
  const loadSnapshotRef = useRef<() => Promise<void>>(async () => {})
  const realtimeStatus = useRealtimeConnectionStatus()

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
    let snapshotInFlight = false
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

    // 全局 WS 的群级运行帧：越界数据（别的项目/群）在入口丢一次。
    const unsubscribeFrames = subscribeAgentRunFrames((frame, target) => {
      if (stopped) return
      if (target.projectId !== projectId || target.groupId !== groupId) return
      const event = parseAgentRunFrame(frame.type, frame.payload)
      if (event) dispatch({ type: 'stream', event })
    })
    // 重连后事件可能已丢：补一次快照，再继续吃增量帧。
    const unsubscribeReconnect = subscribeRealtimeReconnect(() => void loadSnapshot())

    setSnapshotError(null)
    void loadSnapshot()

    return () => {
      stopped = true
      unsubscribeFrames()
      unsubscribeReconnect()
      snapshotAbort.abort()
    }
  }, [projectId, groupId, retryNonce])

  // 兜底：只有 WS 未连接时轮询快照（mock 模式下没有 WS，也走这条路）。
  useEffect(() => {
    if (!projectId || !groupId || realtimeStatus === 'connected') return
    const timer = setInterval(() => void loadSnapshotRef.current(), AGENT_RUN_POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [projectId, groupId, realtimeStatus])

  const retry = useCallback(() => {
    setSnapshotError(null)
    setRetryNonce((value) => value + 1)
  }, [])

  const runs = useMemo(() => listAgentRuns(state), [state])

  return {
    runs,
    connectionStatus: connectionStatusOf(realtimeStatus),
    error: snapshotError,
    retry,
  }
}
