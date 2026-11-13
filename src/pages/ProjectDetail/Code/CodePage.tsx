import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Alert,
  App,
  Button,
  Checkbox,
  Input,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Spin,
  Tag,
} from 'antd'
import { GithubOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/api/project'
import { repositoriesApi } from '@/api/repositories'
import type { AvailableRepository } from '@/api/repositories'
import { formatApiError } from '@/utils/formatApiError'
import { PATHS } from '@/routes/paths'
import { ProjectPage } from '../ProjectPage'
import './CodePage.css'

export function CodePage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { message } = App.useApp()
  const client = useQueryClient()
  const [importOpen, setImportOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [repoSearch, setRepoSearch] = useState('')
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
  const importedRepos = (imported.data ?? []).filter((repo) =>
    repo.fullName.toLowerCase().includes(search.toLowerCase()),
  )
  const matchesSearch = (repo: AvailableRepository) =>
    repo.fullName.toLowerCase().includes(repoSearch.trim().toLowerCase())
  // 少量候选用可搜索的复选框列表，一眼勾选；候选多时仍用下拉搜索。
  const smallList = options.length <= 8
  const optionKey = (repo: AvailableRepository) => `${repo.installationId}:${repo.repositoryId}`
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
    <ProjectPage
      title="仓库"
      action={
        canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setImportOpen(true)}>
            导入仓库
          </Button>
        )
      }
    >
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
          <Link className="code-actions__link" to={PATHS.githubIntegration(teamId)}>
            <GithubOutlined aria-hidden /> 团队 GitHub 授权
          </Link>
        </div>
      </div>
      {imported.isError ? (
        <Alert
          type="error"
          showIcon
          title={formatApiError(imported.error)}
          action={<Button onClick={() => void imported.refetch()}>重试</Button>}
        />
      ) : imported.isPending ? (
        <Spin delay={180} />
      ) : !(imported.data ?? []).length ? (
        <p className="code-empty">还没有导入仓库。</p>
      ) : importedRepos.length === 0 ? (
        <p className="code-empty">没有匹配的仓库。</p>
      ) : (
        <div className="workspace-page__grid">
          {importedRepos.map((repo) => (
            <article className="code-card" key={repo.id}>
              <h2 className="code-card__title">
                <GithubOutlined aria-hidden /> {repo.fullName}
              </h2>
              {repo.privateRepository && <Tag>私有</Tag>}
              <p className="code-card__meta">
                默认分支 <span className="code-card__branch">{repo.defaultBranch || '未设置'}</span>
              </p>
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
      <Modal
        title="导入 GitHub 仓库"
        open={importOpen}
        onCancel={() => {
          setImportOpen(false)
          setRepoSearch('')
        }}
        okText="导入所选仓库"
        cancelText="取消"
        confirmLoading={importRepos.isPending}
        okButtonProps={{ disabled: !selected.length }}
        onOk={() =>
          importRepos.mutate(options.filter((repo) => selected.includes(optionKey(repo))))
        }
      >
        {available.isError ? (
          <Alert
            type="error"
            showIcon
            title={formatApiError(available.error)}
            action={<Button onClick={() => void available.refetch()}>重试</Button>}
          />
        ) : available.isPending ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : !options.length ? (
          <p className="code-empty">
            没有可导入的仓库。<Link to={PATHS.githubIntegration(teamId)}>管理团队 GitHub 授权</Link>
          </p>
        ) : smallList ? (
          <div className="code-repo-picker">
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索仓库"
              aria-label="搜索可导入仓库"
              value={repoSearch}
              onChange={(event) => setRepoSearch(event.target.value)}
              allowClear
            />
            <Checkbox.Group className="code-repo-list" value={selected} onChange={setSelected}>
              {options.filter(matchesSearch).map((repo) => (
                <Checkbox key={optionKey(repo)} value={optionKey(repo)}>
                  {repo.fullName}
                </Checkbox>
              ))}
            </Checkbox.Group>
            {!options.some(matchesSearch) && <p className="code-empty">没有匹配的仓库。</p>}
          </div>
        ) : (
          <Select
            mode="multiple"
            className="code-select"
            optionFilterProp="label"
            placeholder="搜索并选择仓库"
            value={selected}
            onChange={setSelected}
            options={options.map((repo) => ({
              value: optionKey(repo),
              label: repo.fullName,
            }))}
          />
        )}
      </Modal>
    </ProjectPage>
  )
}
