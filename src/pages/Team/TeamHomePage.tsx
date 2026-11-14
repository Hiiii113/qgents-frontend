import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectApi } from '@/api/project'
import { teamApi } from '@/api/team'
import { PATHS } from '@/routes/paths'
import { useRememberTeam } from '@/hooks/useRememberTeam'
import { useTeamEvents } from '@/realtime/useTeamEvents'
import { formatApiError } from '@/utils/formatApiError'
import { CreateProjectModal } from '@/components/CreateProjectModal'
import './team-home.css'
import {
  Button,
  DataTable,
  EmptyState,
  Icon,
  Page,
  PageHead,
  Section,
  Skeleton,
  TableCell,
  TableRow,
  Tag,
} from '@/components/ui'

/** 团队首页：以团队名称为标题，列出当前团队里用户可访问的项目。 */
export default function TeamHomePage() {
  const { teamId = '' } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  useTeamEvents(teamId || undefined)
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
          kicker="团队"
          title={team.data?.name ?? (team.isError ? '团队不可用' : '…')}
          description={team.data?.description}
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
            <Button variant="quiet" onClick={() => void team.refetch()}>
              重试
            </Button>
          </div>
        ) : (
          <Section
            title="项目"
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
                  <Button variant="link" onClick={() => void projects.refetch()}>
                    重试
                  </Button>
                }
                stacked
              />
            ) : visible.length === 0 ? (
              <EmptyState
                icon={keyword ? 'search' : 'repo'}
                title={keyword ? '没有匹配的项目' : '还没有项目'}
                description={keyword ? '清空筛选可以看全部项目。' : '建一个项目，就有了默认群与 Agent。'}
                action={
                  keyword ? (
                    <Button variant="link" onClick={() => setSearch('')}>
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
              <DataTable layout="projects" columns={['项目', '仓库', '成员', '创建']}>
                {visible.map((project) => (
                  <TableRow key={project.id}>
                    <button
                      type="button"
                      className="table__cell table__name"
                      onClick={() => navigate(PATHS.projectChat(project.id))}
                    >
                      <span className="project-cell">
                        <span className="project-cell__mark" aria-hidden>
                          {project.name.slice(0, 1)}
                        </span>
                        <span className="project-cell__body">
                          <span className="name">{project.name}</span>
                          <span className="meta">
                            {project.status === 'ARCHIVED' ? (
                              <Tag tone="readonly">已归档</Tag>
                            ) : (
                              (project.description ?? '—')
                            )}
                          </span>
                        </span>
                      </span>
                    </button>
                    <TableCell className="mono">
                      {project.repositoryCount ?? '—'}
                    </TableCell>
                    <TableCell className="mono">{project.memberCount ?? '—'}</TableCell>
                    <TableCell className="meta">{formatDate(project.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </DataTable>
            )}
          </Section>
        )}
      </Page>

      <CreateProjectModal
        teamId={teamId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </main>
  )
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}
