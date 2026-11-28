import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { repositoriesApi } from '@/api/repositories'
import type {
  ImportedRepository,
  IssueItem,
  ItemState,
  PullRequestItem,
} from '@/api/repositories'
import { formatApiError } from '@/utils/formatApiError'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import {
  Button,
  DataTable,
  EmptyState,
  Icon,
  MenuSelect,
  Section,
  Skeleton,
  TableCell,
  TableRow,
  Tag,
} from '@/components/ui'

type Kind = 'pulls' | 'issues'
type Item = PullRequestItem | IssueItem

const STATES: { value: ItemState; label: string }[] = [
  { value: 'open', label: '开放' },
  { value: 'closed', label: '已关闭' },
  { value: 'all', label: '全部' },
]

const isMerged = (item: Item): item is PullRequestItem => 'merged' in item && item.merged

/**
 * 只读 PR / Issue 列表：默认汇总所有已导入仓库的开放条目，可按状态和仓库筛选。
 * 条目直接链接 GitHub 原文，Qgent 不在本地保存副本。
 */
export function GithubItems({
  projectId,
  kind,
  repositories,
}: {
  projectId: string
  kind: Kind
  repositories: ImportedRepository[]
}) {
  const [state, setState] = useState<ItemState>('open')
  const [repositoryId, setRepositoryId] = useState('')
  const items = useQuery({
    queryKey: ['github', projectId, 'items', kind, state, repositoryId],
    queryFn: () => {
      const query = {
        state,
        repositoryId: repositoryId ? Number(repositoryId) : undefined,
      }
      return kind === 'pulls'
        ? repositoriesApi.pullRequests(projectId, query)
        : repositoriesApi.issues(projectId, query)
    },
    enabled: repositories.length > 0,
  })

  const rows: Item[] = items.data ?? []
  const noun = kind === 'pulls' ? 'Pull Request' : 'Issue'
  const stateLabel = STATES.find((option) => option.value === state)?.label ?? '开放'
  const emptyTitle =
    state === 'all' ? `没有 ${noun}` : `没有${stateLabel}的 ${noun}`

  return (
    <Section
      title={noun}
      aside={
        <div className="item-filters">
          <MenuSelect
            variant="pill"
            align="end"
            aria-label="状态"
            value={state}
            options={STATES}
            onChange={(next) => setState(next)}
          />
          <MenuSelect
            variant="pill"
            align="end"
            aria-label="仓库"
            value={repositoryId}
            options={[
              { value: '', label: '全部仓库' },
              ...repositories.map((repository) => ({
                value: String(repository.providerRepositoryId),
                label: repository.fullName,
              })),
            ]}
            onChange={(next) => setRepositoryId(next)}
          />
        </div>
      }
    >
      {repositories.length === 0 ? (
        <EmptyState icon="repo" title="还没有导入仓库" stacked />
      ) : items.isPending ? (
        <Skeleton rows={4} />
      ) : items.isError ? (
        <EmptyState
          title={`${noun} 加载失败`}
          description={formatApiError(items.error)}
          action={
            <Button
              variant="link"
              onClick={() => void items.refetch()}
              icon={<Icon name="refresh" size={15} />}
            >
              重试
            </Button>
          }
          stacked
        />
      ) : rows.length === 0 ? (
        <EmptyState icon="inbox" title={emptyTitle} stacked />
      ) : (
        <DataTable layout="items" columns={['标题', '仓库', '状态', '更新']}>
          {rows.map((item) => {
            const merged = isMerged(item)
            return (
              <TableRow key={`${item.repository}#${item.number}`}>
                <TableCell>
                  <a
                    className="item-link"
                    href={item.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="item-link__head">
                      <span className="name">{item.title}</span>
                      <Icon name="external" size={12} className="item-link__ext" />
                    </span>
                    <span className="meta">
                      #{item.number}
                      {item.author ? ` · ${item.author}` : ''}
                    </span>
                  </a>
                </TableCell>
                <TableCell className="mono">{item.repository}</TableCell>
                <TableCell>
                  <Tag tone={merged ? 'agent' : item.state === 'open' ? 'ok' : 'neutral'}>
                    {merged ? '已合并' : item.state === 'open' ? '开放' : '已关闭'}
                  </Tag>
                </TableCell>
                <TableCell className="meta">{formatRelativeTime(item.updatedAt)}</TableCell>
              </TableRow>
            )
          })}
        </DataTable>
      )}
    </Section>
  )
}
