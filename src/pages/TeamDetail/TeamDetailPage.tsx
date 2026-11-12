import { useState } from 'react'
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  MessageOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Alert, Avatar, Button, Input, Spin } from 'antd'
import { Link, Outlet, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PATHS } from '@/routes/paths'
import { projectApi, teamApi } from '@/api'
import { CreateProjectModal } from '@/components/CreateProjectModal'
import { useRememberTeam } from '@/hooks/useRememberTeam'
import { useAuth } from '@/context/AuthContext'
import { useTeamEvents } from '@/realtime/useTeamEvents'
import './TeamDetailPage.css'

/** 进入团队先选择项目，成员管理统一放在团队设置。 */
export default function TeamDetailPage() {
  const { teamId = '' } = useParams<{ teamId: string }>()
  const location = useLocation()
  const { user } = useAuth()
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
  return (
    <div className="team-page">
      <header className="team-hero">
        <div className="team-hero__head">
          <h1>{user?.displayName || '用户'}，欢迎回来</h1>
          <p>从一个项目开始今天的讨论。</p>
        </div>
        {settings && (
          <div className="team-hero__actions">
            <Link to={PATHS.teamDetail(teamId)}>
              <Button icon={<ArrowLeftOutlined />}>返回项目</Button>
            </Link>
          </div>
        )}
      </header>
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
