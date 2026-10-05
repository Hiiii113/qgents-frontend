import { useState } from 'react'
import {
  ArrowRightOutlined,
  MessageOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { Alert, Avatar, Button, Empty, Input, Spin } from 'antd'
import { Link, Outlet, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PATHS } from '@/routes/paths'
import { projectApi, teamApi } from '@/api'
import { CreateProjectModal } from '@/components/CreateProjectModal'
import { useRememberTeam } from '@/hooks/useRememberTeam'
import { useTeamEvents } from '@/realtime/useTeamEvents'
import '@/styles/Journey.css'

/** 进入团队先选择项目，成员管理统一放在团队设置。 */
export default function TeamDetailPage() {
  const { teamId = '' } = useParams<{ teamId: string }>()
  const location = useLocation()
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
      <div className="journey-loading">
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
    <div className="journey-page">
      <header className="journey-hero">
        <div className="journey-team-heading">
          <Avatar size={60} shape="square" src={team.data.avatarUrl}>
            {team.data.name.slice(0, 1)}
          </Avatar>
          <div>
            <span className="journey-eyebrow">TEAM SPACE</span>
            <h1>{team.data.name}</h1>
            <p>{team.data.description || '选择一个项目，进入群聊与伙伴协作。'}</p>
          </div>
        </div>
        <div className="journey-actions">
          <Link to={settings ? PATHS.teamDetail(teamId) : PATHS.teamSettings(teamId)}>
            <Button icon={<SettingOutlined />}>{settings ? '返回项目' : '团队设置'}</Button>
          </Link>
        </div>
      </header>
      {settings ? (
        <div className="journey-settings">
          <Outlet />
        </div>
      ) : (
        <>
          <div className="journey-section-title">
            <div>
              <h2>选择一个项目</h2>
              <span>{projects.data?.length ?? 0} 个项目 · 聊天与成果都在这里</span>
            </div>
            <div className="journey-actions">
              <Input
                aria-label="搜索项目"
                placeholder="搜索项目"
                prefix={<SearchOutlined />}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                allowClear
              />
              {team.data.role === 'TEAM_OWNER' && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                  创建项目
                </Button>
              )}
            </div>
          </div>
          {projects.isPending ? (
            <div className="journey-loading">
              <Spin delay={180} />
            </div>
          ) : projects.isError ? (
            <Alert
              type="error"
              message="项目加载失败"
              action={<Button onClick={() => void projects.refetch()}>重试</Button>}
            />
          ) : visible.length === 0 ? (
            <Empty description={search ? '没有匹配的项目' : '还没有项目，创建第一个项目开始聊天'} />
          ) : (
            <div className="journey-grid">
              {visible.map((project) => (
                <Link
                  className="journey-card journey-card--project"
                  key={project.id}
                  to={PATHS.projectChat(project.id)}
                >
                  <div className="journey-card__top">
                    <Avatar size={48} shape="square" src={project.avatarUrl}>
                      {project.name.slice(0, 1)}
                    </Avatar>
                    <span className="journey-pill">
                      {project.status === 'ARCHIVED' ? '已归档' : '项目空间'}
                    </span>
                  </div>
                  <h3>{project.name}</h3>
                  <p>{project.description || '在这里讨论想法，记录每一次进展。'}</p>
                  <div className="journey-card__bottom">
                    <span>
                      <MessageOutlined /> 进入聊天
                    </span>
                    <ArrowRightOutlined />
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
