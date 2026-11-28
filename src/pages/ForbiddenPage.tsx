import { useNavigate } from 'react-router-dom'
import { Button, Icon } from '@/components/ui'

/** 403：角色不足时展示，给两条出口。 */
export default function ForbiddenPage() {
  const navigate = useNavigate()
  return (
    <main className="status">
      <div className="status__box">
        <span className="status__icon" aria-hidden>
          <Icon name="lock" size={22} />
        </span>
        <p className="status__code mono">403</p>
        <h1 className="status__title">需要团队管理员权限</h1>
        <p className="sub">
          你在这个团队里的角色是「成员」。成员管理、邀请与 GitHub 授权只对团队管理员开放。
        </p>
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
            onClick={() => navigate('/app/settings?tab=teams')}
            icon={<Icon name="people" size={15} />}
          >
            切换团队
          </Button>
        </div>
      </div>
    </main>
  )
}
