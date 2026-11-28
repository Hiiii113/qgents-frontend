import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectApi } from '@/api/project'
import { teamApi } from '@/api/team'
import { PATHS } from '@/routes/paths'
import { useRememberTeam } from '@/hooks/useRememberTeam'
import { formatApiError } from '@/utils/formatApiError'
import { CreateProjectModal } from '@/components/CreateProjectModal'
import './team-home.css'
import {
  Button,
  EmptyState,
  Icon,
  Page,
  PageHead,
  Section,
  Skeleton,
  Tag,
} from '@/components/ui'

/** 团队首页：以团队名称为标题，项目以等宽卡片网格铺开，点卡片直接进项目群聊。 */
export default function TeamHomePage() {
  const { teamId = '' } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  useRememberTeam(teamId || undefined)

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

  const role = team.data?.role
  const canManage = role === 'TEAM_OWNER' || role === 'TEAM_ADMIN'
  const isOwner = role === 'TEAM_OWNER'
  const keyword = search.trim().toLowerCase()
  const visible = (projects.data ?? []).filter((project) =>
    `${project.name} ${project.description ?? ''}`.toLowerCase().includes(keyword),
  )

  return (
    <main className="canvas">
      <Page>
        <PageHead
          title={team.data?.name ?? (team.isError ? '团队不可用' : '…')}
          actions={
            <>
              {canManage ? (
                <Button
                  variant="quiet"
                  icon={<Icon name="people" size={16} aria-hidden />}
                  onClick={() => navigate(PATHS.teamSettings(teamId))}
                >
                  成员管理
                </Button>
              ) : null}
              {isOwner ? (
                <Button
                  variant="quiet"
                  icon={<Icon name="branch" size={16} aria-hidden />}
                  onClick={() => navigate(PATHS.githubIntegration(teamId))}
                >
                  GitHub 授权
                </Button>
              ) : null}
              {canManage ? (
                <Button
                  variant="primary"
                  icon={<Icon name="plus" size={16} aria-hidden />}
                  onClick={() => setCreateOpen(true)}
                >
                  新建项目
                </Button>
              ) : null}
            </>
          }
        />

        {team.isError ? (
          <div className="block">
            <p className="h3">团队加载失败</p>
            <p className="sub">{formatApiError(team.error)}</p>
            <Button
              variant="quiet"
              onClick={() => void team.refetch()}
              icon={<Icon name="refresh" size={15} />}
            >
              重试
            </Button>
          </div>
        ) : (
          <Section
            title={
              <h2 className="h2 project-grid__title">
                项目
                {projects.isSuccess ? (
                  <span className="project-grid__count">{visible.length}</span>
                ) : null}
              </h2>
            }
            aside={
              <label className="inline-search">
                <span className="sr">筛选项目</span>
                <Icon name="search" size={15} />
                <input
                  type="search"
                  placeholder="筛选项目"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            }
          >
            {projects.isPending ? (
              <Skeleton rows={4} />
            ) : projects.isError ? (
              <EmptyState
                title="项目加载失败"
                description={formatApiError(projects.error)}
                action={
                  <Button
                    variant="link"
                    onClick={() => void projects.refetch()}
                    icon={<Icon name="refresh" size={15} />}
                  >
                    重试
                  </Button>
                }
                stacked
              />
            ) : visible.length === 0 ? (
              <EmptyState
                icon={keyword ? 'search' : 'repo'}
                title={keyword ? '没有匹配的项目' : '还没有项目'}
                action={
                  keyword ? (
                    <Button
                      variant="link"
                      onClick={() => setSearch('')}
                      icon={<Icon name="close" size={15} />}
                    >
                      清空筛选
                    </Button>
                  ) : canManage ? (
                    <Button
                      variant="primary"
                      icon={<Icon name="plus" size={16} />}
                      onClick={() => setCreateOpen(true)}
                    >
                      新建项目
                    </Button>
                  ) : undefined
                }
                stacked
              />
            ) : (
              <ul className="project-grid">
                {visible.map((project) => {
                  const archived = project.status === 'ARCHIVED'
                  const initial = project.name.trim().slice(0, 1) || '·'
                  return (
                    <li key={project.id} className="project-grid__item">
                      <button
                        type="button"
                        className="project-card"
                        onClick={() => navigate(PATHS.projectChat(project.id))}
                      >
                        <span className="project-card__top">
                          <span className="project-card__mono" aria-hidden>
                            {initial}
                          </span>
                          {archived ? <Tag tone="readonly">已归档</Tag> : null}
                        </span>
                        <span className="project-card__name">{project.name}</span>
                        {project.description ? (
                          <span className="project-card__desc">{project.description}</span>
                        ) : null}
                        <span className="project-card__foot">
                          {typeof project.repositoryCount === 'number' ? (
                            <span className="project-card__pill">
                              <Icon name="repo" size={12} />
                              {project.repositoryCount} 仓库
                            </span>
                          ) : null}
                          {typeof project.memberCount === 'number' ? (
                            <span className="project-card__pill">
                              <Icon name="people" size={12} />
                              {project.memberCount} 成员
                            </span>
                          ) : null}
                          {project.createdAt ? (
                            <span className="project-card__date">
                              {formatDate(project.createdAt)}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>
        )}
      </Page>

      <CreateProjectModal teamId={teamId} open={createOpen} onClose={() => setCreateOpen(false)} />
    </main>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : `${date.getMonth() + 1}月${date.getDate()}日`
}
