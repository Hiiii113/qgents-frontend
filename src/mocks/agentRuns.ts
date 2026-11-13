import { http, HttpResponse } from 'msw'
import { projectAgents } from './agents'
import type { AgentRunSegment, AgentRunStatus, AgentRunTool } from '@/features/agent-runs'

/**
 * Mock 演示用的真实 Agent 运行流：固定群 901（project '2'）。
 * 与聊天 mock 的 seedAgentRunDemo() 共用群/触发消息 ID；其它群只建连、不播事件。
 */
export const AGENT_RUN_DEMO = {
  projectId: '2',
  groupId: '901',
  triggerMessageId: '9011',
} as const

const ROOT_RUN_ID = '9001'
const CHILD_RUN_ID = '9002'
const HEARTBEAT_MS = 15_000
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

/** 演示运行的当前真状态：REST 快照与 SSE 建连都读它，断线/重新进入不会回到假的 RUNNING。 */
const demo = { started: false, root: createLive(), child: createLive() }
const listeners = new Set<(event: string, data: unknown) => void>()

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

function broadcast(event: string, data: unknown): void {
  for (const listener of listeners) listener(event, data)
}

function appendDelta(runId: string, text: string): RunEvent {
  const live = liveOf(runId)
  live.revision += 1
  live.seq += 1
  const segment = live.segments.find((item) => item.round === live.round)
  if (segment) segment.text += text
  else live.segments.push({ round: live.round, text })
  broadcast('agent-run.delta', { ...liveEvent(runId), seq: live.seq, text })
  return liveEvent(runId)
}

function startTool(runId: string, toolCallId: string, tool: string): void {
  const live = liveOf(runId)
  live.revision += 1
  live.tools.push({ toolCallId, tool, round: live.round, state: 'running' })
  broadcast('agent-run.tool', {
    ...liveEvent(runId),
    phase: 'started',
    toolCallId,
    tool,
    ok: null,
  })
}

function finishTool(runId: string, toolCallId: string, tool: string, ok: boolean): void {
  const live = liveOf(runId)
  live.revision += 1
  const entry = live.tools.find((item) => item.toolCallId === toolCallId)
  if (entry) entry.state = ok ? 'ok' : 'failed'
  broadcast('agent-run.tool', { ...liveEvent(runId), phase: 'finished', toolCallId, tool, ok })
}

function startRound(runId: string, round: number): void {
  const live = liveOf(runId)
  live.round = round
  live.revision += 1
  broadcast('agent-run.updated', liveEvent(runId))
}

function finishRun(runId: string, status: AgentRunStatus, result: string | null = null): void {
  const live = liveOf(runId)
  live.status = status
  live.revision += 1
  if (result) live.result = result
  live.tools = live.tools.filter((tool) => tool.state !== 'running')
  broadcast('agent-run.updated', liveEvent(runId))
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

/** 只播一次；断线时状态继续推进，重连/重新进入拿当前快照而不是从头重放。 */
async function playDemo(): Promise<void> {
  await wait(STEP_MS)
  appendDelta(ROOT_RUN_ID, '我先看一下仓库结构和消息渲染，确认流式运行应该挂在哪里。')
  await wait(STEP_MS)

  startTool(ROOT_RUN_ID, 'call_demo_1', 'run_command')
  appendDelta(CHILD_RUN_ID, '子任务：检查虚拟列表在动态高度消息下的定位。')
  await wait(STEP_MS)

  finishTool(ROOT_RUN_ID, 'call_demo_1', 'run_command', true)
  startRound(ROOT_RUN_ID, 2)
  await wait(STEP_MS)

  appendDelta(ROOT_RUN_ID, '确认了：运行进度要紧跟触发消息，并复用真实的 Markdown 渲染。')
  startTool(CHILD_RUN_ID, 'call_demo_2', 'read_attachment')
  await wait(STEP_MS)

  finishTool(CHILD_RUN_ID, 'call_demo_2', 'read_attachment', true)
  appendDelta(CHILD_RUN_ID, '虚拟列表已按消息 ID 定位，新增长度不会打断阅读位置。')
  finishRun(CHILD_RUN_ID, 'SUCCEEDED')
  await wait(STEP_MS)

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
  await appendFinalMessage(
    '**已完成**：先按 runId 渲染临时气泡，最终消息到达后由 clientMessageId 替换。',
  )
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

function eventStreamResponse(request: Request): Response {
  const encoder = new TextEncoder()
  const groupId = new URL(request.url).pathname.split('/').at(-2)
  const isDemo = groupId === AGENT_RUN_DEMO.groupId
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let cancelled = request.signal.aborted
      const onAbort = () => {
        cancelled = true
      }
      request.signal.addEventListener('abort', onAbort)
      const send = (event: string, data: unknown) => {
        if (cancelled) return
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      const listener = (event: string, data: unknown) => send(event, data)
      try {
        controller.enqueue(encoder.encode(': connected\n\n'))
        if (isDemo) {
          // 建连先给当前真状态（可能已在执行中/已完成），再订阅后续事件。
          send('agent-run.snapshot', { run: snapshotOf(ROOT_RUN_ID) })
          send('agent-run.snapshot', { run: snapshotOf(CHILD_RUN_ID) })
          listeners.add(listener)
          if (!demo.started) {
            demo.started = true
            void playDemo()
          }
        }
        while (!cancelled) {
          await wait(HEARTBEAT_MS)
          if (cancelled) break
          controller.enqueue(encoder.encode(': ping\n\n'))
        }
      } catch {
        // 客户端断开后不再推送
      } finally {
        listeners.delete(listener)
        request.signal.removeEventListener('abort', onAbort)
        try {
          controller.close()
        } catch {
          // 已取消的流不能再 close
        }
      }
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' },
  })
}

export const agentRunHandlers = [
  http.get('/api/projects/:projectId/agent-runs', ({ request }) => {
    const groupId = new URL(request.url).searchParams.get('groupId')
    const data =
      groupId === AGENT_RUN_DEMO.groupId ? [snapshotOf(ROOT_RUN_ID), snapshotOf(CHILD_RUN_ID)] : []
    return HttpResponse.json({ data })
  }),
  http.get('/api/projects/:projectId/groups/:groupId/agent-events', ({ request }) =>
    eventStreamResponse(request),
  ),
]
