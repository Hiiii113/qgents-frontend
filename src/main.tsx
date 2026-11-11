import { StartupScreen, type StartupState } from '@/components/StartupScreen'
import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import '@fontsource/plus-jakarta-sans/latin-400.css'
import '@fontsource/plus-jakarta-sans/latin-600.css'
import '@/styles/global.scss'
import App from './App'
import { AppProviders } from '@/providers/AppProviders'

const MOCK_START_TIMEOUT_MS = 10_000
const STALE_MOCK_WORKER_RELOAD_KEY = 'qgents:stale-mock-worker-reload'

function renderApp(root: Root): void {
  root.render(
    <StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </StrictMode>,
  )
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(
      () => reject(new Error('Mock 服务启动超时，请检查 mockServiceWorker.js。')),
      timeoutMs,
    )
    promise.then(
      (value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId)
        reject(error)
      },
    )
  })
}

async function startMockWorker(): Promise<void> {
  const { worker } = await import('@/mocks/browser')
  await withTimeout(
    worker.start({ onUnhandledRequest: 'error', waitUntilReady: true }),
    MOCK_START_TIMEOUT_MS,
  )
}

/**
 * A Mock Service Worker remains registered after VITE_USE_MOCK changes.  In
 * real API mode it would otherwise keep intercepting requests from a previous
 * local session, making successful writes exist only in browser memory.
 */
async function removeStaleMockWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false

  const registrations = await navigator.serviceWorker.getRegistrations()
  const mockRegistrations = registrations.filter((registration) =>
    [registration.active, registration.waiting, registration.installing].some((worker) =>
      worker?.scriptURL.includes('mockServiceWorker.js'),
    ),
  )
  if (mockRegistrations.length === 0) {
    sessionStorage.removeItem(STALE_MOCK_WORKER_RELOAD_KEY)
    return false
  }

  await Promise.all(mockRegistrations.map((registration) => registration.unregister()))

  const controlledByMock =
    navigator.serviceWorker.controller?.scriptURL.includes('mockServiceWorker.js')
  if (controlledByMock && sessionStorage.getItem(STALE_MOCK_WORKER_RELOAD_KEY) !== '1') {
    sessionStorage.setItem(STALE_MOCK_WORKER_RELOAD_KEY, '1')
    window.location.reload()
    return true
  }

  return false
}

function startupErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : 'Mock 服务无法启动，请检查浏览器控制台或重试。'
}

async function bootstrap(root: Root): Promise<void> {
  const useMock = String(import.meta.env.VITE_USE_MOCK ?? '').trim() === 'true'
  if (!useMock) {
    if (await removeStaleMockWorker()) return
    renderApp(root)
    return
  }

  let startupState: StartupState = { status: 'starting' }

  const renderStartup = () =>
    root.render(<StartupScreen state={startupState} onRetry={() => void initialize()} />)
  const initialize = async (): Promise<void> => {
    startupState = { status: 'starting' }
    renderStartup()

    try {
      await startMockWorker()
    } catch (error: unknown) {
      startupState = { status: 'error', message: startupErrorMessage(error) }
      renderStartup()
      return
    }

    renderApp(root)
  }

  void initialize()
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root was not found')

const root = createRoot(rootElement)
void bootstrap(root)
