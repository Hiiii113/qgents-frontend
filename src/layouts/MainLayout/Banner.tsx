import { NavLink, useLocation } from 'react-router-dom'
import { chatApi } from '@/api/chat'
import { chatKeys } from '@/components/chat/useChatMessages'
import { useQuery } from '@tanstack/react-query'
import { projectApi, teamApi } from '@/api'
import { useCurrentTeamId } from '@/store/appUiStore'
import { PersonalCenter } from './PersonalCenter'
import { NotificationCenter } from './NotificationCenter'
import { PATHS } from '@/routes/paths'
import './Banner.css'

/** 从项目路由里取 projectId；顶栏据此显示当前项目。 */
function projectIdFromPath(pathname: string): string | null {
  return /^\/app\/projects\/([^/?#]+)/.exec(pathname)?.[1] ?? null
}

/**
 * 牌头带：深墨横贯，只回答「你在哪个团队、哪个项目」。
 * 切换团队、创建团队、加入团队都不在这里，收在团队设置的「所在团队」页签里。
 */
export function Banner() {
  const teamId = useCurrentTeamId()
  const { pathname, search } = useLocation()
  const projectId = projectIdFromPath(pathname)
  const teams = useQuery({ queryKey: ['teams', 'mine'], queryFn: teamApi.listMine })
  const team = teams.data?.find((item) => item.id === teamId)
  const project = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId ?? ''),
    enabled: Boolean(projectId),
  })
  // 聊天页把当前群也写进牌头带：离开聊天页后至少还知道刚才在哪个群。
  const groupId = new URLSearchParams(search).get('groupId')
  const inChat = pathname.endsWith('/chat')
  const groups = useQuery({
    queryKey: chatKeys.groups(projectId ?? ''),
    queryFn: () => chatApi.groups(projectId ?? ''),
    enabled: Boolean(projectId) && inChat,
  })
  const group =
    groups.data?.find((item) => item.id === groupId) ??
    groups.data?.find((item) => item.defaultGroup) ??
    groups.data?.[0]
  const home = teamId ? PATHS.teamDetail(teamId) : PATHS.APP

  return (
    <header className="qg-banner">
      <NavLink className="qg-banner__brand" to={home} aria-label="Qgents 项目首页">
        Qgents
      </NavLink>
      <div className="qg-banner__where">
        <NavLink className="qg-banner__team" to={home}>
          {team?.name ?? '—'}
        </NavLink>
        {project.data && (
          <>
            <span className="qg-banner__sep" aria-hidden />
            <span className="qg-banner__proj">
              项目 <b>{project.data.name}</b>
            </span>
          </>
        )}
        {group && (
          <>
            <span className="qg-banner__sep" aria-hidden />
            <span className="qg-banner__proj">
              <b># {group.title}</b>
            </span>
          </>
        )}
      </div>
      <div className="qg-banner__account">
        <NotificationCenter />
        <PersonalCenter />
      </div>
    </header>
  )
}
