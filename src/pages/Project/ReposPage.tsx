import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { App } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/api/project'
import { repositoriesApi } from '@/api/repositories'
import type { AvailableRepository, ImportedRepository } from '@/api/repositories'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import {
  Button,
  DataTable,
  Dialog,
  EmptyState,
  Icon,
  Page,
  PageHead,
  Section,
  Skeleton,
  TableCell,
  TableRow,
} from '@/components/ui'
import './repos.css'

const repoKey = (repo: AvailableRepository) => `${repo.installationId}:${repo.repositoryId}`

/**
 * 项目仓库：列出来自团队 GitHub App 授权并已导入本项目的仓库。
 * 连接断开时整块替换为阻断说明；移除只取消本项目引用。
 */
export default function ReposPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const client = useQueryClient()
  const [importOpen, setImportOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [repoSearch, setRepoSearch] = useState('')
  const [search, setSearch] = useState('')
  const [removal, setRemoval] = useState<ImportedRepository | null>(null)

  const project = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: Boolean(projectId),
  })
  const teamId = project.data?.teamId ?? ''
  const canManage = project.data?.role === 'PROJECT_ADMIN'
  const connections = useQuery({
    queryKey: ['github', teamId, 'connections'],
    queryFn: () => repositoriesApi.connections(teamId),
    enabled: Boolean(teamId),
  })
  const imported = useQuery({
    queryKey: ['repositories', projectId],
    queryFn: () => repositoriesApi.imported(projectId),
    enabled: Boolean(projectId),
  })
  const available = useQuery({
    queryKey: ['github', teamId, 'available'],
    queryFn: () => repositoriesApi.available(teamId),
    enabled: Boolean(teamId) && importOpen,
  })

  const disconnected =
    connections.isSuccess &&
    (connections.data.length === 0 || connections.data.every((item) => item.suspended))

  const importedIds = new Set((imported.data ?? []).map((repo) => repo.providerRepositoryId))
  const options = (available.data ?? []).filter((repo) => !importedIds.has(repo.repositoryId))
  const keyword = repoSearch.trim().toLowerCase()
  const visibleOptions = options.filter((repo) => repo.fullName.toLowerCase().includes(keyword))
  const rows = (imported.data ?? []).filter((repo) =>
    repo.fullName.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const importRepos = useMutation({
    mutationFn: async (repos: AvailableRepository[]) => {
      for (const repo of repos) {
        await repositoriesApi.import(projectId, {
          installationId: repo.installationId,
          repositoryId: repo.repositoryId,
        })
      }
    },
    onSuccess: () => {
      closeImport()
      void message.success('仓库已导入项目')
    },
    onError: (error) => void message.error(formatApiError(error)),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['repositories', projectId] })
      void client.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => repositoriesApi.remove(projectId, id),
    onSuccess: () => {
      setRemoval(null)
      void message.success('仓库已从项目移除')
    },
    onError: (error) => void message.error(formatApiError(error)),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['repositories', projectId] })
      void client.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })

  function closeImport() {
    setImportOpen(false)
    setSelected([])
    setRepoSearch('')
  }
  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    )

  return (
    <main className="canvas">
      <Page>
        <PageHead
          title="仓库"
          description="团队 GitHub App 已授权的仓库。Qgent 始终可以使用已导入到本项目的仓库。"
          actions={
            canManage && connections.isSuccess && !disconnected && imported.data?.length ? (
              <Button
                variant="primary"
                icon={<Icon name="plus" size={16} aria-hidden />}
                onClick={() => setImportOpen(true)}
              >
                导入仓库
              </Button>
            ) : null
          }
        />

        {project.isError ? (
          <EmptyState
            title="项目加载失败"
            description={formatApiError(project.error)}
            action={
              <Button variant="link" onClick={() => void project.refetch()}>
                重试
              </Button>
            }
            stacked
          />
        ) : project.isPending || connections.isPending ? (
          <Skeleton rows={4} />
        ) : connections.isError ? (
          <EmptyState
            title="GitHub 连接加载失败"
            description={formatApiError(connections.error)}
            action={
              <Button variant="link" onClick={() => void connections.refetch()}>
                重试
              </Button>
            }
            stacked
          />
        ) : disconnected ? (
          <div className="block">
            <p className="kicker">GitHub 未连接</p>
            <p className="h3">这个项目的仓库暂时无法访问</p>
            <p className="sub">
              {connections.data.length === 0
                ? '团队还没有连接 GitHub App。'
                : '团队 GitHub App 的连接已失效。'}
              重新连接后已导入的仓库会回来，Qgent 才能继续读写代码。
            </p>
            <Button
              variant="primary"
              icon={<Icon name="refresh" size={16} aria-hidden />}
              onClick={() => navigate(PATHS.githubIntegration(teamId))}
            >
              处理团队 GitHub 授权
            </Button>
          </div>
        ) : (
          <Section
            title="已导入仓库"
            aside={
              <label className="inline-search">
                <span className="sr">搜索仓库</span>
                <Icon name="search" size={15} />
                <input
                  type="search"
                  placeholder="搜索仓库"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            }
          >
            {imported.isPending ? (
              <Skeleton rows={3} />
            ) : imported.isError ? (
              <EmptyState
                title="仓库加载失败"
                description={formatApiError(imported.error)}
                action={
                  <Button variant="link" onClick={() => void imported.refetch()}>
                    重试
                  </Button>
                }
                stacked
              />
            ) : rows.length === 0 ? (
              search.trim() ? (
                <EmptyState
                  icon="search"
                  title="没有匹配的仓库"
                  description="清空筛选可以看全部已导入仓库。"
                  action={
                    <Button variant="link" onClick={() => setSearch('')}>
                      清空筛选
                    </Button>
                  }
                  stacked
                />
              ) : (
                <EmptyState
                  icon="repo"
                  title="还没有导入仓库"
                  description="Qgent 只能读写已导入本项目的仓库；先导入一个，才能在群里派活。"
                  action={
                    canManage ? (
                      <Button
                        variant="primary"
                        icon={<Icon name="plus" size={16} aria-hidden />}
                        onClick={() => setImportOpen(true)}
                      >
                        导入仓库
                      </Button>
                    ) : undefined
                  }
                  stacked
                />
              )
            ) : (
              <DataTable layout="repos" columns={['仓库', '默认分支', '类型', '']}>
                {rows.map((repo) => (
                  <TableRow key={repo.id}>
                    <TableCell className="repo-name">
                      <span className="repo-cell">
                        <span className="repo-cell__icon" aria-hidden>
                          <Icon name="repo" size={16} />
                        </span>
                        <span className="repo-cell__body">
                          <span className="name">{repo.fullName}</span>
                          <a
                            className="meta repo-url"
                            href={repo.htmlUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {repo.htmlUrl}
                          </a>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="mono">{repo.defaultBranch || '—'}</TableCell>
                    <TableCell className="meta">
                      {repo.privateRepository ? '私有' : '公开'}
                    </TableCell>
                    <TableCell end>
                      {canManage ? (
                        <Button variant="link" size="sm" onClick={() => setRemoval(repo)}>
                          移除
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </DataTable>
            )}
            {imported.data?.length ? (
              <p className="note">
                移除只取消本项目引用，不会删除 GitHub 上的仓库，也不影响团队其他项目。
              </p>
            ) : null}
          </Section>
        )}
      </Page>

      <Dialog
        open={importOpen}
        onClose={closeImport}
        title="导入仓库"
        description="只列出团队 GitHub App 授权、且尚未导入本项目的仓库。"
      >
        {available.isError ? (
          <div className="field">
            <p className="sub">{formatApiError(available.error)}</p>
            <Button variant="quiet" onClick={() => void available.refetch()}>
              重试
            </Button>
          </div>
        ) : available.isPending ? (
          <Skeleton rows={3} />
        ) : options.length === 0 ? (
          <div className="field">
            <p className="sub">没有可导入的仓库。请确认团队 GitHub App 已授权这些仓库。</p>
            <Button variant="quiet" onClick={() => navigate(PATHS.githubIntegration(teamId))}>
              管理团队 GitHub 授权
            </Button>
          </div>
        ) : (
          <>
            <label className="inline-search repo-search">
              <span className="sr">搜索可导入仓库</span>
              <Icon name="search" size={15} />
              <input
                type="search"
                placeholder="搜索仓库"
                value={repoSearch}
                onChange={(event) => setRepoSearch(event.target.value)}
              />
            </label>
            <div className="checks repo-list">
              {visibleOptions.map((repo) => (
                <label className="check" key={repoKey(repo)}>
                  <input
                    type="checkbox"
                    checked={selected.includes(repoKey(repo))}
                    onChange={() => toggle(repoKey(repo))}
                  />
                  <span>{repo.fullName}</span>
                </label>
              ))}
            </div>
            {visibleOptions.length === 0 ? <p className="note">没有匹配的仓库。</p> : null}
          </>
        )}
        <div className="dlg__foot">
          <Button variant="quiet" onClick={closeImport}>
            取消
          </Button>
          <Button
            variant="primary"
            disabled={!selected.length || importRepos.isPending}
            onClick={() =>
              importRepos.mutate(options.filter((repo) => selected.includes(repoKey(repo))))
            }
          >
            {importRepos.isPending ? '导入中…' : '导入所选仓库'}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(removal)}
        onClose={() => (remove.isPending ? undefined : setRemoval(null))}
        title="从项目移除仓库"
        description={removal?.fullName}
        danger
      >
        <p className="sub">
          移除只取消本项目引用，不会删除 GitHub 上的仓库，也不影响团队其他项目。
        </p>
        <div className="dlg__foot">
          <Button variant="quiet" onClick={() => setRemoval(null)}>
            取消
          </Button>
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => {
              if (removal) remove.mutate(removal.id)
            }}
          >
            {remove.isPending ? '移除中…' : '移除'}
          </Button>
        </div>
      </Dialog>
    </main>
  )
}
