import { useNavigate } from 'react-router-dom'
import { PATHS } from '@/routes/paths'
import { Mark } from '@/components/ui'
import './gate.css'

/** 无团队时的入口：创建或加入，两个选择并列。 */
export default function WelcomePage() {
  const navigate = useNavigate()
  return (
    <div className="gate gate--center">
      <div className="gate__solo">
        <Mark large />
        <h1 className="gate__title">还没有加入团队</h1>
        <p className="sub">
          团队是项目和 Agent 的归属。你现在可以创建一个，或用管理员给你的邀请加入已有的团队。
        </p>
        <div className="choices">
          <button type="button" className="choice" onClick={() => navigate(PATHS.CREATE_TEAM)}>
            <span className="choice__name">创建一个团队</span>
            <span className="choice__desc">连接 GitHub App、邀请成员、建第一个项目</span>
          </button>
          <button type="button" className="choice" onClick={() => navigate(PATHS.JOIN_TEAM)}>
            <span className="choice__name">加入已有团队</span>
            <span className="choice__desc">输入管理员给你的邀请码</span>
          </button>
        </div>
      </div>
    </div>
  )
}
