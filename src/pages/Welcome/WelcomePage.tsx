import { Link } from 'react-router-dom'
import { PATHS } from '@/routes/paths'
import { WorkspacePage } from '@/components/WorkspacePage'
import './WelcomePage.css'

/** 无团队时的两个入口：编号 + 标题 + 一句说明，靠发丝线分行。 */
const CHOICES = [
  {
    to: PATHS.CREATE_TEAM,
    title: '创建一个团队',
    description: '为你的伙伴建一个空间，创建项目，开始讨论。',
    action: '创建团队',
  },
  {
    to: PATHS.JOIN_TEAM,
    title: '加入已有团队',
    description: '接受团队邀请，与伙伴在同一个项目中会合。',
    action: '加入团队',
  },
]

export default function WelcomePage() {
  return (
    <WorkspacePage
      title="好想法，从一起聊开始。"
      description="先找一个团队空间，再与伙伴和 Qgent 一起开展工作。"
    >
      <div className="welcome-choices">
        {CHOICES.map((choice, index) => (
          <Link key={choice.to} className="welcome-choice" to={choice.to}>
            <span className="welcome-choice__index qg-num">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="welcome-choice__body">
              <strong>{choice.title}</strong>
              <span className="welcome-choice__desc">{choice.description}</span>
            </span>
            <span className="welcome-choice__action">{choice.action}</span>
          </Link>
        ))}
      </div>
      <p className="workspace-page__note">在聊天中讨论想法，@Qgent 帮你把它往前推进。</p>
    </WorkspacePage>
  )
}
