import { Button, Icon } from '@/components/ui'
import {
  isTerminalStatus,
  type AgentRun,
  type AgentRunTool,
  type AgentRunToolState,
} from '@/features/agent-runs/types'

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
 * Agent 消息行里的一张运行卡：状态、停止按钮与可展开的工具时间线。
 * 流式正文不放进这个框——它在卡片下方用和最终消息相同的正文容器渲染，
 * 最终消息到达时正文原地换文本，不会从盒子里跳出来。
 */
export function RunCard({
  run,
  agentName,
  onStop,
  stopping,
  replied,
}: {
  run: AgentRun
  agentName?: string
  onStop?: () => void
  stopping?: boolean
  /** 这一轮的最终消息已经入库：失败提示交给正文，不在卡片上重复。 */
  replied?: boolean
}) {
  const running = !isTerminalStatus(run.status)
  const steps = run.tools.length
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
      {/* 没有最终消息时，失败原因只能留在这里说明白。 */}
      {!replied && run.status === 'FAILED' && run.result ? (
        <p className="run__note">{run.result}</p>
      ) : null}
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
