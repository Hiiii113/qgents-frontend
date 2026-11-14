import { useNavigate } from 'react-router-dom'
import { Button, Icon } from '@/components/ui'

/** 404：路由未匹配或资源已不存在。 */
export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <main className="status">
      <div className="status__box">
        <span className="status__icon status__icon--muted" aria-hidden>
          <Icon name="unlink" size={22} />
        </span>
        <p className="status__code mono">404</p>
        <h1 className="status__title">页面未找到</h1>
        <p className="sub">链接指向的内容不存在，或它所属的项目、群聊已被删除。</p>
        <div className="status__actions">
          <Button
            variant="primary"
            onClick={() => navigate('/app', { replace: true })}
            icon={<Icon name="arrow-left" size={15} />}
          >
            回到团队首页
          </Button>
          <Button
            variant="quiet"
            onClick={() => navigate(-1)}
            icon={<Icon name="arrow-left" size={15} />}
          >
            返回上一页
          </Button>
        </div>
      </div>
    </main>
  )
}
