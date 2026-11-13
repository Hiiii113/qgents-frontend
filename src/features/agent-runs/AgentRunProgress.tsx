import { memo, useMemo, useState, type ReactNode } from 'react'
import { Button } from 'antd'
import { StopOutlined } from '@ant-design/icons'
import {
  isTerminalStatus,
  type AgentRun,
  type AgentRunStatus,
  type AgentRunTool,
  type AgentRunToolState,
} from './types'
import './AgentRunProgress.css'

export interface AgentRunProgressProps {
  run: AgentRun
  /** 子 Agent 运行，嵌套在父运行下；不传给子运行的 onStop（停止按触发消息整组取消）。 */
  childrenRuns?: AgentRun[]
  agentName?: string
  /** 聊天侧的 ChatMarkdown：(text) => ReactNode；流式半截 Markdown 由它兜住。 */
  renderMarkdown: (text: string) => ReactNode
  /** 只有根运行运行中/停止中且有该回调时才显示停止按钮。 */
  onStop?: () => void
  stopping?: boolean
}

interface RoundView {
  round: number
  text: string
  tools: AgentRunTool[]
}

const TOOL_STATE_LABELS: Record<AgentRunToolState, string> = {
  running: '执行中',
  ok: '完成',
  failed: '失败',
  done: '结束',
}

const STATUS_LABELS: Record<AgentRunStatus, string> = {
  RUNNING: '执行中',
  CANCELLING: '停止中',
  CANCELLED: '已停止',
  SUCCEEDED: '已完成',
  FAILED: '失败',
}

/** 一轮的动作摘要：最后一个工具的调用名，没有工具就说明在出正文。 */
function roundAction(round: RoundView): string {
  const last = round.tools[round.tools.length - 1]
  if (last) return last.tool
  if (round.text) return '输出正文'
  return '等待输出'
}

/** 一轮的状态：正在跑的那轮说进行中，否则沿用最后一个工具的终态。 */
function roundState(round: RoundView, active: boolean): string {
  if (active) return '进行中'
  const last = round.tools[round.tools.length - 1]
  if (last) return TOOL_STATE_LABELS[last.state]
  return round.text ? '完成' : '等待'
}

function buildRounds(run: AgentRun): RoundView[] {
  const rounds = new Map<number, RoundView>()
  const view = (round: number): RoundView => {
    const existing = rounds.get(round)
    if (existing) return existing
    const created: RoundView = { round, text: '', tools: [] }
    rounds.set(round, created)
    return created
  }
  for (const segment of run.segments) if (segment.text) view(segment.round).text += segment.text
  for (const tool of run.tools) view(tool.round).tools.push(tool)
  return [...rounds.values()].sort((left, right) => left.round - right.round)
}

/** Agent 一次运行的可见进度：真实轮次/工具阶段 + 分段正文，不伪造打字与思考链。 */
export const AgentRunProgress = memo(function AgentRunProgress({
  run,
  childrenRuns,
  agentName,
  renderMarkdown,
  onStop,
  stopping = false,
}: AgentRunProgressProps) {
  const [collapsedRounds, setCollapsedRounds] = useState<number[]>([])
  const rounds = useMemo(() => buildRounds(run), [run])
  const terminal = isTerminalStatus(run.status)
  const running = run.status === 'RUNNING' || run.status === 'CANCELLING'
  const hasText = rounds.some((round) => round.text)
  // 终态结果只作最终消息到达前的过渡；已有流式正文时不重复整段结果。
  const resultText = run.result && (run.status === 'FAILED' || !hasText) ? run.result : null
  const child = run.parentRunId !== null
  const title = child ? `子 Agent #${run.runId}` : agentName || 'Agent'

  if (terminal && !rounds.length && !resultText) return null

  return (
    <section
      className={`qg-agent-run${child ? ' qg-agent-run--child' : ''}`}
      aria-label={`${title} 执行进度`}
    >
      <header className="qg-agent-run__head">
        <span className="qg-agent-run__name">{title}</span>
        <span
          className={`qg-agent-run__status qg-agent-run__status--${run.status.toLowerCase()}`}
          role="status"
        >
          {STATUS_LABELS[run.status]}
          {running && run.round > 0 ? ` · 第 ${run.round} 轮` : null}
        </span>
        {onStop && running ? (
          <Button
            className="qg-agent-run__stop"
            size="small"
            icon={stopping ? undefined : <StopOutlined aria-hidden />}
            loading={stopping}
            disabled={stopping}
            onClick={onStop}
            aria-label={`停止${title}的执行`}
          >
            {stopping ? '停止中' : '停止'}
          </Button>
        ) : null}
      </header>

      {!rounds.length && running ? <p className="qg-agent-run__waiting">正在准备…</p> : null}

      {rounds.length ? (
        <div className="qg-agent-run__cols" aria-hidden>
          <span />
          <span>轮次</span>
          <span>动作</span>
          <span>状态</span>
        </div>
      ) : null}

      <div className="qg-agent-run__rounds">
        {rounds.map((round) => {
          const open = !collapsedRounds.includes(round.round)
          const activeTool = running && round.round === run.round
          return (
            <section className="qg-agent-run__round" key={round.round}>
              <button
                type="button"
                className="qg-agent-run__round-toggle"
                aria-expanded={open}
                onClick={() =>
                  setCollapsedRounds((previous) =>
                    previous.includes(round.round)
                      ? previous.filter((item) => item !== round.round)
                      : [...previous, round.round],
                  )
                }
              >
                <span className="qg-agent-run__caret" data-open={open} aria-hidden />
                <span className="qg-agent-run__round-no">第 {round.round} 轮</span>
                <span className="qg-agent-run__round-action">{roundAction(round)}</span>
                <span className="qg-agent-run__round-state">
                  {roundState(round, activeTool)}
                </span>
              </button>
              {open ? (
                <div className="qg-agent-run__body">
                  {round.text ? (
                    <div className="qg-agent-run__markdown">{renderMarkdown(round.text)}</div>
                  ) : null}
                  {round.tools.length ? (
                    <ul className="qg-agent-run__tools">
                      {round.tools.map((tool) => (
                        <li
                          key={tool.toolCallId}
                          className={`qg-agent-run__tool qg-agent-run__tool--${tool.state}`}
                        >
                          <span className="qg-agent-run__dot" aria-hidden />
                          <span className="qg-agent-run__tool-name">{tool.tool}</span>
                          <span className="qg-agent-run__tool-state">
                            {TOOL_STATE_LABELS[tool.state]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {!round.text && !round.tools.length ? (
                    <p className="qg-agent-run__waiting">等待模型输出…</p>
                  ) : null}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>

      {resultText ? <div className="qg-agent-run__result">{renderMarkdown(resultText)}</div> : null}

      {run.status === 'FAILED' ? (
        <p className="qg-agent-run__hint">执行失败，可重新 @ 该 Agent 重试。</p>
      ) : null}

      {childrenRuns?.length ? (
        <div className="qg-agent-run__children">
          {childrenRuns.map((childRun) => (
            <AgentRunProgress
              key={childRun.runId}
              run={childRun}
              agentName={agentName}
              renderMarkdown={renderMarkdown}
              childrenRuns={undefined}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
})
