import { Fragment } from 'react'
import { Button, Icon } from '@/components/ui'
import {
  isTerminalStatus,
  type AgentRun,
  type AgentRunTool,
  type AgentRunToolState,
} from '@/features/agent-runs/types'
import { runRounds } from './agentRunRows'

const STATUS_LABEL = {
  RUNNING: '运行中',
  CANCELLING: '停止中',
  CANCELLED: '已叫停',
  SUCCEEDED: '完成',
  FAILED: '失败',
} as const

const TONE = {
  RUNNING: 'running',
  CANCELLING: 'stopping',
  CANCELLED: 'stopped',
  SUCCEEDED: 'done',
  FAILED: 'fail',
} as const

const BEACON = {
  RUNNING: 'live',
  CANCELLING: 'halt',
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

const step = (value: number) => String(value).padStart(2, '0')

/**
 * Agent 消息行里的一张运行卡：实时状态灯、步骤徽章、停止按钮与可折叠的工具时间线。
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
  const rounds = runRounds(run)
  const lastRound = rounds.at(-1)?.round
  const hasProgress = rounds.some(
    ({ round, text, tools }) => text.trim() && (tools.length > 0 || round !== lastRound),
  )
  let toolIndex = 0
  return (
    <section
      className={`run run--${TONE[run.status]}`}
      aria-label={`${agentName ?? 'Agent'} 运行状态`}
    >
      <div className="run__head">
        <span className={`run__beacon run__beacon--${BEACON[run.status]}`} aria-hidden>
          <span className="run__beacon-core" />
        </span>
        <span className="run__state">{STATUS_LABEL[run.status]}</span>
        {agentName ? <span className="run__agent">{agentName}</span> : null}
        {run.parentRunId ? <span className="meta">子 Agent</span> : null}
        <span className="run__meta">
          {steps ? `${steps} 个工具调用` : running ? '正在读取上下文' : '无工具调用'}
        </span>
        {running && onStop ? (
          <Button
            variant="quiet"
            size="sm"
            className="run__stop"
            icon={<Icon name="stop" size={11} />}
            onClick={onStop}
            disabled={stopping}
          >
            {stopping ? '停止中' : '停止'}
          </Button>
        ) : null}
      </div>
      {steps || hasProgress ? (
        <details className="run__tools" open={running}>
          <summary className="run__tools-summary">
            <span className="run__tools-title">
              <Icon name="activity" size={13} />
              {hasProgress ? '执行进度' : '工具调用'}
              {steps ? <span className="run__tools-count mono">{steps}</span> : null}
            </span>
            <span className="run__tools-chevron" aria-hidden>
              <Icon name="chevron" size={14} />
            </span>
          </summary>
          <ol className="run__timeline">
            {rounds.map(({ round, text, tools }) => (
              <Fragment key={round}>
                {text.trim() && (tools.length > 0 || round !== lastRound) ? (
                  <li className="run__progress">
                    <p className="run__progress-text">{text}</p>
                  </li>
                ) : null}
                {tools.map((tool) => (
                  <ToolItem key={tool.toolCallId} tool={tool} index={++toolIndex} />
                ))}
              </Fragment>
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
  const expandable = Boolean(tool.input || tool.output)
  const head = (
    <>
      <span className="tool__step mono">{step(index)}</span>
      <span className="tool__name mono" title={tool.tool}>
        {tool.tool}
      </span>
      <span className={`tool__state tool__state--${tool.state}`}>{TOOL_LABEL[tool.state]}</span>
      <span className="tool__round">第 {tool.round} 轮</span>
      {expandable ? (
        <span className="tool__chevron" aria-hidden>
          <Icon name="chevron" size={12} />
        </span>
      ) : null}
    </>
  )
  // 没有详情可展开时不做可点击的假开关。
  if (!expandable)
    return <li className={`tool tool--plain tool--${tool.state}`}>{head}</li>
  return (
    <li className={`tool tool--${tool.state}`}>
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
