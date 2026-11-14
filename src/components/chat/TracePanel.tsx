import type { AgentRun, AgentRunToolState } from '@/features/agent-runs/types'
import { isTerminalStatus } from '@/features/agent-runs/types'
import { Button, Icon, IconButton } from '@/components/ui'
import { LazyChatMarkdown } from './LazyChatMarkdown'

const STATUS_LABEL = {
  RUNNING: '运行中',
  CANCELLING: '停止中',
  CANCELLED: '已叫停',
  SUCCEEDED: '完成',
  FAILED: '失败',
} as const

const TOOL_LABEL: Record<AgentRunToolState, string> = {
  running: '执行中',
  ok: '完成',
  failed: '失败',
  done: '结束',
}

function stepTone(run: AgentRun, toolState: AgentRunToolState, index: number, last: number) {
  if (run.status === 'FAILED' && index === last) return 'fail'
  if (run.status === 'CANCELLED' && toolState === 'running') return 'halt'
  if (toolState === 'running' && !isTerminalStatus(run.status)) return 'live'
  if (toolState === 'failed') return 'fail'
  return 'done'
}

/**
 * 执行轨迹：工具步骤逐行列出，运行中的正文在这里实时出现。
 * 没有工具调用的终态运行显示空态，不编造步骤。
 */
export function TracePanel({
  run,
  childrenRuns,
  agentName,
  trigger,
  connectionError,
  onClose,
  onRetry,
}: {
  run: AgentRun | null
  childrenRuns: AgentRun[]
  agentName?: string
  trigger?: string
  connectionError?: string | null
  onClose: () => void
  onRetry?: () => void
}) {
  const running = run ? !isTerminalStatus(run.status) : false
  const liveText = run?.segments.map((segment) => segment.text).join('')
  return (
    <aside className="sidepanel trace is-open" aria-label="执行轨迹">
      <header className="sidepanel__head">
        <div>
          <p className="sidepanel__kicker">执行轨迹</p>
          <p className="sidepanel__title od-truncate">{agentName ?? 'Agent 运行'}</p>
        </div>
        <IconButton label="收起执行轨迹" square onClick={onClose}>
          <Icon name="close" size={18} />
        </IconButton>
      </header>

      {run ? (
        <>
          <p className="trace__trigger">
            触发消息：{trigger ?? '当前群聊'}
            {run.createdAt ? ` · ${formatTime(run.createdAt)}` : ''}
          </p>
          <ol className="steps">
            {run.tools.length === 0 ? (
              <li className="step step--idle">
                <span className="step__i">·</span>
                <div>
                  <p className="step__name">{running ? '等待工具调用' : '没有工具调用'}</p>
                  <p className="step__meta">
                    {run.status === 'SUCCEEDED' ? '本轮只输出了正文' : STATUS_LABEL[run.status]}
                  </p>
                </div>
              </li>
            ) : (
              run.tools.map((tool, index) => (
                <li
                  key={tool.toolCallId}
                  className={`step step--${stepTone(run, tool.state, index, run.tools.length - 1)}`}
                >
                  <span className="step__i">{index + 1}</span>
                  <div>
                    <p className="step__name">{tool.tool}</p>
                    <p className="step__meta">
                      第 {tool.round} 轮 · {TOOL_LABEL[tool.state]}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ol>
          {childrenRuns.length ? (
            <div className="trace__live">
              <p className="trace__live-label">子 Agent</p>
              {childrenRuns.map((child) => (
                <div key={child.runId} className="row row--tight">
                  <span className={`dot dot--${child.status === 'RUNNING' ? 'live' : 'ok'}`} />
                  <span className="step__meta">
                    #{child.runId} · {STATUS_LABEL[child.status]} · {child.tools.length} 步
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {running && liveText ? (
            <div className="trace__live">
              <p className="trace__live-label">本轮回复</p>
              <LazyChatMarkdown text={liveText} />
            </div>
          ) : null}
          <footer className="trace__foot">
            <p className="meta" role="status">
              {STATUS_LABEL[run.status]} · 第 {run.round} 轮 · {run.tools.length} 个工具步骤
            </p>
            {run.result && run.status === 'FAILED' ? (
              <p className="run__note">{run.result}</p>
            ) : null}
            {connectionError ? (
              <div className="row row--tight">
                <span className="meta">{connectionError}</span>
                {onRetry ? (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={onRetry}
                    icon={<Icon name="refresh" size={15} />}
                  >
                    重试
                  </Button>
                ) : null}
              </div>
            ) : null}
          </footer>
        </>
      ) : (
        <div className="trace__empty">
          <p className="step__name">还没有可查看的执行</p>
          <p className="step__meta" style={{ marginTop: 4 }}>
            在群里 @ 一个 Agent 派活，运行步骤会出现在这里。
          </p>
        </div>
      )}
    </aside>
  )
}

function formatTime(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
