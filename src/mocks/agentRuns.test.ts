import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { agentRunHandlers, resetAgentRunDemo } from './agentRuns'

const server = setupServer(...agentRunHandlers)

beforeAll(() => server.listen())
beforeEach(() => resetAgentRunDemo())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const base = location.origin
const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

interface DemoRun {
  runId: string
  status: string
  seq: number
  result: string | null
  segments: { round: number; text: string }[]
  tools: { state: string }[]
}

async function fetchDemo(): Promise<DemoRun[]> {
  const response = await fetch(`${base}/api/projects/2/agent-runs?groupId=901`)
  const body = (await response.json()) as { data: DemoRun[] }
  return body.data
}

/** mock 没有 WS：前端靠 1s 轮询快照推进，这里用更密的轮询等待目标状态。 */
async function waitForDemo(
  predicate: (runs: DemoRun[]) => boolean,
  timeoutMs = 8000,
): Promise<DemoRun[]> {
  const deadline = Date.now() + timeoutMs
  let runs = await fetchDemo()
  while (!predicate(runs)) {
    if (Date.now() > deadline)
      throw new Error(`演示运行未到达预期状态：${JSON.stringify(runs)}`)
    await wait(100)
    runs = await fetchDemo()
  }
  return runs
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

  it('演示群快照随轮询推进，直到根/子运行都成功', async () => {
    const initial = await fetchDemo()
    expect(initial.every((run) => run.segments.length === 0)).toBe(true)

    const runs = await waitForDemo((list) => list.every((run) => run.status === 'SUCCEEDED'))
    const root = runs.find((run) => run.runId === '9001')
    const child = runs.find((run) => run.runId === '9002')
    expect(root?.segments.length).toBeGreaterThan(0)
    expect(root?.tools.length).toBeGreaterThan(0)
    expect(root?.tools.every((tool) => tool.state !== 'running')).toBe(true)
    expect(root?.result).toContain('clientMessageId')
    expect(child?.segments.length).toBeGreaterThan(0)
  }, 15_000)

  it('演示流响应停止：取消后 root/child 置 CANCELLED 且不再产生新 delta', async () => {
    await waitForDemo((list) => list.some((run) => run.segments.length > 0))
    const before = await fetchDemo()

    const cancel = await fetch(`${base}/api/projects/2/groups/901/messages/9011/cancel-agent`, {
      method: 'POST',
    })
    const cancelled = (await cancel.json()) as { data: { cancelledRuns: number } }
    expect(cancelled.data.cancelledRuns).toBe(1)

    const stopped = await fetchDemo()
    expect(stopped.every((run) => run.status === 'CANCELLED')).toBe(true)
    expect(stopped.every((run) => run.tools.every((tool) => tool.state !== 'running'))).toBe(true)

    // 取消后再观察约 1.2s：足够覆盖演示流下一步，若仍在播放 seq 会继续增长。
    await wait(1200)
    const after = await fetchDemo()
    expect(after.map((run) => [run.status, run.seq])).toEqual(
      stopped.map((run) => [run.status, run.seq]),
    )
    expect(Math.max(...after.map((run) => run.seq))).toBeGreaterThanOrEqual(
      Math.max(...before.map((run) => run.seq)),
    )
  }, 15_000)
})
