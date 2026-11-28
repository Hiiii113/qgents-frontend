import { useNavigate } from 'react-router-dom'
import { PATHS } from '@/routes/paths'
import { Icon, Mark } from '@/components/ui'
import '../Auth/gate.css'

/** 无团队时的入口：创建或加入，两张并列的选择卡。 */
export default function WelcomePage() {
  const navigate = useNavigate()
  return (
    <div className="gate gate--center">
      <div className="gate__solo">
        <Mark large />
        <div className="gate__center-head">
          <p className="gate__kicker">开始</p>
          <h1 className="gate__title">还没有加入团队</h1>
        </div>
        <div className="choices">
          <button type="button" className="choice" onClick={() => navigate(PATHS.CREATE_TEAM)}>
            <span className="choice__icon">
              <Icon name="sparkles" size={18} />
            </span>
            <span className="choice__body">
              <span className="choice__name">创建团队</span>
              <span className="choice__desc">你是所有者，先建第一个项目</span>
            </span>
            <span className="choice__go">
              <Icon name="arrow-right" size={16} />
            </span>
          </button>
          <button type="button" className="choice" onClick={() => navigate(PATHS.JOIN_TEAM)}>
            <span className="choice__icon">
              <Icon name="people" size={18} />
            </span>
            <span className="choice__body">
              <span className="choice__name">加入团队</span>
              <span className="choice__desc">用管理员给的邀请码进入</span>
            </span>
            <span className="choice__go">
              <Icon name="arrow-right" size={16} />
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
