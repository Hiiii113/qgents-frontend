import { Outlet, useLocation } from 'react-router-dom'
import { Layout } from 'antd'
import { Banner } from './Banner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useRealtimeEvents } from '@/realtime/useRealtimeEvents'
import { Suspense } from 'react'
import { PageLoader } from '@/components/PageLoader'

const { Content } = Layout

/**
 * 主应用布局：顶部导航和个人菜单，页面内容区域独立加载。
 */
export function MainLayout() {
  const location = useLocation()
  const isProject = location.pathname.startsWith('/app/projects/')

  // 全局 WebSocket 实时通道（单连接用户级聚合；断线时由 SSE 接管）
  useRealtimeEvents()

  return (
    <Layout className="qg-full-height" style={{ minHeight: '100%', background: '#f5f7f2' }}>
      <Banner />
      <Content
        className={isProject ? 'qg-content-flush' : undefined}
        style={{
          flex: 1,
          overflow: 'auto',
          minWidth: 0,
          padding: 0,
        }}
      >
        {/* 页面级错误边界：切路由自动复位，Banner/导航不受影响 */}
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </Content>
    </Layout>
  )
}
