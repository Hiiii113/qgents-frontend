import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
  Tabs,
  Tag,
} from '@/components/ui'
import { GithubItems } from './GithubItems'
import './repos.css'

const repoKey = (repo: AvailableRepository) => `${repo.installationId}:${repo.repositoryId}`

const TABS = [
  { key: 'repos', label: '仓库' },
  { key: 'pulls', label: 'Pull Request' },
  { key: 'issues', label: 'Issue' },
] as const

type TabKey = (typeof TABS)[number]['key']

/**
 * 项目代码：仓库导入与移除，以及只读的 Pull Request / Issue 页签。
 * 连接断开时整块替换为阻断说明；移除只取消本项目引用。
 */
export default function ReposPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [params, setParams] = useSearchParams()
  const tab: TabKey = TABS.find((item) => item.key === params.get('tab'))?.key ?? 'repos'
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
          title="代码"
          actions={
            tab === 'repos' &&
            canManage &&
            connections.isSuccess &&
            !disconnected &&
            imported.data?.length ? (
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
              <Button
                variant="link"
                onClick={() => void project.refetch()}
                icon={<Icon name="refresh" size={15} />}
              >
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
        ) : disconnected ? (
          <div className="block repo-block">
            <span className="repo-block__icon" aria-hidden>
              <Icon name="unlink" size={20} />
            </span>
            <p className="h3">这个项目的仓库暂时无法访问</p>
            <p className="repo-block__reason">
              {connections.data.length === 0
                ? '团队还没有连接 GitHub App'
                : '团队 GitHub App 的连接已失效'}
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
          <>
            <Tabs
              label="代码分区"
              items={TABS.map((item) => ({ key: item.key, label: item.label }))}
              value={tab}
              onChange={(key) => {
                const next = new URLSearchParams(params)
                if (key === 'repos') next.delete('tab')
                else next.set('tab', key)
                setParams(next, { replace: true })
              }}
            />
            {tab === 'repos' ? (
              <Section
                title={
                  <span className="repo-section-title">
                    已导入仓库
                    <span className="repo-count">{rows.length}</span>
                  </span>
                }
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
                      <Button
                        variant="link"
                        onClick={() => void imported.refetch()}
                        icon={<Icon name="refresh" size={15} />}
                      >
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
                      action={
                        <Button
                          variant="link"
                          onClick={() => setSearch('')}
                          icon={<Icon name="close" size={15} />}
                        >
                          清空筛选
                        </Button>
                      }
                      stacked
                    />
                  ) : (
                    <EmptyState
                      icon="repo"
                      title="还没有导入仓库"
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
                              <a
                                className="name repo-cell__name"
                                href={repo.htmlUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <span className="repo-cell__label">{repo.fullName}</span>
                                <Icon name="external" size={12} className="repo-cell__ext" />
                              </a>
                              <span className="meta repo-url">{repo.htmlUrl}</span>
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="branch-pill">
                            <Icon name="branch" size={13} />
                            <span className="branch-pill__name">
                              {repo.defaultBranch || '—'}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>
                          {repo.privateRepository ? (
                            <Tag tone="readonly" icon="lock">
                              私有
                            </Tag>
                          ) : (
                            <Tag icon="eye">公开</Tag>
                          )}
                        </TableCell>
                        <TableCell end>
                          {canManage ? (
                            <Button
                              variant="ghost-danger"
                              size="sm"
                              onClick={() => setRemoval(repo)}
                            >
                              移除
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </DataTable>
                )}
              </Section>
            ) : imported.isPending ? (
              <Skeleton rows={4} />
            ) : imported.isError ? (
              <EmptyState
                title="仓库加载失败"
                description={formatApiError(imported.error)}
                action={
                  <Button
                    variant="link"
                    onClick={() => void imported.refetch()}
                    icon={<Icon name="refresh" size={15} />}
                  >
                    重试
                  </Button>
                }
                stacked
              />
            ) : (
              <GithubItems
                key={tab}
                kind={tab}
                projectId={projectId}
                repositories={imported.data}
              />
            )}
          </>
        )}
      </Page>

      <Dialog open={importOpen} onClose={closeImport} title="导入仓库">
        {available.isError ? (
          <div className="repo-dialog-state">
            <span className="repo-dialog-state__icon" aria-hidden>
              <Icon name="alert" size={18} />
            </span>
            <p className="sub">{formatApiError(available.error)}</p>
            <Button
              variant="quiet"
              onClick={() => void available.refetch()}
              icon={<Icon name="refresh" size={15} />}
            >
              重试
            </Button>
          </div>
        ) : available.isPending ? (
          <Skeleton rows={3} />
        ) : options.length === 0 ? (
          <div className="repo-dialog-state">
            <span className="repo-dialog-state__icon" aria-hidden>
              <Icon name="repo" size={18} />
            </span>
            <p className="row-empty__title">没有可导入的仓库</p>
            <Button
              variant="quiet"
              onClick={() => navigate(PATHS.githubIntegration(teamId))}
              icon={<Icon name="branch" size={15} />}
            >
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
            <div className="repo-options" role="group" aria-label="可导入的仓库">
              {visibleOptions.map((repo) => {
                const key = repoKey(repo)
                const checked = selected.includes(key)
                return (
                  <label
                    className={`repo-option${checked ? ' repo-option--on' : ''}`}
                    key={key}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(key)}
                    />
                    <span className="repo-option__icon" aria-hidden>
                      <Icon name="repo" size={15} />
                    </span>
                    <span className="repo-option__name">{repo.fullName}</span>
                    <span className="repo-option__tick" aria-hidden>
                      <Icon name="check" size={13} />
                    </span>
                  </label>
                )
              })}
            </div>
            {visibleOptions.length === 0 ? (
              <p className="repo-option-empty">没有匹配的仓库</p>
            ) : null}
          </>
        )}
        <div className="dlg__foot">
          <Button variant="quiet" onClick={closeImport} icon={<Icon name="close" size={15} />}>
            取消
          </Button>
          <Button
            variant="primary"
            icon={<Icon name="plus" size={15} />}
            disabled={!selected.length || importRepos.isPending}
            onClick={() =>
              importRepos.mutate(options.filter((repo) => selected.includes(repoKey(repo))))
            }
          >
            {importRepos.isPending
              ? '导入中…'
              : selected.length
                ? `导入所选仓库（${selected.length}）`
                : '导入所选仓库'}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(removal)}
        onClose={() => (remove.isPending ? undefined : setRemoval(null))}
        title="从项目移除仓库"
        danger
      >
        {removal ? (
          <div className="repo-removal">
            <span className="repo-removal__name">
              <Icon name="repo" size={15} />
              {removal.fullName}
            </span>
            <span className="repo-removal__fact">
              <Icon name="unlink" size={14} />
              只取消本项目引用，GitHub 仓库保留
            </span>
          </div>
        ) : null}
        <div className="dlg__foot">
          <Button
            variant="quiet"
            onClick={() => setRemoval(null)}
            icon={<Icon name="close" size={15} />}
          >
            取消
          </Button>
          <Button
            variant="danger"
            icon={<Icon name="trash" size={15} />}
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
