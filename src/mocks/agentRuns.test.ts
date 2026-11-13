import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { agentRunHandlers, resetAgentRunDemo } from './agentRuns'

const server = setupServer(...agentRunHandlers)

beforeAll(() => server.listen())
beforeEach(() => resetAgentRunDemo())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const base = location.origin
const decoder = new TextDecoder()
const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

async function openDemoStream() {
  const abort = new AbortController()
  const response = await fetch(`${base}/api/projects/2/groups/901/agent-events`, {
    signal: abort.signal,
  })
  expect(response.headers.get('content-type')).toContain('text/event-stream')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('missing SSE body')
  return { abort, reader }
}

describe('Agent 运行 mock', () => {
  it('演示群返回根+子运行快照，其它群为空', async () => {
    const demo = await fetch(`${base}/api/projects/2/agent-runs?groupId=901`)
    const demoBody = (await demo.json()) as { data: Record<string, unknown>[] }
    expect(demoBody.data).toHaveLength(2)
    expect(demoBody.data[0]).toMatchObject({
      runId: '9001',
      rootRunId: '9001',
      triggerMessageId: '9011',
      status: 'RUNNING',
    })

    const empty = await fetch(`${base}/api/projects/1/agent-runs?groupId=1`)
    expect(((await empty.json()) as { data: unknown[] }).data).toEqual([])
  })

  it('演示群 SSE 建连即推 snapshot，随后流式推 delta', async () => {
    const { abort, reader } = await openDemoStream()
    let received = ''
    while (!received.includes('agent-run.delta')) {
      const { value, done } = await reader.read()
      if (done) break
      received += decoder.decode(value, { stream: true })
    }
    abort.abort()
    // MSW node 下 abort 后的 cancel() 可能永不 resolve；流已被 abort，无需等待。
    void reader.cancel().catch(() => {})

    expect(received).toContain('event: agent-run.snapshot')
    expect(received).toContain('"runId":"9002"')
    expect(received).toContain('event: agent-run.delta')
  }, 10_000)

  it('演示流响应停止：取消后 root/child 置 CANCELLED 且不再产生新 delta', async () => {
    const { abort, reader } = await openDemoStream()
    let received = ''
    while (!received.includes('agent-run.delta')) {
      const { value, done } = await reader.read()
      if (done) break
      received += decoder.decode(value, { stream: true })
    }
    expect(received).toContain('agent-run.delta')

    const cancel = await fetch(`${base}/api/projects/2/groups/901/messages/9011/cancel-agent`, {
      method: 'POST',
    })
    const cancelled = (await cancel.json()) as { data: { cancelledRuns: number } }
    expect(cancelled.data.cancelledRuns).toBe(1)

    // 取消后再观察约 1.2s：足够覆盖演示流下一批步骤，若仍播放会出现新 delta。
    const deadline = Date.now() + 1200
    while (Date.now() < deadline) {
      const next = await Promise.race([reader.read(), wait(150).then(() => null)])
      if (!next || next.done) continue
      received += decoder.decode(next.value, { stream: true })
    }
    abort.abort()
    void reader.cancel().catch(() => {})

    expect(received.match(/"status":"CANCELLED"/g)).toHaveLength(2)
    // CANCELLED 之后（含子运行完成前已入队的 delta 之后）不再有正文增量。
    const afterCancel = received.slice(received.lastIndexOf('"status":"CANCELLED"'))
    expect(afterCancel).not.toContain('event: agent-run.delta')

    const snapshot = await fetch(`${base}/api/projects/2/agent-runs?groupId=901`)
    const runs = ((await snapshot.json()) as { data: { status: string; tools: unknown[] }[] }).data
    expect(runs).toHaveLength(2)
    expect(runs.every((run) => run.status === 'CANCELLED')).toBe(true)
    expect(runs.every((run) => run.tools.length === 0)).toBe(true)
  }, 15_000)
})
