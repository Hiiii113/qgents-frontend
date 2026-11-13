/** 群级 Agent 运行流（契约 C:/tmp/qg-stream-contract.md）：只含可展示正文与阶段，不含思考链/工具参数。 */

export type AgentRunStatus = 'RUNNING' | 'CANCELLING' | 'CANCELLED' | 'SUCCEEDED' | 'FAILED'

const TERMINAL_STATUSES: readonly AgentRunStatus[] = ['SUCCEEDED', 'FAILED', 'CANCELLED']

export function isTerminalStatus(status: AgentRunStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export interface AgentRunSegment {
  round: number
  text: string
}

/** 工具阶段：running=执行中；ok/failed=服务端明确成功/失败；done=结束但结果中性。 */
export type AgentRunToolState = 'running' | 'ok' | 'failed' | 'done'

export interface AgentRunTool {
  toolCallId: string
  tool: string
  round: number
  state: AgentRunToolState
}

/** 某个根/子运行的最新状态；runs 输出与组件都只读它。 */
export interface AgentRun {
  runId: string
  parentRunId: string | null
  rootRunId: string
  projectId: string
  groupId: string
  agentId: string
  triggerMessageId: string
  status: AgentRunStatus
  /** 根运行结束前单调递增；子运行续接也不重置。0 = 刚开始/刚续接。 */
  round: number
  segments: AgentRunSegment[]
  tools: AgentRunTool[]
  /** 终态时数据库里的结果文本，仅作最终消息到达前的过渡展示。 */
  result: string | null
  /** 已接收到的最后一个 delta seq；快照按它排序，落后快照不覆盖新正文。 */
  lastSeq: number
  /** 服务端状态版本：同 runId 内自增，旧 revision 的状态/工具事件不能覆盖新状态。 */
  revision: number
  createdAt: string | null
}

export type AgentRunConnectionStatus =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'

export function replyClientMessageId(rootRunId: string): string {
  return `qgent-reply:${rootRunId}`
}

/** 最终消息用 clientMessageId 精确匹配各自的根运行；同一触发消息可 @ 多个 Agent。 */
export function rootRunIdFromReply(clientMessageId: string | null | undefined): string | null {
  if (typeof clientMessageId !== 'string') return null
  return clientMessageId.startsWith('qgent-reply:') ? clientMessageId.slice(12) : null
}
