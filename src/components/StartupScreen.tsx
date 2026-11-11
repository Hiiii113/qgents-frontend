import { useState } from 'react'

export type StartupState = { status: 'starting' } | { status: 'error'; message: string }

export function StartupScreen({ state, onRetry }: { state: StartupState; onRetry: () => void }) {
  const [hover, setHover] = useState(false)
  if (state.status === 'error') {
    return (
      <main style={startupStyles.container} role="alert">
        <section style={startupStyles.card}>
          <h1 style={startupStyles.title}>应用初始化失败</h1>
          <p style={startupStyles.message}>{state.message}</p>
          <button
            type="button"
            style={{
              ...startupStyles.button,
              background: hover ? '#3d5a35' : '#4f7146',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onClick={onRetry}
          >
            继续启动 / 重试
          </button>
        </section>
      </main>
    )
  }

  return (
    <main style={startupStyles.container} role="status" aria-live="polite">
      <section style={startupStyles.card}>
        <h1 style={startupStyles.title}>应用初始化中</h1>
        <p style={startupStyles.message}>正在准备请求服务，请稍候。</p>
      </section>
    </main>
  )
}

const startupStyles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: '#f5f7f2',
    color: '#253d32',
  },
  card: {
    width: 'min(100%, 480px)',
    padding: 32,
    border: '1px solid #dfe7d8',
    borderRadius: 12,
    background: '#ffffff',
    textAlign: 'center' as const,
  },
  title: { margin: '0 0 12px', fontSize: 22 },
  message: { margin: '0 0 20px', color: '#63745f' },
  button: {
    border: 0,
    borderRadius: 8,
    padding: '10px 16px',
    background: '#4f7146',
    color: '#fff',
    cursor: 'pointer',
  },
}
