import { NavLink, useNavigate } from 'react-router-dom'
import { PATHS } from '@/routes/paths'
import { useAuth } from '@/context/AuthContext'
import { Avatar, Icon, Mark, type IconName } from '@/components/ui'
import { MeMenu } from './AppBar'

export type ShellMode = 'project' | 'team' | 'settings'

interface RailProps {
  mode: ShellMode
  teamId: string | null
  projectId: string | null
  meOpen: boolean
  onOpenMe: () => void
  onCloseMe: () => void
}

interface RailItem {
  key: string
  label: string
  icon: IconName
  to: string
  end?: boolean
}

/**
 * 64px 竖轨：项目视图（聊天/Agent/记忆/Skill/仓库）与团队视图（项目/成员/GitHub）
 * 换组显示；设置永远在底部；当前项用 2px 朱砂竖条标记。
 */
export function Rail({ mode, teamId, projectId, meOpen, onOpenMe, onCloseMe }: RailProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const home = teamId ? PATHS.teamDetail(teamId) : PATHS.APP

  const projectItems: RailItem[] = projectId
    ? [
        { key: 'chat', label: '聊天', icon: 'chat', to: PATHS.projectChat(projectId), end: true },
        { key: 'agents', label: 'Agent', icon: 'agent', to: PATHS.projectAgents(projectId) },
        { key: 'memory', label: '记忆', icon: 'book', to: PATHS.projectMemory(projectId) },
        { key: 'skills', label: 'Skill', icon: 'skill', to: PATHS.projectSkills(projectId) },
        { key: 'repos', label: '仓库', icon: 'repo', to: PATHS.projectCode(projectId) },
      ]
    : []

  const teamItems: RailItem[] = teamId
    ? [
        { key: 'home', label: '项目', icon: 'chat', to: PATHS.teamDetail(teamId), end: true },
        { key: 'members', label: '成员', icon: 'people', to: PATHS.teamSettings(teamId) },
        { key: 'github', label: 'GitHub', icon: 'branch', to: PATHS.githubIntegration(teamId) },
      ]
    : []

  const items = mode === 'project' ? projectItems : teamItems
  const settingsTo =
    mode === 'project' && projectId ? PATHS.projectSettings(projectId) : PATHS.SETTINGS
  const name = user?.displayName || '用户'

  return (
    <nav className="rail" aria-label="主导航">
      <div className="rail__top">
        <button
          type="button"
          className="rail__brand"
          aria-label="回到团队首页"
          onClick={() => navigate(home)}
        >
          <Mark />
        </button>
      </div>

      <div className="rail__group">
        {items.map((item) => (
          <NavLink key={item.key} className="rail__btn" to={item.to} end={item.end}>
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      <div className="rail__foot">
        <NavLink className="rail__btn" to={settingsTo}>
          <Icon name="gear" size={20} />
          <span>设置</span>
        </NavLink>
        <div className="anchored">
          <button
            type="button"
            className="rail__me"
            aria-label="打开个人菜单"
            aria-expanded={meOpen}
            onClick={onOpenMe}
          >
            <Avatar name={name} src={user?.avatarUrl} />
          </button>
          {meOpen ? <MeMenu open={meOpen} onClose={onCloseMe} /> : null}
        </div>
      </div>
    </nav>
  )
}
