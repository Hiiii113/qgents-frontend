import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, App, Avatar, Button, Drawer, List, Tag, Tooltip } from 'antd'
import { PushpinOutlined, RobotOutlined, TeamOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { AgentRunProgress, useAgentRuns } from '@/features/agent-runs'
import { chatApi } from '@/api/chat'
import { projectApi } from '@/api/project'
import { useAuth } from '@/context/AuthContext'
import { formatApiError } from '@/utils/formatApiError'
import type { Page } from '@/types/api'
import { messageField, type ChatMessage, type SendChatMessage } from '@/types/chat'
import { GroupMembersModal } from './GroupMembersModal'
import { ChatComposer, type ChatComposerHandle } from './ChatComposer'
import { ChatMessageList } from './ChatMessageList'
import { LazyChatMarkdown } from './LazyChatMarkdown'
import { chatKeys, mergeChatMessages, useChatMessages } from './useChatMessages'
import './ChatPanel.css'

/** 附件预览只在真的打开时加载。 */
const AttachmentPreviewModal = lazy(async () => ({
  default: (await import('./AttachmentPreviewModal')).AttachmentPreviewModal,
}))

/** 项目聊天的组合入口；输入、消息列表和数据同步分别维护。 */
export function ChatPanel({ projectId, groupId }: { projectId: string; groupId: string }) {
  const { message } = App.useApp()
  const { user } = useAuth()
  const client = useQueryClient()
  const [params] = useSearchParams()
  const [reply, setReply] = useState<ChatMessage | null>(null)
  const [preview, setPreview] = useState<ChatMessage | null>(null)
  const [membersOpen, setMembersOpen] = useState(false)
  const composerRef = useRef<ChatComposerHandle>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [readingLatest, setReadingLatest] = useState(true)
  const [targetId, setTargetId] = useState<string | null>(params.get('messageId'))
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
  const members = useQuery({
    queryKey: chatKeys.members(projectId, groupId),
    queryFn: () => chatApi.members(projectId, groupId),
    enabled: Boolean(groupId),
  })
  const group = groups.data?.find((item) => item.id === groupId)
  const pin = useMutation({
    mutationFn: () => chatApi.pin(projectId, groupId, !group?.pinned),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: chatKeys.groups(projectId), exact: true })
    },
    onError: (error) => void message.error(formatApiError(error)),
  })
  const chat = useChatMessages(projectId, groupId, readingLatest)
  const agentRuns = useAgentRuns({ projectId, groupId, messages: chat.messages })
  const sendAsync = chat.send.mutateAsync
  const isAdmin = project.data?.role === 'PROJECT_ADMIN'
  const recipients = useMemo(
    () =>
      members.data?.filter((member) => member.memberType !== 'USER' || member.id !== user?.id) ??
      [],
    [members.data, user?.id],
  )
  const stop = useMutation({
    mutationFn: (item: ChatMessage) => chatApi.cancel(projectId, groupId, item.id),
    onSuccess: (result) => {
      void message.success(result.cancelledRuns ? '已请求停止执行' : '这条消息的执行已结束')
    },
    onError: (error) => void message.error(formatApiError(error)),
  })
  const stopMessage = stop.mutate
  const handleReply = useCallback((item: ChatMessage) => setReply(item), [])
  const clearReply = useCallback(() => setReply(null), [])
  const handlePreview = useCallback(
    (item: ChatMessage) => {
      if (!messageField(item, 'attachmentId')) {
        void message.info('附件暂时无法预览')
        return
      }
      setPreview(item)
    },
    [message],
  )
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
  const onLocate = useCallback(
    (id: string) => {
      void locate(id)
    },
    [locate],
  )
  const handleSend = useCallback((body: SendChatMessage) => sendAsync(body), [sendAsync])
  const loadOlder = chat.query.fetchNextPage
  const renderMarkdown = useCallback((text: string) => <LazyChatMarkdown text={text} />, [])
  const agentNames = useMemo(
    () =>
      new Map(
        (members.data ?? [])
          .filter((member) => member.memberType === 'AGENT')
          .map((member) => [member.id, member.displayName]),
      ),
    [members.data],
  )
  // 运行进度紧跟在触发消息后面；停止只在这里出现，按真实 run 状态决定，不再靠「提及但没回复」猜测。
  const runsAfterMessage = useCallback(
    (item: ChatMessage) => {
      const roots = agentRuns.runs.filter(
        (run) => run.triggerMessageId === item.id && run.parentRunId === null,
      )
      if (!roots.length) return null
      const canCancel = item.senderId === user?.id || isAdmin
      return (
        <div className="chat-run-progress">
          {roots.map((run) => (
            <AgentRunProgress
              key={run.runId}
              run={run}
              childrenRuns={agentRuns.runs.filter((child) => child.parentRunId === run.runId)}
              agentName={agentNames.get(run.agentId)}
              renderMarkdown={renderMarkdown}
              onStop={canCancel ? () => stopMessage(item) : undefined}
              stopping={stop.isPending && stop.variables?.id === item.id}
            />
          ))}
        </div>
      )
    },
    [
      agentRuns.runs,
      agentNames,
      renderMarkdown,
      isAdmin,
      user?.id,
      stopMessage,
      stop.isPending,
      stop.variables,
    ],
  )
  const linkedMessageId = params.get('messageId')
  const ready = chat.query.isSuccess
  useEffect(() => {
    if (linkedMessageId && ready) void locate(linkedMessageId)
  }, [linkedMessageId, ready, locate])

  return (
    <section className="chat-panel">
      <header className="chat-panel__header">
        <div className="chat-panel__header-inner">
          <div className="chat-panel__identity">
            <h1>{group?.title || project.data?.name || '项目聊天'}</h1>
            {group?.defaultGroup && <p>默认群 · 全体项目成员</p>}
          </div>
          <div className="chat-panel__header-actions">
            <Tooltip title={group?.pinned ? '取消置顶' : '置顶聊天'}>
              <Button
                type="text"
                icon={<PushpinOutlined />}
                aria-label={group?.pinned ? '取消置顶' : '置顶聊天'}
                loading={pin.isPending}
                onClick={() => pin.mutate()}
              />
            </Tooltip>
            <Button
              type="text"
              icon={<TeamOutlined aria-hidden />}
              onClick={() => setMembersOpen(true)}
            >
              {group?.memberCount ?? members.data?.length ?? 0} 位成员
            </Button>
          </div>
        </div>
      </header>
      {chat.query.isError && (
        <Alert
          className="chat-panel__notice"
          showIcon
          type="error"
          message={formatApiError(chat.query.error)}
          action={<Button onClick={() => void chat.query.refetch()}>重试</Button>}
        />
      )}
      {chat.syncError && (
        <Alert
          className="chat-panel__notice"
          type="warning"
          showIcon
          message="消息同步暂时中断，恢复连接后会自动补齐"
        />
      )}
      {agentRuns.connectionStatus === 'error' && agentRuns.error && (
        <Alert
          className="chat-panel__notice"
          type="warning"
          showIcon
          message={agentRuns.error}
          action={<Button onClick={agentRuns.retry}>重试</Button>}
        />
      )}
      <ChatMessageList
        messages={chat.messages}
        projectId={projectId}
        participants={members.data}
        loading={chat.query.isPending}
        hasMore={chat.query.hasNextPage}
        loadingOlder={chat.query.isFetchingNextPage}
        currentUserId={user?.id}
        targetId={targetId}
        afterMessage={runsAfterMessage}
        onReadingLatestChange={setReadingLatest}
        onLoadOlder={loadOlder}
        onReply={handleReply}
        onPreview={handlePreview}
        onLocate={onLocate}
        onMention={(member) => composerRef.current?.mention(member)}
      />
      {project.data?.status === 'ARCHIVED' && (
        <Alert
          className="chat-panel__notice"
          type="info"
          showIcon
          message="项目已归档，可以查看历史消息，恢复项目后可继续聊天。"
        />
      )}
      <div className="chat-panel__composer">
        <ChatComposer
          ref={composerRef}
          key={groupId}
          draftKey={`qgents:chat-draft:${user?.id}:${projectId}:${groupId}`}
          projectId={projectId}
          reply={reply}
          recipients={recipients}
          onSend={handleSend}
          onClearReply={clearReply}
          disabled={!ready || project.data?.status === 'ARCHIVED'}
          disabledHint={
            project.data?.status === 'ARCHIVED'
              ? '项目已归档，恢复后可继续发送消息。'
              : !ready
                ? '正在加载聊天消息…'
                : undefined
          }
        />
      </div>
      <Drawer
        className="chat-members"
        title="群聊成员"
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        extra={
          <Button
            onClick={() => setInviteOpen(true)}
            disabled={project.data?.status === 'ARCHIVED'}
          >
            邀请成员 / Agent
          </Button>
        }
      >
        {group?.defaultGroup && <p className="chat-members__hint">默认群成员与项目成员同步。</p>}
        <List
          dataSource={members.data ?? []}
          renderItem={(member) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <Avatar
                    src={member.avatarUrl}
                    icon={member.memberType === 'AGENT' ? <RobotOutlined /> : undefined}
                  >
                    {member.memberType === 'USER' ? member.displayName.slice(0, 1) : undefined}
                  </Avatar>
                }
                title={
                  <>
                    {member.displayName} {member.memberType === 'AGENT' && <Tag>Agent</Tag>}
                  </>
                }
                description={member.memberType === 'USER' ? member.email || undefined : undefined}
              />
            </List.Item>
          )}
        />
      </Drawer>
      {inviteOpen && group && project.data && (
        <GroupMembersModal
          projectId={projectId}
          teamId={project.data.teamId}
          group={group}
          onClose={() => setInviteOpen(false)}
        />
      )}
      {preview && (
        <Suspense fallback={null}>
          <AttachmentPreviewModal
            open
            projectId={projectId}
            attachmentId={messageField(preview, 'attachmentId')}
            fileName={messageField(preview, 'name') || undefined}
            onClose={() => setPreview(null)}
          />
        </Suspense>
      )}
    </section>
  )
}
