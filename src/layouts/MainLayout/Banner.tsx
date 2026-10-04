import { NavLink } from 'react-router-dom'
import { Avatar, Button } from 'antd'
import { HomeOutlined, ApartmentOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { usePersonalCenter } from '@/context/PersonalCenterContext'
import { useCurrentTeamId } from '@/store/appUiStore'
import { NotificationCenter } from './NotificationCenter'
import { PATHS } from '@/routes/paths'
import './Banner.css'

export function Banner() {
  const { user } = useAuth()
  const { openPersonalCenter } = usePersonalCenter()
  const teamId = useCurrentTeamId()
  return <header className="qg-banner">
    <NavLink className="qg-banner__brand" to={PATHS.MY_TEAMS} aria-label="Qgents 首页"><span>Q</span><strong>gents</strong></NavLink>
    <nav aria-label="主导航">
      <NavLink to={PATHS.MY_TEAMS}><HomeOutlined /><span>团队</span></NavLink>
      {teamId && <NavLink to={PATHS.teamDetail(teamId)}><ApartmentOutlined /><span>团队项目</span></NavLink>}
    </nav>
    <div className="qg-banner__account"><NotificationCenter /><Button type="text" onClick={openPersonalCenter} aria-label="打开个人中心">
      <span className="qg-banner__user-name">{user?.displayName || '用户'}</span><Avatar size={30} src={user?.avatarUrl} style={{ background: '#cfdcc7', color: '#2e4538' }}>{user?.displayName?.slice(0, 1) || 'Q'}</Avatar>
    </Button></div>
  </header>
}
