import { Button, Icon } from '@/components/ui'
import { isTerminalStatus, type AgentRun } from '@/features/agent-runs/types'

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

/**
 * 触发消息下方的一张运行卡：状态、工具步数、一个动作。
 * 过程本身在右侧执行轨迹里，不往对话正文里堆中间态。
 */
export function RunCard({
  run,
  agentName,
  onOpen,
  onStop,
  stopping,
}: {
  run: AgentRun
  agentName?: string
  onOpen: () => void
  onStop?: () => void
  stopping?: boolean
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
        <span className="run__meta">
          {steps ? `${steps} 个工具步骤` : running ? '正在读取上下文' : '无工具调用'}
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
        ) : (
          <Button
            variant="link"
            className="run__trace"
            onClick={onOpen}
            icon={<Icon name="activity" size={15} />}
          >
            查看轨迹
          </Button>
        )}
      </div>
      {run.status === 'FAILED' && run.result ? <p className="run__note">{run.result}</p> : null}
    </section>
  )
}
