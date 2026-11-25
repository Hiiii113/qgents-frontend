import { http, HttpResponse } from 'msw'
import { projectAgents } from './agents'
import type { AgentRunSegment, AgentRunStatus, AgentRunTool } from '@/features/agent-runs'

/**
 * Mock 演示用的 Agent 运行：固定群 901（project '2'）。
 * 与聊天 mock 的 seedAgentRunDemo() 共用群/触发消息 ID。
 * mock 没有 WS 端点：演示由 REST 快照请求启动，前端在 WS 未连接时按 1s 轮询快照推进。
 */
export const AGENT_RUN_DEMO = {
  projectId: '2',
  groupId: '901',
  triggerMessageId: '9011',
} as const

const ROOT_RUN_ID = '9001'
const CHILD_RUN_ID = '9002'
const STEP_MS = 300

type RunEvent = Record<string, unknown>

interface DemoLive {
  status: AgentRunStatus
  round: number
  seq: number
  revision: number
  segments: AgentRunSegment[]
  tools: AgentRunTool[]
  result: string | null
  createdAt: string
}

function createLive(): DemoLive {
  return {
    status: 'RUNNING',
    round: 1,
    seq: 0,
    revision: 0,
    segments: [],
    tools: [],
    result: null,
    createdAt: new Date().toISOString(),
  }
}

/** 演示运行的当前真状态：每次 REST 快照都读它，重新进入不会回到假的 RUNNING。 */
const demo = {
  started: false,
  cancelled: false,
  generation: 0,
  root: createLive(),
  child: createLive(),
}

/** 运行结束时未收到 finished 的工具按中性结束收尾，与真实后端一致。 */
function settleTools(tools: AgentRunTool[]): AgentRunTool[] {
  return tools.map((tool) => (tool.state === 'running' ? { ...tool, state: 'done' } : tool))
}

/** 仅 mock 测试使用：复位演示状态并让仍在跑的播放循环失效。 */
export function resetAgentRunDemo(): void {
  demo.generation += 1
  demo.started = false
  demo.cancelled = false
  Object.assign(demo.root, createLive())
  Object.assign(demo.child, createLive())
}

function liveOf(runId: string): DemoLive {
  return runId === ROOT_RUN_ID ? demo.root : demo.child
}

function parentOf(runId: string): string | null {
  return runId === CHILD_RUN_ID ? ROOT_RUN_ID : null
}

function demoAgentId(): string {
  return projectAgents(AGENT_RUN_DEMO.projectId).find((agent) => agent.defaultAgent)?.id ?? ''
}

function liveEvent(runId: string): RunEvent {
  const live = liveOf(runId)
  return {
    runId,
    parentRunId: parentOf(runId),
    rootRunId: ROOT_RUN_ID,
    projectId: AGENT_RUN_DEMO.projectId,
    groupId: AGENT_RUN_DEMO.groupId,
    agentId: demoAgentId(),
    triggerMessageId: AGENT_RUN_DEMO.triggerMessageId,
    status: live.status,
    round: live.round,
    revision: live.revision,
  }
}

function snapshotOf(runId: string): RunEvent {
  const live = liveOf(runId)
  return {
    ...liveEvent(runId),
    seq: live.seq,
    segments: live.segments,
    tools: live.tools,
    result: live.result,
    createdAt: live.createdAt,
    finishedAt: null,
  }
}

function appendDelta(runId: string, text: string): RunEvent {
  const live = liveOf(runId)
  live.revision += 1
  live.seq += 1
  const segment = live.segments.find((item) => item.round === live.round)
  if (segment) segment.text += text
  else live.segments.push({ round: live.round, text })
  return liveEvent(runId)
}

function startTool(runId: string, toolCallId: string, tool: string, input: string): void {
  const live = liveOf(runId)
  live.revision += 1
  live.tools.push({ toolCallId, tool, round: live.round, state: 'running', input, output: null })
}

function finishTool(runId: string, toolCallId: string, ok: boolean, output: string): void {
  const live = liveOf(runId)
  live.revision += 1
  const entry = live.tools.find((item) => item.toolCallId === toolCallId)
  if (entry) {
    entry.state = ok ? 'ok' : 'failed'
    entry.output = output
  }
}

function startRound(runId: string, round: number): void {
  const live = liveOf(runId)
  live.round = round
  live.revision += 1
}

function finishRun(runId: string, status: AgentRunStatus, result: string | null = null): void {
  const live = liveOf(runId)
  live.status = status
  live.revision += 1
  if (result) live.result = result
  live.tools = settleTools(live.tools)
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

/** 只播一次；轮询拿到的快照被动跟随推进，重新进入不会从头重放。 */
async function playDemo(generation: number): Promise<void> {
  const alive = () => generation === demo.generation && !demo.cancelled
  await wait(STEP_MS)
  if (!alive()) return
  appendDelta(ROOT_RUN_ID, '我先看一下仓库结构和消息渲染，确认流式运行应该挂在哪里。')
  await wait(STEP_MS)
  if (!alive()) return

  startTool(ROOT_RUN_ID, 'call_demo_1', 'run_command', '{"command":"ls -R src"}')
  appendDelta(CHILD_RUN_ID, '子任务：检查虚拟列表在动态高度消息下的定位。')
  await wait(STEP_MS)
  if (!alive()) return

  finishTool(ROOT_RUN_ID, 'call_demo_1', true, 'src/api\nsrc/components\nsrc/features/agent-runs')
  startRound(ROOT_RUN_ID, 2)
  await wait(STEP_MS)
  if (!alive()) return

  appendDelta(ROOT_RUN_ID, '确认了：运行进度要紧跟触发消息，并复用真实的 Markdown 渲染。')
  startTool(CHILD_RUN_ID, 'call_demo_2', 'read_attachment', '{"attachmentId":"att_9"}')
  await wait(STEP_MS)
  if (!alive()) return

  finishTool(CHILD_RUN_ID, 'call_demo_2', true, '虚拟列表按消息 ID 定位，新增长度不打断阅读位置。')
  appendDelta(CHILD_RUN_ID, '虚拟列表已按消息 ID 定位，新增长度不会打断阅读位置。')
  finishRun(CHILD_RUN_ID, 'SUCCEEDED')
  await wait(STEP_MS)
  if (!alive()) return

  appendDelta(
    ROOT_RUN_ID,
    '\n\n建议：先按 runId 渲染临时气泡，最终消息到达后由 clientMessageId 替换。',
  )
  finishRun(
    ROOT_RUN_ID,
    'SUCCEEDED',
    '建议：先按 runId 渲染临时气泡，最终消息到达后由 clientMessageId 替换。',
  )
  await wait(STEP_MS)
  if (!alive()) return
  await appendFinalMessage(
    '**已完成**：先按 runId 渲染临时气泡，最终消息到达后由 clientMessageId 替换。',
  )
}

/** 停止演示流：root/child 置 CANCELLED 并推事件；cancelledRuns 按触发消息的根运行计。 */
function cancelDemo(): number {
  demo.cancelled = true
  const cancel = (runId: string): boolean => {
    const live = liveOf(runId)
    if (live.status !== 'RUNNING' && live.status !== 'CANCELLING') return false
    live.status = 'CANCELLED'
    live.revision += 1
    live.tools = settleTools(live.tools)
    return true
  }
  const rootCancelled = cancel(ROOT_RUN_ID)
  cancel(CHILD_RUN_ID)
  return rootCancelled ? 1 : 0
}

interface DemoReplyInput {
  rootRunId: string
  agentId: string
  agentName: string
  text: string
}

/**
 * 聊天 mock 的 appendDemoReply 由聊天侧提供（固定演示群 901）。
 * 懒加载 + 可选调用：两边 worktree 独立时可各自编译，合入后演示自动替换临时气泡。
 */
async function appendFinalMessage(text: string): Promise<void> {
  const module = (await import('./projectChat')) as unknown as {
    appendDemoReply?: (input: DemoReplyInput) => unknown
  }
  module.appendDemoReply?.({
    rootRunId: ROOT_RUN_ID,
    agentId: demoAgentId(),
    agentName: 'Qgent',
    text,
  })
}

export const agentRunHandlers = [
  http.get('/api/projects/:projectId/agent-runs', ({ request }) => {
    const groupId = new URL(request.url).searchParams.get('groupId')
    if (groupId !== AGENT_RUN_DEMO.groupId) return HttpResponse.json({ data: [] })
    // 第一次拉演示群快照时开始播放；后续轮询看到的就是被推进的状态。
    if (!demo.started) {
      demo.started = true
      void playDemo(demo.generation)
    }
    return HttpResponse.json({ data: [snapshotOf(ROOT_RUN_ID), snapshotOf(CHILD_RUN_ID)] })
  }),
  // 字面量群 ID 只接管演示群，其它群的停止仍由聊天 mock 处理。
  http.post('/api/projects/:projectId/groups/901/messages/:messageId/cancel-agent', () =>
    HttpResponse.json({ data: { cancelledRuns: cancelDemo() } }),
  ),
]
