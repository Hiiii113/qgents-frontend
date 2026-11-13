import { useState } from 'react'
import './StartupScreen.css'

export type StartupState = { status: 'starting' } | { status: 'error'; message: string }

/**
 * 启动/失败兜底页。左对齐、无卡片外框，靠排版层级与一条发丝线分隔。
 */
export function StartupScreen({ state, onRetry }: { state: StartupState; onRetry: () => void }) {
  const [hover, setHover] = useState(false)
  const failed = state.status === 'error'

  return (
    <main className="qg-startup" role={failed ? 'alert' : 'status'} aria-live="polite">
      <div className="qg-startup__inner">
        <h1 className="qg-startup__title">{failed ? '应用初始化失败' : '应用初始化中'}</h1>
        <p className="qg-startup__message">
          {failed ? state.message : '正在准备请求服务，请稍候。'}
        </p>
        {failed && (
          <button
            type="button"
            className="qg-startup__button"
            style={{ background: hover ? 'var(--accent-strong)' : 'var(--accent)' }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onClick={onRetry}
          >
            继续启动 / 重试
          </button>
        )}
      </div>
    </main>
  )
}
