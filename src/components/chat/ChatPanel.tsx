import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { App } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chatApi } from '@/api/chat'
import { projectApi } from '@/api/project'
import { useAuth } from '@/context/AuthContext'
import { useAgentRuns } from '@/features/agent-runs'
import { isTerminalStatus, type AgentRun } from '@/features/agent-runs/types'
import { formatApiError } from '@/utils/formatApiError'
import type { Page } from '@/types/api'
import { messageField, type ChatGroup, type ChatMessage, type SendChatMessage } from '@/types/chat'
import type { InfiniteData } from '@tanstack/react-query'
import { chatKeys, mergeChatMessages, useChatMessages } from './useChatMessages'
import { ChatComposer, type ChatComposerHandle } from './ChatComposer'
import { ChatMessageList } from './ChatMessageList'
import { GroupMembersDialog } from './GroupMembersDialog'
import { TracePanel } from './TracePanel'
import { MembersPanel } from './MembersPanel'
import { Button, Icon } from '@/components/ui'
import { useAppUiStore } from '@/store/appUiStore'
import './chat.css'

const AttachmentPreviewLazy = lazy(async () => ({
  default: (await import('./AttachmentPreview')).AttachmentPreview,
}))

/**
 * 聊天工作区：群聊列（由页面传入）+ 消息画布 + 执行轨迹。
 * 输入、历史消息、运行状态各自独立，打字不会重渲染消息列表。
 */
export function ChatPanel({
  projectId,
  group,
  contextPanel,
}: {
  projectId: string
  group: ChatGroup
  contextPanel: React.ReactNode
}) {
  const { message } = App.useApp()
  const { user } = useAuth()
  const client = useQueryClient()
  const [params] = useSearchParams()
  const [reply, setReply] = useState<ChatMessage | null>(null)
  const [preview, setPreview] = useState<ChatMessage | null>(null)
  const [membersOpen, setMembersOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [targetId, setTargetId] = useState<string | null>(params.get('messageId'))
  const [readingLatest, setReadingLatest] = useState(true)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const composerRef = useRef<ChatComposerHandle>(null)
  const membersButtonRef = useRef<HTMLButtonElement>(null)
  const traceOpen = useAppUiStore((state) => state.chatTraceOpen)
  const setTraceOpen = useAppUiStore((state) => state.setChatTraceOpen)
  const groupId = group.id

  const closeMembers = useCallback(() => {
    setMembersOpen(false)
    requestAnimationFrame(() => membersButtonRef.current?.focus())
  }, [])

  const toggleMembers = useCallback(() => {
    if (membersOpen) {
      closeMembers()
      return
    }
    setTraceOpen(false)
    setMembersOpen(true)
  }, [closeMembers, membersOpen, setTraceOpen])

  const toggleTrace = useCallback(() => {
    if (traceOpen) {
      setTraceOpen(false)
      return
    }
    setMembersOpen(false)
    setTraceOpen(true)
  }, [setTraceOpen, traceOpen])

  // 窄屏轨迹是覆盖层：首次进入先不叠在画布上，点运行卡或页头按钮再打开。
  useEffect(() => {
    if (window.matchMedia('(max-width: 1100px)').matches) setTraceOpen(false)
  }, [setTraceOpen])

  const project = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: Boolean(projectId),
  })
  const members = useQuery({
    queryKey: chatKeys.members(projectId, groupId),
    queryFn: () => chatApi.members(projectId, groupId),
    enabled: Boolean(groupId),
  })
  const chat = useChatMessages(projectId, groupId, readingLatest)
  const agentRuns = useAgentRuns({ projectId, groupId, messages: chat.messages })
  const sendAsync = chat.send.mutateAsync
  const isAdmin = project.data?.role === 'PROJECT_ADMIN'
  const archived = project.data?.status === 'ARCHIVED'

  const recipients = useMemo(
    () =>
      (members.data ?? []).filter(
        (member) => member.memberType !== 'USER' || member.id !== user?.id,
      ),
    [members.data, user?.id],
  )
  const agentNames = useMemo(
    () =>
      new Map(
        (members.data ?? [])
          .filter((member) => member.memberType === 'AGENT')
          .map((member) => [member.id, member.displayName]),
      ),
    [members.data],
  )

  const stop = useMutation({
    mutationFn: (item: ChatMessage) => chatApi.cancel(projectId, groupId, item.id),
    onSuccess: (result) =>
      void message.success(result.cancelledRuns ? '已请求停止执行' : '这条消息的执行已结束'),
    onError: (error) => void message.error(formatApiError(error)),
  })

  const runsByMessage = useMemo(() => {
    const map = new Map<string, AgentRun[]>()
    for (const run of agentRuns.runs) {
      if (run.parentRunId !== null) continue
      map.set(run.triggerMessageId, [...(map.get(run.triggerMessageId) ?? []), run])
    }
    return map
  }, [agentRuns.runs])

  const activeRun = useMemo(() => {
    const roots = agentRuns.runs.filter((run) => run.parentRunId === null)
    return (
      roots.find((run) => run.runId === selectedRunId) ??
      roots.find((run) => !isTerminalStatus(run.status)) ??
      roots.at(-1) ??
      null
    )
  }, [agentRuns.runs, selectedRunId])
  const childRuns = useMemo(
    () => (activeRun ? agentRuns.runs.filter((run) => run.parentRunId === activeRun.runId) : []),
    [activeRun, agentRuns.runs],
  )
  const triggerMessage = activeRun
    ? chat.messages.find((item) => item.id === activeRun.triggerMessageId)
    : undefined
  const trigger = activeRun
    ? `${triggerMessage?.senderName ?? '成员'}${
        triggerMessage
          ? ' ' +
            new Date(triggerMessage.createdAt).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : ''
      }`
    : undefined

  const locate = useCallback(
    async (id: string) => {
      if (!id) return
      setTargetId(null)
      try {
        const item = await chatApi.message(projectId, groupId, id)
        client.setQueryData<InfiniteData<Page<ChatMessage>, string | undefined>>(
          chatKeys.messages(projectId, groupId),
          (current) => mergeChatMessages(current, [item]),
        )
        setTargetId(id)
      } catch (error) {
        void message.error(formatApiError(error))
      }
    },
    [client, projectId, groupId, message],
  )

  const linkedMessageId = params.get('messageId')
  useEffect(() => {
    if (linkedMessageId && chat.query.isSuccess) void locate(linkedMessageId)
  }, [linkedMessageId, chat.query.isSuccess, locate])

  const handleSend = useCallback((body: SendChatMessage) => sendAsync(body), [sendAsync])
  const canStop = useCallback(
    (item: ChatMessage) => item.senderId === user?.id || isAdmin,
    [user?.id, isAdmin],
  )
  const handleStop = useCallback(
    (item: ChatMessage) => {
      if (canStop(item)) stop.mutate(item)
    },
    [canStop, stop],
  )

  if (chat.query.isPending) {
    return (
      <div className="body">
        {contextPanel}
        <main className="canvas">
          <div className="canvas-status">正在加载聊天…</div>
        </main>
      </div>
    )
  }
  if (chat.query.isError) {
    return (
      <div className="body">
        {contextPanel}
        <main className="canvas">
          <div className="canvas-status">
            <div className="block">
              <p className="h3">聊天加载失败</p>
              <p className="sub">{formatApiError(chat.query.error)}</p>
              <Button variant="quiet" onClick={() => void chat.query.refetch()}>
                重试
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="body">
      {contextPanel}
      <main className="canvas">
        <section className="view view--chat">
          <header className="chathead">
            <div className="chathead__main">
              <h1 className="h2">{group.title}</h1>
              <p className="meta">
                <span className="mono">{project.data?.name ?? projectId}</span> ·{' '}
                {members.data?.length ?? group.memberCount ?? 0} 名成员，含{' '}
                {agentNames.size} 个 Agent
              </p>
            </div>
            <div className="chathead__actions">
              <Button
                ref={membersButtonRef}
                variant="quiet"
                icon={<Icon name="people" size={16} aria-hidden />}
                aria-expanded={membersOpen}
                onClick={toggleMembers}
              >
                成员
              </Button>
              <Button
                variant="quiet"
                aria-expanded={traceOpen}
                icon={<Icon name="activity" size={16} aria-hidden />}
                onClick={toggleTrace}
              >
                执行轨迹
              </Button>
            </div>
          </header>

          {chat.syncError ? (
            <p className="chat-notice" role="status">
              消息同步暂时中断，恢复连接后会自动补齐。
            </p>
          ) : null}
          {agentRuns.connectionStatus === 'error' && agentRuns.error ? (
            <p className="chat-notice" role="status">
              {agentRuns.error}
              <Button variant="link" size="sm" onClick={agentRuns.retry}>
                重试
              </Button>
            </p>
          ) : null}
          {archived ? (
            <p className="chat-notice">项目已归档，可以查看历史消息，恢复项目后可继续聊天。</p>
          ) : null}

          <ChatMessageList
            messages={chat.messages}
            projectId={projectId}
            participants={members.data}
            runsByMessage={runsByMessage}
            agentNames={agentNames}
            loading={false}
            hasMore={Boolean(chat.query.hasNextPage)}
            loadingOlder={chat.query.isFetchingNextPage}
            targetId={targetId}
            stoppingMessageId={stop.isPending ? stop.variables?.id : undefined}
            canStop={canStop}
            onLoadOlder={chat.query.fetchNextPage}
            onReadingLatestChange={setReadingLatest}
            onReply={setReply}
            onPreview={setPreview}
            onLocate={(id) => void locate(id)}
            onOpenRun={(runId) => {
              setSelectedRunId(runId)
              setMembersOpen(false)
              setTraceOpen(true)
            }}
            onStop={handleStop}
            onMention={(member) => composerRef.current?.mention(member)}
          />

          <ChatComposer
            ref={composerRef}
            key={groupId}
            draftKey={`qgents:chat-draft:${user?.id}:${projectId}:${groupId}`}
            projectId={projectId}
            reply={reply}
            recipients={recipients}
            onSend={handleSend}
            onClearReply={() => setReply(null)}
            disabled={archived}
            disabledHint={archived ? '项目已归档，恢复后可继续发送消息。' : undefined}
          />
        </section>
      </main>

      {(traceOpen || membersOpen) && (
        <button
          type="button"
          className="scrim scrim--panel"
          aria-label="关闭侧栏"
          onClick={() => {
            if (membersOpen) closeMembers()
            setTraceOpen(false)
          }}
        />
      )}

      {traceOpen ? (
        <TracePanel
          run={activeRun}
          childrenRuns={childRuns}
          agentName={activeRun ? agentNames.get(activeRun.agentId) : undefined}
          trigger={trigger}
          connectionError={agentRuns.connectionStatus === 'error' ? agentRuns.error : null}
          onRetry={agentRuns.retry}
          onClose={() => setTraceOpen(false)}
        />
      ) : null}

      {membersOpen ? (
        <MembersPanel
          groupTitle={group.title}
          members={members.data}
          pending={members.isPending}
          error={members.isError ? members.error : null}
          onRetry={() => void members.refetch()}
          onClose={closeMembers}
          onInvite={() => setInviteOpen(true)}
          inviteDisabled={archived}
        />
      ) : null}

      {inviteOpen ? (
        <GroupMembersDialog
          projectId={projectId}
          teamId={project.data?.teamId ?? ''}
          group={group}
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
        />
      ) : null}

      {preview ? (
        <Suspense fallback={null}>
          <AttachmentPreviewLazy
            open
            projectId={projectId}
            attachmentId={messageField(preview, 'attachmentId')}
            fileName={messageField(preview, 'name') || undefined}
            onClose={() => setPreview(null)}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
