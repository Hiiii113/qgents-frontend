import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { App } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chatApi } from '@/api/chat'
import { directMessageApi } from '@/api/directMessage'
import { projectApi } from '@/api/project'
import { chatKeys } from '@/query/chatKeys'
import { chatPreview, type ChatGroup } from '@/types/chat'
import { directActivityAt } from '@/types/directMessage'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { formatApiError } from '@/utils/formatApiError'
import { useAppUiStore } from '@/store/appUiStore'
import { Button, EmptyState, Icon, IconButton, Skeleton, Tabs } from '@/components/ui'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { DirectMessageList } from '@/components/chat/DirectMessageList'
import { DirectMessagePanel } from '@/components/chat/DirectMessagePanel'
import { GroupMembersDialog } from '@/components/chat/GroupMembersDialog'
import { StartDirectMessageDialog } from '@/components/chat/StartDirectMessageDialog'
import '@/components/chat/chat.css'

type ChatTab = 'groups' | 'direct'

/**
 * 项目聊天路由：左侧列在群聊与私聊之间切换，主列是聊天与工具调用。
 * 会话选择放在 URL（groupId / dm），刷新和分享都能回到同一条会话；
 * 切换会话时按会话 id 重新挂载，上一个会话的消息不会留在界面上。
 */
export default function ChatWorkspace() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [params, setParams] = useSearchParams()
  const { message } = App.useApp()
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [startDirectOpen, setStartDirectOpen] = useState(false)
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
  const conversations = useQuery({
    queryKey: chatKeys.conversations(projectId),
    queryFn: () => directMessageApi.conversations(projectId),
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
  const conversationParam = params.get('dm')
  // 页签也由 URL 决定：?dm= 或 ?view=direct 是私聊，其余是群聊。
  // 这样后退、直达链接和浏览器刷新都不会出现「URL 是群聊、界面停在私聊」。
  const tab: ChatTab = conversationParam || params.get('view') === 'direct' ? 'direct' : 'groups'
  const selectedId =
    groupParam || groups.data?.find((group) => group.defaultGroup)?.id || groups.data?.[0]?.id
  const selected = groups.data?.find((group) => group.id === selectedId)
  const conversation = conversations.data?.find((item) => item.id === conversationParam)
  const sortedConversations = useMemo(
    () => [...(conversations.data ?? [])].sort((a, b) => directActivityAt(b) - directActivityAt(a)),
    [conversations.data],
  )
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

  const routeTo = (next: { groupId?: string; dm?: string; view?: 'direct' }) => {
    setContextOpen(false)
    const url = new URLSearchParams()
    if (next.groupId) url.set('groupId', next.groupId)
    if (next.dm) url.set('dm', next.dm)
    if (next.view) url.set('view', next.view)
    setParams(url, { replace: true })
  }

  const selectGroup = (groupId: string) => routeTo({ groupId })
  const selectConversation = (id: string) => routeTo({ dm: id })

  const switchTab = (next: ChatTab) => {
    if (next === tab) return
    setSearch('')
    // 切回群聊时保留默认群；切到私聊只列会话，不替用户打开某一条（否则会直接把它标成已读）。
    if (next === 'groups') routeTo(selected ? { groupId: selected.id } : {})
    else routeTo({ view: 'direct' })
  }

  const archived = project.data?.status === 'ARCHIVED'
  const directTotalUnread = sortedConversations.reduce(
    (total, item) => total + (item.unreadCount ?? 0),
    0,
  )

  const context = (
    <aside className={`context${contextOpen ? ' is-open' : ''}`} aria-label="会话列表">
      <div className="context__head">
        <Tabs
          className="context__tabs"
          label="会话类型"
          value={tab}
          onChange={(next) => switchTab(next === 'direct' ? 'direct' : 'groups')}
          items={[
            { key: 'groups', label: '群聊' },
            { key: 'direct', label: '私聊' },
          ]}
        />
        <IconButton
          label={tab === 'groups' ? '新建群聊' : '发起私聊'}
          square
          disabled={archived}
          onClick={() => (tab === 'groups' ? setCreateOpen(true) : setStartDirectOpen(true))}
        >
          <Icon name="plus" size={16} />
        </IconButton>
      </div>
      <div className="context__search">
        <label className="sr" htmlFor="conversation-search">
          {tab === 'groups' ? '搜索群聊' : '搜索私聊'}
        </label>
        <input
          id="conversation-search"
          type="search"
          placeholder={tab === 'groups' ? '搜索群聊' : '搜索私聊'}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {tab === 'groups' ? (
        <>
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
        </>
      ) : (
        <>
          <DirectMessageList
            conversations={sortedConversations}
            selectedId={conversation?.id ?? null}
            keyword={keyword}
            pending={conversations.isPending}
            onSelect={(item) => selectConversation(item.id)}
          />
          <div className="context__foot">
            <span className="meta">
              {conversations.isPending ? '正在加载…' : `${conversations.data?.length ?? 0} 个私聊`}
              {directTotalUnread ? ` · ${directTotalUnread} 条未读` : ''}
            </span>
          </div>
        </>
      )}
    </aside>
  )

  const overlays = (
    <>
      {contextOpen ? (
        <button
          type="button"
          className="scrim"
          aria-label="关闭会话列表"
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
      <StartDirectMessageDialog
        projectId={projectId}
        teamId={project.data?.teamId ?? ''}
        open={startDirectOpen}
        onClose={() => setStartDirectOpen(false)}
        onOpened={(opened) => selectConversation(opened.id)}
      />
    </>
  )

  /** 左侧列常驻：加载与空态也不把列表收起来。 */
  const frame = (content: React.ReactNode) => (
    <>
      <div className="body">
        {context}
        <main className="canvas">{content}</main>
      </div>
      {overlays}
    </>
  )

  const loading = tab === 'groups' ? groups.isPending : conversations.isPending
  if (loading) return frame(<Skeleton rows={5} />)

  const failure = tab === 'groups' ? groups.error : conversations.error
  if (failure)
    return frame(
      <div className="canvas-status">
        <div className="block">
          <p className="h3">{tab === 'groups' ? '群聊加载失败' : '私聊加载失败'}</p>
          <p className="sub">{formatApiError(failure)}</p>
          <Button
            variant="quiet"
            onClick={() => void (tab === 'groups' ? groups.refetch() : conversations.refetch())}
            icon={<Icon name="refresh" size={15} />}
          >
            重试
          </Button>
        </div>
      </div>,
    )

  if (tab === 'direct') {
    if (!conversation)
      return frame(
        <div className="canvas-status">
          <EmptyState
            icon="chat"
            title={conversationParam ? '这条私聊不存在或你不在其中' : '选择一条私聊'}
            description={
              conversationParam
                ? '私聊记录只有会话双方能看；如果对方已不在项目里，这条会话也不会再出现。'
                : '给对方发第一条消息就会建立会话，不需要邀请。'
            }
            action={
              <Button
                variant={conversationParam ? 'quiet' : 'primary'}
                onClick={() =>
                  conversationParam ? void conversations.refetch() : setStartDirectOpen(true)
                }
                icon={<Icon name={conversationParam ? 'refresh' : 'plus'} size={15} />}
              >
                {conversationParam ? '刷新' : '发起私聊'}
              </Button>
            }
            stacked
          />
        </div>,
      )
    return (
      <>
        <DirectMessagePanel
          key={conversation.id}
          projectId={projectId}
          projectName={project.data?.name ?? projectId}
          conversation={conversation}
          archived={Boolean(archived)}
          contextPanel={context}
        />
        {overlays}
      </>
    )
  }

  if (!selected)
    return frame(
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
      </div>,
    )

  return (
    <>
      <ChatPanel key={selected.id} projectId={projectId} group={selected} contextPanel={context} />
      {overlays}
    </>
  )
}
