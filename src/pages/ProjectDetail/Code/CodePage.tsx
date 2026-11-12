import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, App, Button, Input, Modal, Popconfirm, Select, Spin, Tag } from 'antd'
import { GithubOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/api/project'
import { repositoriesApi } from '@/api/repositories'
import type { AvailableRepository } from '@/api/repositories'
import { formatApiError } from '@/utils/formatApiError'
import { PATHS } from '@/routes/paths'
import './CodePage.css'

export function CodePage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { message } = App.useApp()
  const client = useQueryClient()
  const [importOpen, setImportOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const project = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: Boolean(projectId),
  })
  const teamId = project.data?.teamId || ''
  const imported = useQuery({
    queryKey: ['repositories', projectId],
    queryFn: () => repositoriesApi.imported(projectId),
    enabled: Boolean(projectId),
  })
  const available = useQuery({
    queryKey: ['github', teamId, 'available'],
    queryFn: () => repositoriesApi.available(teamId),
    enabled: Boolean(teamId && importOpen),
  })
  const canManage = project.data?.role === 'PROJECT_ADMIN'
  const importedIds = useMemo(
    () => new Set((imported.data ?? []).map((repo) => repo.providerRepositoryId)),
    [imported.data],
  )
  const options = (available.data ?? []).filter((repo) => !importedIds.has(repo.repositoryId))
  const importRepos = useMutation({
    mutationFn: async (repos: AvailableRepository[]) => {
      for (const repo of repos)
        await repositoriesApi.import(projectId, {
          installationId: repo.installationId,
          repositoryId: repo.repositoryId,
        })
    },
    onSuccess: () => {
      setImportOpen(false)
      setSelected([])
      void message.success('仓库已导入项目')
    },
    onError: (error) => void message.error(formatApiError(error)),
    onSettled: () => void client.invalidateQueries({ queryKey: ['repositories', projectId] }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => repositoriesApi.remove(projectId, id),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['repositories', projectId] }),
    onError: (error) => void message.error(formatApiError(error)),
  })
  return (
    <>
      <div className="workspace-page__toolbar">
        <Input
          className="code-search"
          prefix={<SearchOutlined />}
          placeholder="搜索仓库"
          aria-label="搜索仓库"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          allowClear
        />
        <div className="code-actions">
          <Link to={PATHS.githubIntegration(teamId)}>
            <Button icon={<GithubOutlined />}>GitHub 连接</Button>
          </Link>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setImportOpen(true)}>
              导入仓库
            </Button>
          )}
        </div>
      </div>
      {imported.isError && (
        <Alert
          type="error"
          showIcon
          message={formatApiError(imported.error)}
          action={<Button onClick={() => void imported.refetch()}>重试</Button>}
        />
      )}
      {imported.isPending ? (
        <Spin delay={180} />
      ) : !(imported.data ?? []).length ? (
        <p className="code-empty">还没有导入仓库。可以从 GitHub 导入，或直接在聊天里讨论。</p>
      ) : (
        <div className="workspace-page__grid">
          {(imported.data ?? [])
            .filter((repo) => repo.fullName.toLowerCase().includes(search.toLowerCase()))
            .map((repo) => (
              <article className="code-card" key={repo.id}>
                <h2 className="code-card__title">
                  <GithubOutlined aria-hidden /> {repo.fullName}
                </h2>
                <Tag>{repo.privateRepository ? '私有仓库' : '公开仓库'}</Tag>
                <p className="code-card__meta">默认分支 · {repo.defaultBranch || '尚未设置'}</p>
                <div className="code-card__actions">
                  <Button
                    type="text"
                    size="small"
                    href={repo.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开 GitHub
                  </Button>
                  {canManage && (
                    <Popconfirm
                      title="从项目移除这个仓库？"
                      description="不会删除 GitHub 上的仓库。"
                      onConfirm={() => remove.mutateAsync(repo.id)}
                    >
                      <Button
                        type="text"
                        danger
                        size="small"
                        loading={remove.isPending && remove.variables === repo.id}
                      >
                        移除
                      </Button>
                    </Popconfirm>
                  )}
                </div>
              </article>
            ))}
        </div>
      )}
      <p className="workspace-page__note">
        导入只登记可用仓库，不会自动克隆。需要查看改动、提交或创建 PR 时，在聊天里 @Qgent 说明目标。
      </p>
      <Modal
        title="导入 GitHub 仓库"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        okText="导入所选仓库"
        cancelText="取消"
        confirmLoading={importRepos.isPending}
        okButtonProps={{ disabled: !selected.length }}
        onOk={() =>
          importRepos.mutate(
            options.filter((repo) =>
              selected.includes(`${repo.installationId}:${repo.repositoryId}`),
            ),
          )
        }
      >
        <p>选择团队 GitHub App 已授权的仓库。</p>
        {available.isError ? (
          <Alert type="error" message={formatApiError(available.error)} />
        ) : (
          <Select
            mode="multiple"
            className="code-select"
            optionFilterProp="label"
            placeholder="搜索并选择仓库"
            loading={available.isPending}
            value={selected}
            onChange={setSelected}
            options={options.map((repo) => ({
              value: `${repo.installationId}:${repo.repositoryId}`,
              label: repo.fullName,
            }))}
          />
        )}
        {!available.isPending && !options.length && (
          <p>
            没有可导入的仓库。
            <Link to={PATHS.githubIntegration(teamId)}>管理 GitHub 连接与授权</Link>
          </p>
        )}
      </Modal>
    </>
  )
}
