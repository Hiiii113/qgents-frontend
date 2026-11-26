import { isTerminalStatus, rootRunIdFromReply, type AgentRun } from '@/features/agent-runs'
import type { ChatMessage } from '@/types/chat'

/**
 * 一个根运行和它派生出的子运行。聊天里按根运行成组：
 * 工具调用挂在 Agent 消息行里，不再塞进用户触发消息那一行。
 */
export interface RunGroup {
  rootRunId: string
  /** 根运行的触发消息：停止按钮与“进行中行”的插入位置都按它定位。 */
  triggerMessageId: string
  /** 根运行在前，子运行按 runId 升序。 */
  runs: AgentRun[]
}

export type ChatEntry =
  | { key: string; kind: 'message'; message: ChatMessage; showDate: boolean }
  | { key: string; kind: 'run'; group: RunGroup; showDate: boolean }

function runIdOrder(runId: string): number {
  const value = Number(runId)
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
}

function compareRuns(left: AgentRun, right: AgentRun): number {
  // 根运行永远排第一：它带着唯一的停止按钮，也是最终消息的落点。
  const depth = Number(Boolean(left.parentRunId)) - Number(Boolean(right.parentRunId))
  if (depth !== 0) return depth
  const a = runIdOrder(left.runId)
  const b = runIdOrder(right.runId)
  return a === b ? left.runId.localeCompare(right.runId) : a - b
}

/** 按 rootRunId 归组：多个 Agent 同时运行时各自成组，互不影响交接。 */
export function groupRunsByRoot(runs: AgentRun[]): Map<string, RunGroup> {
  const groups = new Map<string, RunGroup>()
  for (const run of runs) {
    const group = groups.get(run.rootRunId)
    if (group) {
      group.runs.push(run)
      continue
    }
    groups.set(run.rootRunId, {
      rootRunId: run.rootRunId,
      triggerMessageId: run.triggerMessageId,
      runs: [run],
    })
  }
  for (const group of groups.values()) {
    group.runs.sort(compareRuns)
    group.triggerMessageId = group.runs[0]?.triggerMessageId ?? group.triggerMessageId
  }
  return groups
}

/** 已经落了最终消息的根运行：运行卡挂到那条 Agent 消息里，不再另起进行中行。 */
export function repliedRootRunIds(messages: ChatMessage[]): Set<string> {
  const ids = new Set<string>()
  for (const message of messages) {
    const rootRunId = rootRunIdFromReply(message.clientMessageId)
    if (rootRunId) ids.add(rootRunId)
  }
  return ids
}

/**
 * 流式正文：优先最后一个还在跑的运行；全都结束了就保留最后一段已收到的正文，
 * 避免最终消息到达前正文闪一下空白。正文不进运行卡的框，单独渲染在卡片下方。
 */
export function streamingText(group: RunGroup): string {
  const reversed = [...group.runs].reverse()
  const source =
    reversed.find((run) => !isTerminalStatus(run.status)) ??
    reversed.find((run) => run.segments.length > 0)
  return source ? source.segments.map((segment) => segment.text).join('') : ''
}

/**
 * 渲染条目：普通消息按顺序排；没有最终消息、且触发消息在场的根运行
 * 以 `run:<rootRunId>` 紧跟触发消息插入，所以多个 Agent 各自待在自己的触发消息下方，
 * 单 Agent / 私聊时它就在列表末尾，交接时位置不动。
 */
export function buildChatEntries(
  messages: ChatMessage[],
  groups: Map<string, RunGroup>,
): ChatEntry[] {
  const replied = repliedRootRunIds(messages)
  const pending = new Map<string, RunGroup[]>()
  const visible = new Set(messages.map((message) => message.id))
  for (const group of groups.values()) {
    if (replied.has(group.rootRunId)) continue
    if (!visible.has(group.triggerMessageId)) continue
    const bucket = pending.get(group.triggerMessageId)
    if (bucket) bucket.push(group)
    else pending.set(group.triggerMessageId, [group])
  }
  for (const bucket of pending.values()) {
    bucket.sort((left, right) => {
      const a = runIdOrder(left.rootRunId)
      const b = runIdOrder(right.rootRunId)
      return a === b ? left.rootRunId.localeCompare(right.rootRunId) : a - b
    })
  }

  const entries: ChatEntry[] = []
  messages.forEach((message, index) => {
    const previous = index > 0 ? new Date(messages[index - 1].createdAt) : null
    const date = new Date(message.createdAt)
    entries.push({
      key: message.id,
      kind: 'message',
      message,
      showDate: !Number.isNaN(date.getTime()) && date.toDateString() !== previous?.toDateString(),
    })
    for (const group of pending.get(message.id) ?? []) {
      entries.push({ key: `run:${group.rootRunId}`, kind: 'run', group, showDate: false })
    }
  })
  return entries
}
