import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AgentRunProgress } from './AgentRunProgress'
import type { AgentRun } from './types'

const identity = {
  parentRunId: null,
  rootRunId: '9001',
  projectId: 'p1',
  groupId: 'g1',
  agentId: '7',
  triggerMessageId: '8801',
  lastSeq: 0,
  revision: 1,
  createdAt: '2026-06-20T03:01:02.123Z',
}

function buildRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    runId: '9001',
    ...identity,
    status: 'RUNNING',
    round: 1,
    segments: [],
    tools: [],
    result: null,
    ...overrides,
  }
}

function renderMarkdown(text: string): ReactNode {
  return <span data-testid="markdown">{text}</span>
}

function renderRun(run: AgentRun, extra: Partial<Parameters<typeof AgentRunProgress>[0]> = {}) {
  return render(
    <AgentRunProgress run={run} agentName="Qgent" renderMarkdown={renderMarkdown} {...extra} />,
  )
}

describe('AgentRunProgress', () => {
  it('展示真实轮次、分段正文与工具阶段，并只在传入 onStop 时显示停止', async () => {
    const onStop = vi.fn()
    const run = buildRun({
      round: 2,
      segments: [
        { round: 1, text: '第一轮正文' },
        { round: 2, text: '第二轮正文' },
      ],
      tools: [{ toolCallId: 'call_a', tool: 'run_command', round: 2, state: 'running' }],
    })
    renderRun(run, { onStop })

    expect(screen.getByText('Qgent')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('执行中 · 第 2 轮')
    expect(screen.getByText('第一轮正文')).toBeInTheDocument()
    expect(screen.getByText('第二轮正文')).toBeInTheDocument()
    expect(screen.getByText('run_command').closest('li')).toHaveTextContent('执行中')

    await userEvent.click(screen.getByRole('button', { name: '停止Qgent的执行' }))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('没有 onStop 时不显示停止按钮', () => {
    renderRun(buildRun({ segments: [{ round: 1, text: '正文' }] }))
    expect(screen.queryByRole('button', { name: /停止/ })).toBeNull()
  })

  it('轮次默认展开（进行中），可折叠且互不影响', async () => {
    const run = buildRun({
      round: 2,
      segments: [
        { round: 1, text: '第一轮正文' },
        { round: 2, text: '第二轮正文' },
      ],
    })
    renderRun(run)
    const first = screen.getByRole('button', { name: /第 1 轮/ })
    expect(first).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('第一轮正文')).toBeNull()
    expect(screen.getByText('第二轮正文')).toBeInTheDocument()
  })

  it('停止中禁用按钮并显示状态，不伪造终态', () => {
    renderRun(buildRun({ status: 'CANCELLING', segments: [{ round: 1, text: '正文' }] }), {
      onStop: vi.fn(),
      stopping: true,
    })
    expect(screen.getByText('停止中')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: /停止Qgent的执行/ })
    expect(button).toBeDisabled()
  })

  it('失败时保留已输出正文、显示结果与重试指引，不显示停止', () => {
    renderRun(
      buildRun({
        status: 'FAILED',
        round: 1,
        segments: [{ round: 1, text: '半截正文' }],
        result: '服务重启，运行已中断',
      }),
      { onStop: vi.fn() },
    )
    expect(screen.getByText('失败')).toBeInTheDocument()
    expect(screen.getByText('半截正文')).toBeInTheDocument()
    expect(screen.getByText('服务重启，运行已中断')).toBeInTheDocument()
    expect(screen.getByText('执行失败，可重新 @ 该 Agent 重试。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /停止/ })).toBeNull()
  })

  it('终态只有 result 时作为过渡结果展示', () => {
    renderRun(buildRun({ status: 'SUCCEEDED', result: '最终答复正文' }))
    expect(screen.getByText('已完成')).toBeInTheDocument()
    expect(screen.getByText('最终答复正文')).toBeInTheDocument()
  })

  it('终态且没有正文/工具/结果时不渲染气泡', () => {
    const { container } = renderRun(buildRun({ status: 'SUCCEEDED' }))
    expect(container).toBeEmptyDOMElement()
  })

  it('工具完成/失败按各自 toolCallId 显示，子 Agent 嵌套展示', () => {
    const run = buildRun({
      tools: [
        { toolCallId: 'call_a', tool: 'run_command', round: 1, state: 'ok' },
        { toolCallId: 'call_b', tool: 'run_command', round: 1, state: 'failed' },
        { toolCallId: 'call_c', tool: 'read_attachment', round: 1, state: 'done' },
      ],
      round: 1,
    })
    const childRun = buildRun({
      runId: '9002',
      parentRunId: '9001',
      round: 1,
      segments: [{ round: 1, text: '子任务进展' }],
    })
    renderRun(run, { childrenRuns: [childRun] })

    expect(screen.getAllByText('run_command')).toHaveLength(2)
    expect(screen.getByText('完成')).toBeInTheDocument()
    expect(screen.getByText('失败')).toBeInTheDocument()
    expect(screen.getByText('结束')).toBeInTheDocument()
    expect(screen.getByText('子 Agent #9002')).toBeInTheDocument()
    expect(screen.getByText('子任务进展')).toBeInTheDocument()
  })
})
