import { NavLink } from 'react-router-dom'
import { PersonalCenter } from './PersonalCenter'
import { TeamSelector } from './TeamSelector'
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
        aria-label="Qgents 项目首页"
      >
        Qgents
      </NavLink>
      <TeamSelector />
      <nav aria-label="主导航">
        <NavLink to={teamId ? PATHS.teamDetail(teamId) : PATHS.APP} end>
          项目
        </NavLink>
      </nav>
      <div className="qg-banner__account">
        <NotificationCenter />
        <PersonalCenter />
      </div>
    </header>
  )
}
