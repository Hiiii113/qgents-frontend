import { Button, Icon } from '@/components/ui'
import {
  isTerminalStatus,
  type AgentRun,
  type AgentRunTool,
  type AgentRunToolState,
} from '@/features/agent-runs/types'
import { LazyChatMarkdown } from './LazyChatMarkdown'

const STATUS_LABEL = {
  RUNNING: '运行中',
  CANCELLING: '停止中',
  CANCELLED: '已叫停',
  SUCCEEDED: '完成',
  FAILED: '失败',
} as const

const TONE = {
  RUNNING: 'running',
  CANCELLING: 'running',
  CANCELLED: 'stopped',
  SUCCEEDED: 'done',
  FAILED: 'fail',
} as const

const DOT = {
  RUNNING: 'live',
  CANCELLING: 'live',
  CANCELLED: 'halt',
  SUCCEEDED: 'ok',
  FAILED: 'fail',
} as const

const TOOL_LABEL: Record<AgentRunToolState, string> = {
  running: '执行中',
  ok: '完成',
  failed: '失败',
  done: '结束',
}

/**
 * 触发消息下方的一张运行卡：状态、工具调用列表，以及每次调用的入参与结果。
 * 运行中默认展开工具列表，结束后收起，历史不会在对话里铺开。
 */
export function RunCard({
  run,
  agentName,
  onStop,
  stopping,
}: {
  run: AgentRun
  agentName?: string
  onStop?: () => void
  stopping?: boolean
}) {
  const running = !isTerminalStatus(run.status)
  const steps = run.tools.length
  // 最终消息到达后服务端会清空正文分段，这里只在运行中展示本轮流式回复。
  const liveText = running ? run.segments.map((segment) => segment.text).join('') : ''
  return (
    <section
      className={`run run--${TONE[run.status]}`}
      aria-label={`${agentName ?? 'Agent'} 运行状态`}
    >
      <div className="run__head">
        <span className={`dot dot--${DOT[run.status]}`} aria-hidden />
        <span className="run__state">{STATUS_LABEL[run.status]}</span>
        {agentName ? <span className="meta">{agentName}</span> : null}
        {run.parentRunId ? <span className="meta">子 Agent</span> : null}
        <span className="run__meta">
          {steps ? `${steps} 个工具调用` : running ? '正在读取上下文' : '无工具调用'}
          {run.status === 'CANCELLING' ? ' · 已请求停止' : ''}
        </span>
        {running && onStop ? (
          <Button
            variant="link"
            icon={<Icon name="stop" size={14} />}
            onClick={onStop}
            disabled={stopping}
          >
            {stopping ? '停止中…' : '停止'}
          </Button>
        ) : null}
      </div>
      {steps ? (
        <details className="run__tools" open={running}>
          <summary className="run__tools-summary">
            工具调用
            <Icon name="chevron" size={14} aria-hidden />
          </summary>
          <ol className="run__tool-list">
            {run.tools.map((tool, index) => (
              <ToolItem key={tool.toolCallId} tool={tool} index={index + 1} />
            ))}
          </ol>
        </details>
      ) : null}
      {liveText ? (
        <div className="run__live">
          <p className="run__live-label">本轮回复</p>
          <LazyChatMarkdown text={liveText} />
        </div>
      ) : null}
      {run.status === 'FAILED' && run.result ? <p className="run__note">{run.result}</p> : null}
    </section>
  )
}

function ToolItem({ tool, index }: { tool: AgentRunTool; index: number }) {
  const head = (
    <>
      <span className="tool__i mono">{index}</span>
      <span className="tool__name mono">{tool.tool}</span>
      <span className={`tool__state tool__state--${tool.state}`}>{TOOL_LABEL[tool.state]}</span>
      <span className="tool__round">第 {tool.round} 轮</span>
    </>
  )
  // 没有详情可展开时不做可点击的假开关。
  if (!tool.input && !tool.output)
    return <li className="tool tool--plain">{head}</li>
  return (
    <li className="tool">
      <details className="tool__detail">
        <summary className="tool__summary">{head}</summary>
        <div className="tool__body">
          {tool.input ? (
            <>
              <p className="tool__label">入参</p>
              <pre className="tool__pre mono">{tool.input}</pre>
            </>
          ) : null}
          {tool.output ? (
            <>
              <p className="tool__label">结果</p>
              <pre className="tool__pre mono">{tool.output}</pre>
            </>
          ) : null}
        </div>
      </details>
    </li>
  )
}
