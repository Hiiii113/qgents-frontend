import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { App } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { repositoriesApi } from '@/api/repositories'
import { teamApi } from '@/api/team'
import { useCurrentTeamId } from '@/store/appUiStore'
import { formatApiError } from '@/utils/formatApiError'
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
import './github.css'

/** 团队 GitHub App：一处连接，项目管理员再各自导入需要的仓库。 */
export default function GithubPage() {
  const { teamId: routeTeamId } = useParams<{ teamId?: string }>()
  const [params, setParams] = useSearchParams()
  const currentTeamId = useCurrentTeamId()
  const teamId = routeTeamId ?? params.get('teamId') ?? currentTeamId ?? ''
  const { message } = App.useApp()
  const client = useQueryClient()
  const team = useQuery({
    queryKey: ['teams', teamId],
    queryFn: () => teamApi.getById(teamId),
    enabled: Boolean(teamId),
  })
  const connections = useQuery({
    queryKey: ['github', teamId, 'connections'],
    queryFn: () => repositoriesApi.connections(teamId),
    enabled: Boolean(teamId),
  })
  const repositories = useQuery({
    queryKey: ['github', teamId, 'repositories'],
    queryFn: () => repositoriesApi.available(teamId),
    enabled: Boolean(teamId),
  })
  const isOwner = team.data?.role === 'TEAM_OWNER'
  const connected = (connections.data?.length ?? 0) > 0
  const connect = useMutation({
    mutationFn: () => repositoriesApi.connect(teamId),
    onSuccess: (result) => window.location.assign(result.installationUrl),
    onError: (error) => void message.error(formatApiError(error)),
  })
  const sync = useMutation({
    mutationFn: (id: string) => repositoriesApi.sync(teamId, id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['github', teamId] })
      void message.success('授权已刷新')
    },
    onError: (error) => void message.error(formatApiError(error)),
  })

  // GitHub 安装完成后回跳带 ?installed=：刷新连接与仓库，再清掉参数。
  useEffect(() => {
    if (!params.has('installed') || !teamId) return
    void client.invalidateQueries({ queryKey: ['github', teamId] })
    const next = new URLSearchParams(params)
    next.delete('installed')
    setParams(next, { replace: true })
  }, [params, setParams, teamId, client])

  return (
    <main className="canvas">
      <Page>
        <PageHead
          kicker={team.data ? `团队 ${team.data.name}` : '团队'}
          title="GitHub App"
          description="团队连一次 App，项目管理员再把需要的仓库导入各自项目。"
          actions={
            isOwner ? (
              <Button
                variant="primary"
                icon={<Icon name="branch" size={16} aria-hidden />}
                disabled={connect.isPending}
                onClick={() => connect.mutate()}
              >
                {connect.isPending
                  ? '正在前往 GitHub…'
                  : connected
                    ? '重新连接'
                    : '连接 GitHub App'}
              </Button>
            ) : undefined
          }
        />

        {!teamId ? (
          <div className="block">
            <p className="h3">还没有选定团队</p>
            <p className="sub">从团队导航的 GitHub 入口进入，或在地址里带上 ?teamId=。</p>
          </div>
        ) : (
          <>
            <Section title="连接">
              {connections.isPending ? (
                <Skeleton rows={3} />
              ) : connections.isError ? (
                <EmptyState
                  title="连接状态加载失败"
                  description={formatApiError(connections.error)}
                  action={
                    <Button
                      variant="link"
                      onClick={() => void connections.refetch()}
                      icon={<Icon name="refresh" size={15} />}
                    >
                      重试
                    </Button>
                  }
                  stacked
                />
              ) : !connections.data.length ? (
                <EmptyState
                  icon="branch"
                  title="尚未连接 GitHub App"
                  description={
                    isOwner
                      ? '连接后，团队授权的仓库才能导入项目供 Qgent 使用。'
                      : '联系团队所有者连接 GitHub App。'
                  }
                  stacked
                />
              ) : (
                <DataTable
                  layout="plain"
                  className="github-page__connections"
                  columns={['账号', '类型', '状态', '']}
                >
                  {connections.data.map((connection) => (
                    <TableRow key={connection.id}>
                      <TableCell>
                        <span className="name mono">{connection.accountLogin}</span>
                      </TableCell>
                      <TableCell>
                        <span className="meta">
                          {/org/i.test(connection.accountType) ? '组织' : '个人'}账号
                        </span>
                      </TableCell>
                      <TableCell>
                        {connection.suspended ? (
                          <Tag tone="readonly">已暂停</Tag>
                        ) : (
                          <Tag tone="ok">已连接</Tag>
                        )}
                      </TableCell>
                      <TableCell end>
                        {isOwner ? (
                          <Button
                            variant="link"
                            icon={<Icon name="refresh" size={15} />}
                            disabled={sync.isPending}
                            onClick={() => sync.mutate(connection.id)}
                          >
                            {sync.isPending && sync.variables === connection.id
                              ? '刷新中…'
                              : '刷新授权'}
                          </Button>
                        ) : (
                          <span className="meta">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </DataTable>
              )}
            </Section>

            <Section
              title="可访问仓库"
              aside={<span className="meta">来自当前 GitHub App 授权</span>}
            >
              {repositories.isPending ? (
                <Skeleton rows={4} />
              ) : repositories.isError ? (
                <EmptyState
                  title="仓库列表加载失败"
                  description={formatApiError(repositories.error)}
                  action={
                    <Button
                      variant="link"
                      onClick={() => void repositories.refetch()}
                      icon={<Icon name="refresh" size={15} />}
                    >
                      重试
                    </Button>
                  }
                  stacked
                />
              ) : !repositories.data.length ? (
                <EmptyState
                  icon="repo"
                  title="没有可访问的仓库"
                  description={
                    isOwner
                      ? '在 GitHub App 的安装设置里授权仓库，然后刷新授权。'
                      : '让团队所有者在 GitHub App 安装里授权需要的仓库。'
                  }
                  stacked
                />
              ) : (
                <DataTable
                  layout="plain"
                  className="github-page__repos"
                  columns={['仓库', '默认分支', '可见性', '']}
                >
                  {repositories.data.map((repository) => (
                    <TableRow key={`${repository.installationId}-${repository.repositoryId}`}>
                      <TableCell>
                        <a
                          className="name mono"
                          href={repository.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {repository.fullName}
                        </a>
                      </TableCell>
                      <TableCell className="mono">{repository.defaultBranch ?? '—'}</TableCell>
                      <TableCell>
                        {repository.privateRepository ? (
                          <Tag tone="readonly" icon="lock">
                            私有
                          </Tag>
                        ) : (
                          <Tag icon="eye">公开</Tag>
                        )}
                      </TableCell>
                      <TableCell end>
                        <a
                          className="meta"
                          href={repository.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          在 GitHub 打开
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </DataTable>
              )}
            </Section>
          </>
        )}
      </Page>
    </main>
  )
}
