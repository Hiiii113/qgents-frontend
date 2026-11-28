import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { App } from 'antd'
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { chatApi } from '@/api/chat'
import { directMessageApi } from '@/api/directMessage'
import { useAuth } from '@/context/AuthContext'
import { useAgentRuns } from '@/features/agent-runs'
import type { Page } from '@/types/api'
import { messageField, type ChatMember, type ChatMessage, type SendChatMessage } from '@/types/chat'
import type { DirectConversation } from '@/types/directMessage'
import { formatApiError } from '@/utils/formatApiError'
import { Button, Icon, Tag } from '@/components/ui'
import { ChatComposer } from './ChatComposer'
import { ChatMessageList } from './ChatMessageList'
import { chatKeys, mergeChatMessages, useDirectMessages } from './useChatMessages'
import './chat.css'

const AttachmentPreviewLazy = lazy(async () => ({
  default: (await import('./AttachmentPreview')).AttachmentPreview,
}))

/**
 * 一对一私聊画布：和群聊共用消息列表、输入器、运行卡与停止执行，去掉成员、邀请与置顶。
 * 运行卡和流式回复都渲染在 Agent 消息行里，私聊没有触发消息以外的列可以挂。
 * 会话按 id 单独缓存，切换会话或切换项目时不会把上一个会话的消息带过来。
 */
export function DirectMessagePanel({
  projectId,
  projectName: _projectName,
  conversation,
  archived,
  contextPanel,
}: {
  projectId: string
  projectName: string
  conversation: DirectConversation
  archived: boolean
  contextPanel: React.ReactNode
}) {
  const { message } = App.useApp()
  const { user } = useAuth()
  const client = useQueryClient()
  const [reply, setReply] = useState<ChatMessage | null>(null)
  const [preview, setPreview] = useState<ChatMessage | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [readingLatest, setReadingLatest] = useState(true)
  const chat = useDirectMessages(projectId, conversation.id, readingLatest)
  const agentRuns = useAgentRuns({ projectId, groupId: conversation.id, messages: chat.messages })
  const peer = conversation.peer

  const participants = useMemo<ChatMember[]>(
    () => [
      {
        id: peer.id,
        displayName: peer.displayName,
        avatarUrl: peer.avatarUrl,
        memberType: peer.type,
      },
    ],
    [peer],
  )
  const locate = useCallback(
    async (id: string) => {
      if (!id) return
      setTargetId(null)
      try {
        const item = await directMessageApi.message(projectId, conversation.id, id)
        client.setQueryData<InfiniteData<Page<ChatMessage>, string | undefined>>(
          chatKeys.conversationMessages(projectId, conversation.id),
          (current) => mergeChatMessages(current, [item]),
        )
        setTargetId(id)
      } catch (error) {
        void message.error(formatApiError(error))
      }
    },
    [client, projectId, conversation.id, message],
  )

  // 停止执行复用群聊的取消接口：私聊把会话 id 当 groupId 传，按会话参与者鉴权。
  const stop = useMutation({
    mutationFn: (item: ChatMessage) => chatApi.cancel(projectId, conversation.id, item.id),
    onSuccess: (result) =>
      void message.success(result.cancelledRuns ? '已请求停止执行' : '这条消息的执行已结束'),
    onError: (error) => void message.error(formatApiError(error)),
  })
  const canStop = useCallback((item: ChatMessage) => item.senderId === user?.id, [user?.id])
  const send = useCallback((body: SendChatMessage) => chat.send.mutateAsync(body), [chat.send])

  if (chat.query.isPending) {
    return (
      <div className="body">
        {contextPanel}
        <main className="canvas">
          <div className="canvas-status">正在加载私聊…</div>
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
              <p className="h3">私聊加载失败</p>
              <p className="sub">{formatApiError(chat.query.error)}</p>
              <Button
                variant="quiet"
                onClick={() => void chat.query.refetch()}
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

  return (
    <div className="body">
      {contextPanel}
      <main className="canvas">
        <section className="view view--chat">
          <header className="chathead">
            <div className="chathead__main">
              <div className="chathead__peer">
                <h1 className="h2 chathead__title">{peer.displayName}</h1>
                {peer.type === 'AGENT' ? <Tag tone="agent">Agent</Tag> : null}
              </div>
            </div>
          </header>

          {chat.syncError ? (
            <p className="chat-notice" role="status">
              消息同步暂时中断，恢复连接后会自动补齐。
            </p>
          ) : null}
          {agentRuns.error ? (
            <p className="chat-notice" role="status">
              {agentRuns.error}
              <Button
                variant="link"
                size="sm"
                onClick={agentRuns.retry}
                icon={<Icon name="refresh" size={15} />}
              >
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
            currentUserId={user?.id}
            participants={participants}
            runs={agentRuns.runs}
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
            onStop={(item) => {
              if (canStop(item)) stop.mutate(item)
            }}
            emptyTitle="还没有消息"
            emptyDescription={
              peer.type === 'AGENT'
                ? `给 ${peer.displayName} 发消息就会开始处理，回复会出现在这里。`
                : `这里只有你和 ${peer.displayName} 能看到，说点什么开始吧。`
            }
          />

          <ChatComposer
            key={conversation.id}
            draftKey={`qgents:dm-draft:${user?.id}:${projectId}:${conversation.id}`}
            projectId={projectId}
            reply={reply}
            recipients={[]}
            allowMentions={false}
            placeholder={
              peer.type === 'AGENT'
                ? `给 ${peer.displayName} 发消息，它会直接开始处理`
                : `给 ${peer.displayName} 发消息`
            }
            onSend={send}
            onClearReply={() => setReply(null)}
            disabled={archived}
            disabledHint={archived ? '项目已归档，恢复后可继续发送消息。' : undefined}
          />
        </section>
      </main>

      {preview ? (
        <Suspense fallback={null}>
          <AttachmentPreviewLazy
            open
            projectId={projectId}
            attachmentId={messageField(preview, 'attachmentId')}
            fileName={messageField(preview, 'name') || undefined}
            isImage={preview.type === 'IMAGE'}
            onClose={() => setPreview(null)}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
