import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { agentRunHandlers } from './agentRuns'

const server = setupServer(...agentRunHandlers)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const base = location.origin

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
    const abort = new AbortController()
    const response = await fetch(`${base}/api/projects/2/groups/901/agent-events`, {
      signal: abort.signal,
    })
    expect(response.headers.get('content-type')).toContain('text/event-stream')

    const reader = response.body?.getReader()
    if (!reader) throw new Error('missing SSE body')
    const decoder = new TextDecoder()
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
})
