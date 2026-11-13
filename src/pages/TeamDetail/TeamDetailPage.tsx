import { useState } from 'react'
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  GithubOutlined,
  MessageOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Alert, Avatar, Button, Input, Spin } from 'antd'
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PATHS } from '@/routes/paths'
import { projectApi, teamApi } from '@/api'
import { CreateProjectModal } from '@/components/CreateProjectModal'
import { useRememberTeam } from '@/hooks/useRememberTeam'
import { useTeamEvents } from '@/realtime/useTeamEvents'
import './TeamDetailPage.css'

/** 进入团队先选择项目，成员管理统一放在团队设置。 */
export default function TeamDetailPage() {
  const { teamId = '' } = useParams<{ teamId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  useTeamEvents(teamId || undefined)
  const team = useQuery({
    queryKey: ['teams', teamId],
    queryFn: () => teamApi.getById(teamId),
    enabled: Boolean(teamId),
  })
  const projects = useQuery({
    queryKey: ['teams', teamId, 'projects'],
    queryFn: () => projectApi.listByTeam(teamId),
    enabled: Boolean(teamId),
  })
  useRememberTeam(team.data?.id)
  if (team.isPending)
    return (
      <div className="team-loading">
        <Spin delay={180} />
      </div>
    )
  if (team.isError)
    return (
      <Alert
        type="error"
        message="团队加载失败或暂无访问权限"
        action={<Button onClick={() => void team.refetch()}>重试</Button>}
      />
    )
  const visible = (projects.data ?? []).filter((project) =>
    `${project.name} ${project.description ?? ''}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  )
  const settings = location.pathname.endsWith('/settings')
  const owner = team.data.role === 'TEAM_OWNER'
  const canManage = owner || team.data.role === 'TEAM_ADMIN'
  return (
    <div className="team-page">
      {settings ? (
        <header className="team-hero team-hero--compact">
          <div className="team-hero__head">
            <h1>团队设置</h1>
            <p className="team-hero__sub">{team.data.name}</p>
          </div>
          <div className="team-hero__actions">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(PATHS.teamDetail(teamId))}>
              返回项目
            </Button>
          </div>
        </header>
      ) : (
        <header className="team-hero">
          <div className="team-hero__head">
            <h1>{team.data.name}</h1>
            <p>{team.data.description || '选择项目继续协作，或创建一个新项目。'}</p>
          </div>
          <div className="team-hero__actions">
            {owner && (
              <Button
                icon={<GithubOutlined />}
                onClick={() => navigate(PATHS.githubIntegration(teamId))}
              >
                GitHub 授权
              </Button>
            )}
            {canManage && (
              <Button
                icon={<TeamOutlined />}
                onClick={() => navigate(`${PATHS.teamSettings(teamId)}?tab=members`)}
              >
                邀请成员
              </Button>
            )}
            <Button icon={<SettingOutlined />} onClick={() => navigate(PATHS.teamSettings(teamId))}>
              团队设置
            </Button>
          </div>
        </header>
      )}
      {settings ? (
        <div className="team-settings">
          <Outlet />
        </div>
      ) : (
        <>
          <div className="team-toolbar">
            <div className="team-toolbar__title">
              <h2>项目</h2>
              <span className="team-toolbar__count">{projects.data?.length ?? 0} 个项目</span>
            </div>
            <div className="team-toolbar__actions">
              <Input
                className="team-search"
                aria-label="搜索项目"
                placeholder="搜索项目"
                prefix={<SearchOutlined />}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                allowClear
              />
              {(team.data.role === 'TEAM_OWNER' || team.data.role === 'TEAM_ADMIN') && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                  创建项目
                </Button>
              )}
            </div>
          </div>
          {projects.isPending ? (
            <div className="team-loading">
              <Spin delay={180} />
            </div>
          ) : projects.isError ? (
            <Alert
              type="error"
              message="项目加载失败"
              action={<Button onClick={() => void projects.refetch()}>重试</Button>}
            />
          ) : visible.length === 0 ? (
            <p className="workspace-page__note">
              {search ? '没有匹配的项目。' : '还没有项目，创建第一个项目开始聊天。'}
            </p>
          ) : (
            <div className="team-grid">
              {visible.map((project) => (
                <Link className="team-card" key={project.id} to={PATHS.projectChat(project.id)}>
                  <div className="team-card__top">
                    <Avatar size={48} shape="square" src={project.avatarUrl}>
                      {project.name.slice(0, 1)}
                    </Avatar>
                    <span className="team-pill">
                      {project.status === 'ARCHIVED' ? '已归档' : '项目空间'}
                    </span>
                  </div>
                  <h3>{project.name}</h3>
                  <p>{project.description || '在这里讨论想法，记录每一次进展。'}</p>
                  <div className="team-card__foot">
                    <span>
                      <MessageOutlined aria-hidden /> 进入聊天
                    </span>
                    <ArrowRightOutlined aria-hidden />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
      <CreateProjectModal teamId={teamId} open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
