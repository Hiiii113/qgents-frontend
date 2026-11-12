import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { PATHS } from '@/routes/paths'
import './StatusPage.css'

/**
 * 404 页面 —— 路由未匹配时展示
 */
export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <main className="status-page">
      <div className="status-page__inner">
        <span className="qg-eyebrow">NOT FOUND</span>
        <p className="status-page__code qg-num">404</p>
        <h1 className="status-page__title">页面未找到</h1>
        <p className="status-page__desc">你访问的页面不存在或已被移除。</p>
        <Button type="primary" onClick={() => navigate(PATHS.APP, { replace: true })}>
          返回团队首页
        </Button>
      </div>
    </main>
  )
}
