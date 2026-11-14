import {
  isTerminalStatus,
  type AgentRun,
  type AgentRunSegment,
  type AgentRunStatus,
  type AgentRunTool,
  type AgentRunToolState,
} from './types'

/** 契约里的 REST 快照 / agent-run.snapshot.run 原样字段。 */
export interface AgentRunSnapshot {
  runId: string
  parentRunId: string | null
  rootRunId: string
  projectId: string
  groupId: string
  agentId: string
  triggerMessageId: string
  status: AgentRunStatus
  round: number
  seq: number
  revision: number
  segments: AgentRunSegment[]
  tools: AgentRunTool[]
  result: string | null
  createdAt: string | null
}

interface AgentRunEventBase {
  runId: string
  parentRunId: string | null
  rootRunId: string
  projectId: string
  groupId: string
  agentId: string
  triggerMessageId: string
  status: AgentRunStatus
  round: number
}

export type AgentRunStreamEvent =
  | { kind: 'snapshot'; run: AgentRunSnapshot }
  | { kind: 'updated'; run: AgentRunEventBase; revision: number }
  | {
      kind: 'tool'
      run: AgentRunEventBase
      revision: number
      phase: 'started' | 'finished'
      toolCallId: string
      tool: string
      ok: boolean | null
    }
  | {
      kind: 'delta'
      run: AgentRunEventBase
      /** 每次 delta flush 也 +1；revision <= 本地即丢弃重复/迟到增量。 */
      revision: number
      seq: number
      text: string
    }

export interface AgentRunsState {
  runs: Record<string, AgentRun>
  /** 已收到最终消息的根运行：迟到事件不再复活临时气泡。 */
  finalizedRoots: Record<string, true>
  /** 已加载的消息 ID：只给触发消息在场的终态运行建气泡，避免历史气泡刷屏。 */
  visibleTriggers: Record<string, true>
  /** delta 跳号计数，hook 监听它拉一次快照。 */
  resyncToken: number
}

export type AgentRunsAction =
  | { type: 'stream'; event: AgentRunStreamEvent }
  | { type: 'snapshots'; snapshots: AgentRunSnapshot[] }
  | { type: 'finalize'; rootIds: string[] }
  | { type: 'messages'; triggerMessageIds: string[] }
  | { type: 'reset' }

const EMPTY_STATE: AgentRunsState = {
  runs: {},
  finalizedRoots: {},
  visibleTriggers: {},
  resyncToken: 0,
}

export function initialAgentRunsState(): AgentRunsState {
  return EMPTY_STATE
}

const STATUSES: readonly AgentRunStatus[] = [
  'RUNNING',
  'CANCELLING',
  'CANCELLED',
  'SUCCEEDED',
  'FAILED',
]

type Json = Record<string, unknown>

function asRecord(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null
}

function text(record: Json, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value ? value : null
}

function optionalText(record: Json, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' ? value : null
}

/** 契约要求的整数必须真的存在、是整数且非负；坏值整条事件丢弃，不默认成 0。 */
function readInteger(record: Json, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

function status(record: Json): AgentRunStatus | null {
  const value = record.status
  return STATUSES.find((item) => item === value) ?? null
}

/** 事件字段按契约校验一次；缺必要字段的事件直接丢弃，不让残缺数据进状态。 */
function readEventBase(value: unknown): AgentRunEventBase | null {
  const record = asRecord(value)
  if (!record) return null
  const runId = text(record, 'runId')
  const rootRunId = text(record, 'rootRunId')
  const projectId = text(record, 'projectId')
  const groupId = text(record, 'groupId')
  const agentId = text(record, 'agentId')
  const triggerMessageId = text(record, 'triggerMessageId')
  const runStatus = status(record)
  const round = readInteger(record, 'round')
  if (
    !runId ||
    !rootRunId ||
    !projectId ||
    !groupId ||
    !agentId ||
    !triggerMessageId ||
    !runStatus ||
    round === null
  )
    return null
  return {
    runId,
    parentRunId: optionalText(record, 'parentRunId'),
    rootRunId,
    projectId,
    groupId,
    agentId,
    triggerMessageId,
    status: runStatus,
    round,
  }
}

function readSegments(value: unknown): AgentRunSegment[] {
  if (!Array.isArray(value)) return []
  const segments: AgentRunSegment[] = []
  for (const item of value) {
    const record = asRecord(item)
    if (!record) continue
    const segmentText = optionalText(record, 'text')
    const round = readInteger(record, 'round')
    if (segmentText === null || round === null) continue
    segments.push({ round, text: segmentText })
  }
  return segments
}

function readTool(value: unknown): AgentRunTool | null {
  const record = asRecord(value)
  if (!record) return null
  const toolCallId = text(record, 'toolCallId')
  const tool = text(record, 'tool')
  const round = readInteger(record, 'round')
  if (!toolCallId || !tool || round === null) return null
  // 快照里只带仍在执行的工具。
  return { toolCallId, tool, round, state: 'running' }
}

function readTools(value: unknown): AgentRunTool[] {
  if (!Array.isArray(value)) return []
  return value.map(readTool).filter((item): item is AgentRunTool => item !== null)
}

function readSnapshot(value: unknown): AgentRunSnapshot | null {
  const base = readEventBase(value)
  const record = asRecord(value)
  if (!base || !record) return null
  const seq = readInteger(record, 'seq')
  const revision = readInteger(record, 'revision')
  if (seq === null || revision === null) return null
  return {
    ...base,
    seq,
    revision,
    segments: readSegments(record.segments),
    tools: readTools(record.tools),
    result: optionalText(record, 'result'),
    createdAt: optionalText(record, 'createdAt'),
  }
}

/** REST 快照入口：整体形状不对就报错（可见的失败），个别坏条目跳过。 */
export function parseAgentRunSnapshots(value: unknown): AgentRunSnapshot[] {
  if (!Array.isArray(value)) throw new Error('Agent 运行快照格式不正确')
  return value.map(readSnapshot).filter((item): item is AgentRunSnapshot => item !== null)
}

/** SSE 事件入口：返回 null 表示这条事件无法使用，调用方忽略即可。 */
export function parseAgentRunEvent(eventName: string, data: string): AgentRunStreamEvent | null {
  let value: unknown
  try {
    value = JSON.parse(data)
  } catch {
    return null
  }
  if (eventName === 'agent-run.snapshot') {
    const run = readSnapshot(asRecord(value)?.run)
    return run ? { kind: 'snapshot', run } : null
  }
  const run = readEventBase(value)
  if (!run) return null
  const record = value as Json
  if (eventName === 'agent-run.updated') {
    const revision = readInteger(record, 'revision')
    return revision === null ? null : { kind: 'updated', run, revision }
  }
  if (eventName === 'agent-run.delta') {
    const deltaText = optionalText(record, 'text')
    const seq = readInteger(record, 'seq')
    const revision = readInteger(record, 'revision')
    if (deltaText === null || seq === null || revision === null) return null
    return { kind: 'delta', run, revision, seq, text: deltaText }
  }
  if (eventName === 'agent-run.tool') {
    const phase = record.phase === 'started' || record.phase === 'finished' ? record.phase : null
    const toolCallId = text(record, 'toolCallId')
    const tool = text(record, 'tool')
    const revision = readInteger(record, 'revision')
    const ok = typeof record.ok === 'boolean' ? record.ok : null
    if (!phase || !toolCallId || !tool || revision === null) return null
    return { kind: 'tool', run, phase, toolCallId, tool, ok, revision }
  }
  return null
}

function fromSnapshot(snapshot: AgentRunSnapshot, overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    runId: snapshot.runId,
    parentRunId: snapshot.parentRunId,
    rootRunId: snapshot.rootRunId,
    projectId: snapshot.projectId,
    groupId: snapshot.groupId,
    agentId: snapshot.agentId,
    triggerMessageId: snapshot.triggerMessageId,
    status: snapshot.status,
    round: snapshot.round,
    segments: snapshot.segments,
    tools: snapshot.tools,
    result: snapshot.result,
    lastSeq: snapshot.seq,
    revision: snapshot.revision,
    createdAt: snapshot.createdAt,
    ...overrides,
  }
}

function fromEvent(run: AgentRunEventBase, revision: number): AgentRun {
  return {
    runId: run.runId,
    parentRunId: run.parentRunId,
    rootRunId: run.rootRunId,
    projectId: run.projectId,
    groupId: run.groupId,
    agentId: run.agentId,
    triggerMessageId: run.triggerMessageId,
    status: run.status,
    round: run.round,
    segments: [],
    tools: [],
    result: null,
    lastSeq: 0,
    revision,
    createdAt: null,
  }
}

function withRun(state: AgentRunsState, run: AgentRun): AgentRunsState {
  return { ...state, runs: { ...state.runs, [run.runId]: run } }
}

/** 只有服务端新版本才能改状态/工具；正文由 delta.seq 单独排序。 */
function isStale(existing: AgentRun, revision: number | null): boolean {
  return revision !== null && revision < existing.revision
}

/** 子运行续接：只有 child 能以更高 round 从终态恢复，恢复时旧临时段作废。 */
function resumes(existing: AgentRun, status: AgentRunStatus, round: number): boolean {
  return status === 'RUNNING' && existing.parentRunId !== null && round > existing.round
}

function applyUpdated(
  state: AgentRunsState,
  event: AgentRunEventBase,
  revision: number,
): AgentRunsState {
  if (state.finalizedRoots[event.rootRunId]) return state
  const existing = state.runs[event.runId]
  if (!existing) {
    // 未知的终态运行不建气泡：刷新后由数据库里的最终消息 / 快照结果呈现。
    if (isTerminalStatus(event.status)) return state
    return withRun(state, fromEvent(event, revision))
  }
  // root 结束后服务端清空进程内计数器，DB 终态的 revision 可能比本地更小；
  // root 终态是最终状态，必须接受（child 仍按 revision 防旧终态盖续接）。
  const acceptingTerminalRoot = existing.parentRunId === null && isTerminalStatus(event.status)
  if (!acceptingTerminalRoot && isStale(existing, revision)) return state
  const nextRevision = Math.max(existing.revision, revision)
  if (isTerminalStatus(existing.status)) {
    // 终态粘滞：迟到的 RUNNING 不能复活（包括 round=0 的旧快照/事件）。
    if (!resumes(existing, event.status, event.round)) return state
    return withRun(state, {
      ...existing,
      status: 'RUNNING',
      round: event.round,
      segments: [],
      tools: [],
      result: null,
      revision: nextRevision,
    })
  }
  const round = Math.max(existing.round, event.round)
  if (event.status === 'CANCELLING')
    return withRun(state, { ...existing, status: 'CANCELLING', round, revision: nextRevision })
  if (!isTerminalStatus(event.status))
    return withRun(state, { ...existing, status: 'RUNNING', round, revision: nextRevision })
  return withRun(state, {
    ...existing,
    status: event.status,
    round,
    tools: existing.tools.filter((tool) => tool.state !== 'running'),
    revision: nextRevision,
  })
}

function applySnapshot(state: AgentRunsState, snapshot: AgentRunSnapshot): AgentRunsState {
  if (state.finalizedRoots[snapshot.rootRunId]) return state
  const existing = state.runs[snapshot.runId]
  if (!existing) {
    if (isTerminalStatus(snapshot.status)) {
      // 刷新/服务重启：后端只把残留运行标 FAILED，不一定补最终消息。
      // 只给触发消息在当前消息列表里、又没有最终消息的终态运行建气泡。
      if (!state.visibleTriggers[snapshot.triggerMessageId]) return state
      if (!snapshot.result && !snapshot.segments.length) return state
      if (snapshot.parentRunId && !state.runs[snapshot.parentRunId]) return state
    }
    return withRun(state, fromSnapshot(snapshot))
  }
  // root 的 DB 终态不受本地 revision 限制（结束后进程内 revision 归 0），
  // 但仍只用来收尾：保留已流式收到的正文，丢掉未完成的工具行。
  const acceptingTerminalRoot = existing.parentRunId === null && isTerminalStatus(snapshot.status)
  if (!acceptingTerminalRoot && isStale(existing, snapshot.revision)) return state
  const revision = Math.max(existing.revision, snapshot.revision)
  if (isTerminalStatus(existing.status)) {
    if (resumes(existing, snapshot.status, snapshot.round))
      return withRun(
        state,
        fromSnapshot(snapshot, {
          status: 'RUNNING',
          segments: [],
          tools: [],
          result: null,
          lastSeq: Math.max(existing.lastSeq, snapshot.seq),
          revision,
        }),
      )
    // 终态快照的 segments 通常已被服务端清理；保留已流式收到的正文，只补结果。
    return withRun(state, {
      ...existing,
      result: snapshot.result ?? existing.result,
      segments: existing.segments.length ? existing.segments : snapshot.segments,
      lastSeq: Math.max(existing.lastSeq, snapshot.seq),
      revision,
    })
  }
  if (isTerminalStatus(snapshot.status))
    return withRun(
      state,
      fromSnapshot(snapshot, {
        round: Math.max(existing.round, snapshot.round),
        segments: snapshot.segments.length ? snapshot.segments : existing.segments,
        tools: snapshot.tools.length
          ? snapshot.tools
          : existing.tools.filter((tool) => tool.state !== 'running'),
        lastSeq: Math.max(existing.lastSeq, snapshot.seq),
        result: snapshot.result ?? existing.result,
        revision,
      }),
    )
  // 旧 REST 快照可能晚于更新的 delta 到达：seq 不前进就只合状态，不覆盖正文。
  const fresher = snapshot.seq >= existing.lastSeq
  return withRun(
    state,
    fromSnapshot(snapshot, {
      round: Math.max(existing.round, snapshot.round),
      segments: fresher ? snapshot.segments : existing.segments,
      lastSeq: fresher ? snapshot.seq : existing.lastSeq,
      // 同一 revision 的旧快照已在上面的 isStale 拦下，这里 tools 就是当前执行中的工具。
      tools: snapshot.tools,
      revision,
    }),
  )
}

function appendText(run: AgentRun, round: number, text: string): AgentRunSegment[] {
  const index = run.segments.findIndex((segment) => segment.round === round)
  if (index < 0) return [...run.segments, { round, text }]
  return run.segments.map((segment, at) =>
    at === index ? { ...segment, text: segment.text + text } : segment,
  )
}

function applyDelta(state: AgentRunsState, event: AgentRunStreamEvent & { kind: 'delta' }) {
  if (state.finalizedRoots[event.run.rootRunId]) return state
  const existing = state.runs[event.run.runId]
  if (existing) {
    if (isTerminalStatus(existing.status)) return state
    // 每次 delta flush 都推进 revision；不大于本地就是重复/迟到投递，直接丢。
    if (event.revision <= existing.revision) return state
  }
  const run = existing ?? fromEvent(event.run, event.revision)
  if (event.seq <= run.lastSeq) return state
  if (event.seq > run.lastSeq + 1)
    // 跳号：不拼接，等快照整体替换；lastSeq 保持不动。
    return { ...state, resyncToken: state.resyncToken + 1 }
  return withRun(state, {
    ...run,
    status: isTerminalStatus(event.run.status) ? event.run.status : 'RUNNING',
    round: Math.max(run.round, event.run.round),
    segments: event.text ? appendText(run, event.run.round, event.text) : run.segments,
    lastSeq: event.seq,
    revision: event.revision,
  })
}

function applyTool(state: AgentRunsState, event: AgentRunStreamEvent & { kind: 'tool' }) {
  if (state.finalizedRoots[event.run.rootRunId]) return state
  const existing = state.runs[event.run.runId]
  // 没有 snapshot/updated 建起的运行上下文时不铺工具行，避免孤立气泡。
  if (!existing || isTerminalStatus(existing.status)) return state
  if (isStale(existing, event.revision)) return state
  // ok=true 才是成功；抛错/未知工具为 false；其它返回为 null（中性“结束”）。
  const outcome: AgentRunToolState =
    event.ok === true ? 'ok' : event.ok === false ? 'failed' : 'done'
  const toolState: AgentRunToolState = event.phase === 'started' ? 'running' : outcome
  const known = existing.tools.some((tool) => tool.toolCallId === event.toolCallId)
  const tools = known
    ? existing.tools.map((tool) =>
        tool.toolCallId === event.toolCallId ? { ...tool, state: toolState } : tool,
      )
    : [
        ...existing.tools,
        {
          toolCallId: event.toolCallId,
          tool: event.tool,
          round: event.run.round,
          state: toolState,
        },
      ]
  const nextStatus = isTerminalStatus(event.run.status) ? event.run.status : existing.status
  return withRun(state, {
    ...existing,
    status: nextStatus,
    round: Math.max(existing.round, event.run.round),
    tools: isTerminalStatus(nextStatus) ? tools.filter((tool) => tool.state !== 'running') : tools,
    revision: Math.max(existing.revision, event.revision),
  })
}

/**
 * 最终消息到达：只封存根运行，丢弃后续迟到事件。
 * 运行记录本身保留——聊天侧靠它渲染触发消息下方的运行卡与执行轨迹。
 */
function finalize(state: AgentRunsState, rootIds: string[]): AgentRunsState {
  const pending = rootIds.filter((rootId) => !state.finalizedRoots[rootId])
  if (!pending.length) return state
  const finalizedRoots = { ...state.finalizedRoots }
  for (const rootId of pending) finalizedRoots[rootId] = true
  return { ...state, finalizedRoots }
}

function setVisibleTriggers(state: AgentRunsState, triggerMessageIds: string[]): AgentRunsState {
  const next: Record<string, true> = {}
  for (const id of triggerMessageIds) next[id] = true
  const known = Object.keys(state.visibleTriggers)
  if (known.length === triggerMessageIds.length && known.every((id) => next[id])) return state
  return { ...state, visibleTriggers: next }
}

export function agentRunsReducer(state: AgentRunsState, action: AgentRunsAction): AgentRunsState {
  switch (action.type) {
    case 'stream': {
      const { event } = action
      if (event.kind === 'snapshot') return applySnapshot(state, event.run)
      if (event.kind === 'updated') return applyUpdated(state, event.run, event.revision)
      if (event.kind === 'delta') return applyDelta(state, event)
      return applyTool(state, event)
    }
    case 'snapshots':
      // 先处理根运行，子运行才可能挂到刚恢复的父运行下。
      return [...action.snapshots]
        .sort(
          (left, right) => Number(Boolean(left.parentRunId)) - Number(Boolean(right.parentRunId)),
        )
        .reduce(applySnapshot, state)
    case 'finalize':
      return finalize(state, action.rootIds)
    case 'messages':
      return setVisibleTriggers(state, action.triggerMessageIds)
    case 'reset':
      return EMPTY_STATE
  }
}

/** 稳定顺序：runId 是自增数字字符串；child 由调用方按 parentRunId 嵌套。 */
export function listAgentRuns(state: AgentRunsState): AgentRun[] {
  return Object.values(state.runs).sort((left, right) => {
    const a = Number(left.runId)
    const b = Number(right.runId)
    return Number.isFinite(a) && Number.isFinite(b) ? a - b : left.runId.localeCompare(right.runId)
  })
}
