import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { PATHS } from '@/routes/paths'
import './StatusPage.css'

/**
 * 403 页面 —— 权限不足时展示
 */
export default function ForbiddenPage() {
  const navigate = useNavigate()

  return (
    <main className="status-page">
      <div className="status-page__inner">
        <span className="qg-eyebrow">FORBIDDEN</span>
        <p className="status-page__code qg-num">403</p>
        <h1 className="status-page__title">暂无访问权限</h1>
        <p className="status-page__desc">你当前的团队或项目角色无法访问此页面。</p>
        <Button type="primary" onClick={() => navigate(PATHS.APP, { replace: true })}>
          返回团队首页
        </Button>
      </div>
    </main>
  )
}
