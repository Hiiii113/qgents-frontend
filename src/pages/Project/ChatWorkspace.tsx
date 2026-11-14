import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { App } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chatApi } from '@/api/chat'
import { projectApi } from '@/api/project'
import { chatKeys } from '@/query/chatKeys'
import { chatPreview, type ChatGroup } from '@/types/chat'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { formatApiError } from '@/utils/formatApiError'
import { useAppUiStore } from '@/store/appUiStore'
import { Button, EmptyState, Icon, IconButton, Skeleton } from '@/components/ui'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { GroupMembersDialog } from '@/components/chat/GroupMembersDialog'
import '@/components/chat/chat.css'

/**
 * 项目聊天路由：左侧群聊列（可搜索、置顶、变更提示），主列聊天，右侧执行轨迹。
 * 群聊列只在聊天页出现；非聊天页不加载也不占位。
 */
export default function ChatWorkspace() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [params, setParams] = useSearchParams()
  const { message } = App.useApp()
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const contextOpen = useAppUiStore((state) => state.chatContextOpen)
  const setContextOpen = useAppUiStore((state) => state.setChatContextOpen)

  const project = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: Boolean(projectId),
  })
  const groups = useQuery({
    queryKey: chatKeys.groups(projectId),
    queryFn: () => chatApi.groups(projectId),
    enabled: Boolean(projectId),
  })

  const pin = useMutation({
    mutationFn: (group: ChatGroup) => chatApi.pin(projectId, group.id, !group.pinned),
    onSuccess: () => void client.invalidateQueries({ queryKey: chatKeys.groups(projectId) }),
    onError: (error) => void message.error(formatApiError(error)),
  })

  const activityAt = (group: ChatGroup) =>
    new Date(group.latestActivityAt ?? group.lastMessageAt ?? 0).getTime() || 0
  const sorted = useMemo(
    () =>
      [...(groups.data ?? [])].sort(
        (a, b) =>
          Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
          activityAt(b) - activityAt(a) ||
          a.title.localeCompare(b.title),
      ),
    [groups.data],
  )
  const groupParam = params.get('groupId')
  const selectedId =
    groupParam || groups.data?.find((group) => group.defaultGroup)?.id || groups.data?.[0]?.id
  const selected = groups.data?.find((group) => group.id === selectedId)
  const keyword = search.trim().toLowerCase()
  const visible = sorted.filter((group) => group.title.toLowerCase().includes(keyword))

  // 变更的行亮着直到你看过：进入某个群就把当前活动时间记为已见。
  const seenAt = useRef(new Map<string, number>())
  useEffect(() => {
    if (!groups.data) return
    for (const group of groups.data)
      if (!seenAt.current.has(group.id)) seenAt.current.set(group.id, activityAt(group))
    const current = groups.data.find((group) => group.id === selectedId)
    if (current) seenAt.current.set(current.id, activityAt(current))
  }, [groups.data, selectedId])
  const isChanged = (group: ChatGroup) => {
    const seen = seenAt.current.get(group.id)
    return seen !== undefined && activityAt(group) > seen && group.id !== selectedId
  }

  // 离开聊天页时收起窄屏覆盖层。
  useEffect(() => () => setContextOpen(false), [setContextOpen])

  const selectGroup = (groupId: string) => {
    setContextOpen(false)
    const next = new URLSearchParams()
    next.set('groupId', groupId)
    setParams(next, { replace: true })
  }

  const context = (
    <aside className={`context${contextOpen ? ' is-open' : ''}`} aria-label="群聊列表">
      <div className="context__head">
        <h2 className="context__title">群聊</h2>
        <IconButton
          label="新建群聊"
          square
          disabled={project.data?.status === 'ARCHIVED'}
          onClick={() => setCreateOpen(true)}
        >
          <Icon name="plus" size={16} />
        </IconButton>
      </div>
      <div className="context__search">
        <label className="sr" htmlFor="group-search">
          搜索群聊
        </label>
        <input
          id="group-search"
          type="search"
          placeholder="搜索群聊"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <ul className="grouplist">
        {visible.map((group) => {
          const changed = isChanged(group)
          return (
            <li key={group.id} className="grouprow-wrap">
              <button
                type="button"
                className="grouprow"
                aria-current={group.id === selectedId}
                onClick={() => selectGroup(group.id)}
              >
                <span className="grouprow__name">{group.title}</span>
                <span className="grouprow__meta">
                  <span className="grouprow__preview">
                    {group.latestMessage?.text
                      ? `${group.latestMessage.senderName ?? ''}${
                          group.latestMessage.senderName ? '：' : ''
                        }${chatPreview(group.latestMessage.text)}`
                      : '开始新的讨论'}
                  </span>
                  <time data-fresh={changed || Boolean(group.unreadCount) || undefined}>
                    {group.latestActivityAt || group.lastMessageAt
                      ? formatRelativeTime(group.latestActivityAt ?? group.lastMessageAt ?? '')
                      : ''}
                  </time>
                </span>
              </button>
              <button
                type="button"
                className="grouprow__pin"
                aria-label={group.pinned ? '取消置顶' : '置顶'}
                aria-pressed={Boolean(group.pinned)}
                onClick={() => pin.mutate(group)}
              >
                <Icon name="skill" size={13} />
              </button>
            </li>
          )
        })}
      </ul>
      {visible.length === 0 ? (
        <p className="context__empty">
          {keyword ? `没有匹配「${search.trim()}」的群聊。` : '还没有群聊。'}
        </p>
      ) : null}
      <div className="context__foot">
        <span className="meta">
          {groups.data?.length ?? 0} 个群聊
          {groups.data?.some((group) => group.unreadCount)
            ? ` · ${groups.data.filter((group) => group.unreadCount).length} 个有未读`
            : ''}
        </span>
      </div>
    </aside>
  )

  if (groups.isPending) {
    return (
      <div className="body">
        {context}
        <main className="canvas">
          <Skeleton rows={5} />
        </main>
      </div>
    )
  }
  if (groups.isError) {
    return (
      <div className="body">
        {context}
        <main className="canvas">
          <div className="canvas-status">
            <div className="block">
              <p className="h3">群聊加载失败</p>
              <p className="sub">{formatApiError(groups.error)}</p>
              <Button
                variant="quiet"
                onClick={() => void groups.refetch()}
                icon={<Icon name="refresh" size={15} />}
              >
                重试
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }
  if (!selected) {
    return (
      <div className="body">
        {context}
        <main className="canvas">
          <div className="canvas-status">
            <EmptyState
              title={groupParam ? '你未加入该群聊，或群聊不存在' : '项目群聊尚未就绪'}
              description="项目创建时会自动生成默认群。"
              action={
                <Button
                  variant="quiet"
                  onClick={() => void groups.refetch()}
                  icon={<Icon name="refresh" size={15} />}
                >
                  刷新
                </Button>
              }
              stacked
            />
          </div>
        </main>
      </div>
    )
  }

  return (
    <>
      <ChatPanel key={selected.id} projectId={projectId} group={selected} contextPanel={context} />
      {contextOpen ? (
        <button
          type="button"
          className="scrim"
          aria-label="关闭群聊列表"
          onClick={() => setContextOpen(false)}
        />
      ) : null}
      <GroupMembersDialog
        projectId={projectId}
        teamId={project.data?.teamId ?? ''}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(group) => selectGroup(group.id)}
      />
    </>
  )
}
