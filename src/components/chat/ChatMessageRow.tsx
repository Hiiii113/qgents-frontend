import { memo } from 'react'
import { attachmentApi } from '@/api/attachment'
import { AuthedImage } from '@/components/AuthedImage'
import { chatMessageText, messageField, type ChatMember, type ChatMessage } from '@/types/chat'
import type { AgentRun } from '@/features/agent-runs/types'
import { Avatar, Button, Icon, Tag } from '@/components/ui'
import { ChatCodeBlock } from './ChatMarkdown'
import { LazyChatMarkdown } from './LazyChatMarkdown'
import { RunCard } from './RunCard'

interface Props {
  item: ChatMessage
  projectId?: string
  sender?: ChatMember
  reply?: ChatMessage
  runs?: AgentRun[]
  agentNames?: Map<string, string>
  onReply: (item: ChatMessage) => void
  onPreview: (item: ChatMessage) => void
  onLocate: (id: string) => void
  onOpenRun: (runId: string) => void
  onStop: (item: ChatMessage) => void
  canStop?: boolean
  stopping?: boolean
  located?: boolean
}

function LinkedText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a href={part} key={index} target="_blank" rel="noreferrer noopener">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  )
}

/** 正文按类型分流：只有 Agent 的文字按 Markdown 渲染，图片用带鉴权地址。 */
function MessageBody({
  item,
  projectId,
  agent,
  onPreview,
}: {
  item: ChatMessage
  projectId?: string
  agent: boolean
  onPreview: (item: ChatMessage) => void
}) {
  const attachmentId = messageField(item, 'attachmentId')
  // 不信任消息内容里的 url：用当前项目与附件 ID 重建内容地址。
  const imageUrl =
    projectId && attachmentId ? attachmentApi.contentUrl(projectId, attachmentId) : null
  if (item.type === 'CODE')
    return (
      <ChatCodeBlock language={messageField(item, 'language')} code={messageField(item, 'code')} />
    )
  if (item.type === 'IMAGE')
    return (
      <button className="msg__image" aria-label="预览图片" onClick={() => onPreview(item)}>
        <AuthedImage src={imageUrl} alt={messageField(item, 'name') || '聊天图片'} />
      </button>
    )
  if (item.type === 'FILE')
    return (
      <div className="attaches">
        <button
          type="button"
          className="attach"
          onClick={() => onPreview(item)}
          disabled={!attachmentId}
        >
          <Icon name="file" size={15} />
          <span className="attach__name">{messageField(item, 'name') || '附件'}</span>
          {typeof Reflect.get(item.content as object, 'size') === 'number' ? (
            <span className="attach__meta mono">
              {formatSize(Number(Reflect.get(item.content as object, 'size')))}
            </span>
          ) : null}
        </button>
      </div>
    )
  if (agent) return <LazyChatMarkdown text={chatMessageText(item)} />
  return (
    <div className="msg__text">
      <LinkedText text={chatMessageText(item)} />
    </div>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const ChatMessageRow = memo(function ChatMessageRow({
  item,
  projectId,
  sender,
  reply,
  runs = [],
  agentNames,
  onReply,
  onPreview,
  onLocate,
  onOpenRun,
  onStop,
  canStop,
  stopping,
  located,
}: Props) {
  if (item.senderType === 'SYSTEM')
    return <div className="msg msg--system">{chatMessageText(item)}</div>
  const agent = item.senderType === 'AGENT'
  const name = sender?.displayName || item.senderName || (agent ? 'Agent' : '成员')
  const timestamp = new Date(item.createdAt)
  const validTime = !Number.isNaN(timestamp.getTime())
  const time = validTime
    ? timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <article
      className={`msg${located ? ' msg--located' : ''}`}
      aria-label={`${name}的消息`}
      id={`message-${item.id}`}
    >
      <Avatar
        name={name}
        src={sender?.avatarUrl}
        type={agent ? 'agent' : 'user'}
        size="md"
      />
      <div className="msg__body">
        <p className="msg__head">
          <span className="msg__name">{name}</span>
          {agent ? <Tag tone="agent">Agent</Tag> : null}
          <time
            className="msg__time"
            dateTime={item.createdAt}
            title={validTime ? timestamp.toLocaleString('zh-CN') : ''}
          >
            {time}
          </time>
        </p>
        {item.replyToId ? (
          <button type="button" className="msg__quote" onClick={() => onLocate(item.replyToId ?? '')}>
            <strong>{reply?.senderName || '回复消息'}</strong>
            <span>{reply ? chatMessageText(reply).slice(0, 160) : '点击查看原消息'}</span>
          </button>
        ) : null}
        <MessageBody item={item} projectId={projectId} agent={agent} onPreview={onPreview} />
        {runs.map((run) => (
          <RunCard
            key={run.runId}
            run={run}
            agentName={agentNames?.get(run.agentId)}
            onOpen={() => onOpenRun(run.runId)}
            onStop={canStop ? () => onStop(item) : undefined}
            stopping={stopping}
          />
        ))}
        <div className="msg__actions">
          <Button variant="link" size="sm" onClick={() => onReply(item)}>
            回复
          </Button>
        </div>
      </div>
    </article>
  )
})
