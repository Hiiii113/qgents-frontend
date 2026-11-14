import { Button, Mark, Icon } from '@/components/ui'
import './StartupScreen.css'

export type StartupState = { status: 'starting' } | { status: 'error'; message: string }

/** 启动/失败兜底页：品牌标记 + 一句状态 + 一个重试动作。 */
export function StartupScreen({ state, onRetry }: { state: StartupState; onRetry: () => void }) {
  const failed = state.status === 'error'
  return (
    <main className="startup" role={failed ? 'alert' : 'status'} aria-live="polite">
      <div className="startup__inner">
        <Mark large />
        <h1 className="h1">{failed ? '应用初始化失败' : '应用初始化中'}</h1>
        <p className="sub">{failed ? state.message : '正在准备请求服务，请稍候。'}</p>
        {failed ? (
          <Button variant="primary" onClick={onRetry} icon={<Icon name="refresh" size={15} />}>
            继续启动 / 重试
          </Button>
        ) : null}
      </div>
    </main>
  )
}
