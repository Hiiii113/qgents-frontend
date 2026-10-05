import { Link } from 'react-router-dom'
import { Alert, Avatar, Button, Spin } from 'antd'
import { ArrowRightOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { PATHS } from '@/routes/paths'
import { teamApi } from '@/api'
import { useAuth } from '@/context/AuthContext'
import '@/styles/Journey.css'

export default function MyTeamsPage() {
  const { user } = useAuth()
  const teams = useQuery({ queryKey: ['teams', 'mine'], queryFn: teamApi.listMine })
  return (
    <div className="journey-page">
      <header className="journey-hero">
        <div>
          <span className="journey-eyebrow">YOUR TEAM SPACE</span>
          <h1>{user?.displayName ? `${user.displayName}，欢迎回来` : '选择你的团队'}</h1>
          <p>找到你的伙伴，从一个项目开始新的讨论。</p>
        </div>
        <div className="journey-actions">
          <Link to={PATHS.JOIN_TEAM}>
            <Button>加入团队</Button>
          </Link>
          <Link to={PATHS.CREATE_TEAM}>
            <Button type="primary" icon={<PlusOutlined />}>
              创建团队
            </Button>
          </Link>
        </div>
      </header>
      <div className="journey-section-title">
        <h2>我的团队</h2>
        <span>{teams.data?.length ?? 0} 个团队</span>
      </div>
      {teams.isPending ? (
        <div className="journey-loading">
          <Spin delay={180} />
        </div>
      ) : teams.isError ? (
        <Alert
          type="error"
          message="团队加载失败"
          action={<Button onClick={() => void teams.refetch()}>重试</Button>}
        />
      ) : (
        <div className="journey-grid">
          {teams.data?.map((team) => (
            <Link key={team.id} to={PATHS.teamDetail(team.id)} className="journey-card">
              <div className="journey-card__top">
                <Avatar shape="square" size={52} src={team.avatarUrl}>
                  {team.name.slice(0, 1)}
                </Avatar>
                <span className="journey-pill">
                  {team.role === 'TEAM_OWNER' ? '我创建的' : '我加入的'}
                </span>
              </div>
              <h3>{team.name}</h3>
              <p>{team.memberCount ?? 1} 位伙伴 · 团队协作空间</p>
              <div className="journey-card__bottom">
                <span>选择项目</span>
                <ArrowRightOutlined />
              </div>
            </Link>
          ))}
          <Link to={PATHS.CREATE_TEAM} className="journey-card journey-card--new">
            <PlusOutlined />
            <h3>组建新的团队</h3>
            <p>一起聊想法，把事情做成。</p>
          </Link>
          {!teams.data?.length && (
            <Link to={PATHS.JOIN_TEAM} className="journey-card journey-card--new">
              <TeamOutlined />
              <h3>加入已有团队</h3>
              <p>使用邀请，与伙伴会合。</p>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
