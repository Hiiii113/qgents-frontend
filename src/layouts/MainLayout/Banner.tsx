import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Select } from 'antd'
import { projectApi, teamApi } from '@/api'
import { useCurrentTeamId } from '@/store/appUiStore'
import { PATHS } from '@/routes/paths'
import { NotificationCenter } from './NotificationCenter'
import { PersonalCenter } from './PersonalCenter'
import './Banner.css'

/** 从项目路由里取 projectId；顶栏据此显示并切换当前项目。 */
function projectIdFromPath(pathname: string): string | null {
  return /^\/app\/projects\/([^/?#]+)/.exec(pathname)?.[1] ?? null
}

/**
 * 牌头带：品牌 / 团队 / 项目 / 账号。
 * 团队名回到团队首页，项目选择只列当前团队可访问的项目；换项目落在该项目聊天，
 * 不带上一个项目的群和消息定位。换团队、建团队、加团队在头像菜单里。
 */
export function Banner() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const storeTeamId = useCurrentTeamId()
  const projectId = projectIdFromPath(pathname)
  const teams = useQuery({ queryKey: ['teams', 'mine'], queryFn: teamApi.listMine })
  const project = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId ?? ''),
    enabled: Boolean(projectId),
  })
  // 项目页以项目所属团队为准：登录时记下的团队可能和直接打开的项目对不上。
  const teamId = project.data?.teamId ?? storeTeamId
  const team = teams.data?.find((item) => item.id === teamId)
  const projects = useQuery({
    queryKey: ['teams', teamId, 'projects'],
    queryFn: () => projectApi.listByTeam(teamId ?? ''),
    enabled: Boolean(teamId),
  })
  const home = teamId ? PATHS.teamDetail(teamId) : PATHS.APP

  const options = (projects.data ?? []).map((item) => ({ value: item.id, label: item.name }))
  // 当前项目不在列表里（刚建、已归档）时也显示名字，选择器不露裸 ID。
  if (project.data && !options.some((option) => option.value === project.data.id)) {
    options.unshift({ value: project.data.id, label: project.data.name })
  }
  // 解析不出名字就先走 placeholder/loading，不把裸 projectId 当标签显示。
  const selected = options.some((option) => option.value === projectId) ? projectId : undefined
  const placeholder = !teamId
    ? '选择项目'
    : projects.isPending
      ? '正在加载项目…'
      : projects.isError
        ? '项目加载失败'
        : projects.data.length === 0
          ? '当前团队暂无项目'
          : '选择项目'

  return (
    <header className="qg-banner">
      <NavLink className="qg-banner__brand" to={home} aria-label="Qgents 项目首页">
        Qgents
      </NavLink>
      <div className="qg-banner__where">
        <NavLink className="qg-banner__team" to={home} title={team?.name}>
          {team?.name ?? '—'}
        </NavLink>
        <Select
          className="qg-banner__project"
          variant="borderless"
          aria-label="选择项目"
          showSearch
          optionFilterProp="label"
          placeholder={placeholder}
          value={selected ?? undefined}
          options={options}
          loading={projects.isPending}
          disabled={!teamId || projects.isError || projects.data?.length === 0}
          notFoundContent={projects.isPending ? '正在加载…' : '没有匹配的项目'}
          popupMatchSelectWidth={240}
          onChange={(next) => {
            if (next !== projectId) navigate(PATHS.projectChat(next))
          }}
        />
        {projects.isError && (
          <Button
            className="qg-banner__retry"
            type="text"
            size="small"
            onClick={() => void projects.refetch()}
          >
            重试
          </Button>
        )}
      </div>
      <div className="qg-banner__account">
        <NotificationCenter />
        <PersonalCenter />
      </div>
    </header>
  )
}
