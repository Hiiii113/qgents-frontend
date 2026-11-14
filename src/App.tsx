import { AppRouter } from '@/routes'
import { IconSprite } from '@/components/ui'
import { ErrorBoundary } from '@/components/ErrorBoundary'

/**
 * Qgents Web 桌面端入口
 * 产品入口：项目群聊、项目内 Agent 协作与 GitHub 仓库能力
 */
function App() {
  return (
    <ErrorBoundary>
      <IconSprite />
      <AppRouter />
    </ErrorBoundary>
  )
}

export default App
