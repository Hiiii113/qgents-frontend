import { NavLink } from 'react-router-dom'
import { PersonalCenter } from './PersonalCenter'
import { useCurrentTeamId } from '@/store/appUiStore'
import { NotificationCenter } from './NotificationCenter'
import { PATHS } from '@/routes/paths'
import './Banner.css'

export function Banner() {
  const teamId = useCurrentTeamId()
  return (
    <header className="qg-banner">
      <NavLink
        className="qg-banner__brand"
        to={teamId ? PATHS.teamDetail(teamId) : PATHS.APP}
        aria-label="Qgents 首页"
      >
        Qgents
      </NavLink>
      <nav aria-label="主导航">
        <NavLink to={teamId ? PATHS.teamDetail(teamId) : PATHS.APP} end>
          首页
        </NavLink>
      </nav>
      <div className="qg-banner__account">
        <NotificationCenter />
        <PersonalCenter />
      </div>
    </header>
  )
}
