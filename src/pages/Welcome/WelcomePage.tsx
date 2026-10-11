import { Link } from 'react-router-dom'
import { ArrowRightOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons'
import { PATHS } from '@/routes/paths'
import '@/styles/Journey.css'

export default function WelcomePage() {
  return (
    <div className="welcome-space">
      <Link className="welcome-space__brand" to={PATHS.APP}>
        Qgents
      </Link>
      <div className="journey-page">
        <header className="journey-hero">
          <div>
            <span className="journey-eyebrow">LET’S GET TOGETHER</span>
            <h1>好想法，从一起聊开始。</h1>
            <p>先找一个团队空间，再与伙伴和 Qgent 一起开展工作。</p>
          </div>
        </header>
        <div className="welcome-space__choices">
          <Link to={PATHS.CREATE_TEAM} className="journey-card">
            <PlusOutlined className="welcome-space__icon" />
            <h2>创建一个团队</h2>
            <p>为你的伙伴建一个空间，创建项目，开始讨论。</p>
            <div className="journey-card__bottom">
              <span>创建团队</span>
              <ArrowRightOutlined />
            </div>
          </Link>
          <Link to={PATHS.JOIN_TEAM} className="journey-card">
            <TeamOutlined className="welcome-space__icon" />
            <h2>加入已有团队</h2>
            <p>接受团队邀请，与伙伴在同一个项目中会合。</p>
            <div className="journey-card__bottom">
              <span>加入团队</span>
              <ArrowRightOutlined />
            </div>
          </Link>
        </div>
        <p className="welcome-space__footnote">在聊天中讨论想法，@Qgent 帮你把它往前推进。</p>
      </div>
    </div>
  )
}
