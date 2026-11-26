import { memo } from 'react'
import { attachmentApi } from '@/api/attachment'
import { AuthedImage } from '@/components/AuthedImage'
import { chatMessageText, messageField, type ChatMember, type ChatMessage } from '@/types/chat'
import type { AgentRun } from '@/features/agent-runs/types'
import { Avatar, Button, Icon, Tag } from '@/components/ui'
import { ChatCodeBlock } from './ChatMarkdown'
import { LazyChatMarkdown } from './LazyChatMarkdown'
import { RunCard } from './RunCard'
import { streamingText, type RunGroup } from './agentRunRows'

interface Props {
  item: ChatMessage
  projectId?: string
  sender?: ChatMember
  reply?: ChatMessage
  runs?: AgentRun[]
  agentNames?: Map<string, string>
  /** 停止按钮只作用于触发消息；最终消息行靠它找到本轮运行。 */
  trigger?: ChatMessage
  onReply: (item: ChatMessage) => void
  onPreview: (item: ChatMessage) => void
  onLocate: (id: string) => void
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

/**
 * 运行卡列表：根运行带停止按钮，子运行跟着根一起被叫停。
 * 运行卡上面是状态与工具时间线，正文由调用方在卡片下方单独渲染。
 */
function RunStack({
  runs,
  agentNames,
  trigger,
  canStop,
  stopping,
  replied,
  onStop,
}: {
  runs: AgentRun[]
  agentNames?: Map<string, string>
  trigger?: ChatMessage
  canStop?: boolean
  stopping?: boolean
  replied?: boolean
  onStop: (item: ChatMessage) => void
}) {
  return (
    <>
      {runs.map((run) => (
        <RunCard
          key={run.runId}
          run={run}
          agentName={agentNames?.get(run.agentId)}
          // 子 Agent 跟着根运行一起被叫停，不再多给一个重复的停止按钮。
          onStop={
            canStop && trigger && run.parentRunId === null ? () => onStop(trigger) : undefined
          }
          stopping={stopping}
          replied={replied}
        />
      ))}
    </>
  )
}

export const ChatMessageRow = memo(function ChatMessageRow({
  item,
  projectId,
  sender,
  reply,
  runs = [],
  agentNames,
  trigger,
  onReply,
  onPreview,
  onLocate,
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
      className={`msg${agent ? ' msg--agent' : ''}${located ? ' msg--located' : ''}`}
      aria-label={`${name}的消息`}
      id={`message-${item.id}`}
    >
      <Avatar name={name} src={sender?.avatarUrl} type={agent ? 'agent' : 'user'} size="md" />
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
          <button
            type="button"
            className="msg__quote"
            onClick={() => onLocate(item.replyToId ?? '')}
          >
            <strong>{reply?.senderName || '回复消息'}</strong>
            <span>{reply ? chatMessageText(reply).slice(0, 160) : '点击查看原消息'}</span>
          </button>
        ) : null}
        {/* 工具调用只属于 Agent 消息行：用户触发消息那一行永远不挂运行卡。 */}
        {agent && runs.length ? (
          <RunStack
            runs={runs}
            agentNames={agentNames}
            trigger={trigger}
            canStop={canStop}
            stopping={stopping}
            replied
            onStop={onStop}
          />
        ) : null}
        <div className="msg__content-row">
          <MessageBody item={item} projectId={projectId} agent={agent} onPreview={onPreview} />
        </div>
        <div className="msg__actions">
          <Button
            variant="link"
            size="sm"
            onClick={() => onReply(item)}
            icon={<Icon name="chat" size={15} />}
          >
            回复
          </Button>
        </div>
      </div>
    </article>
  )
})

/**
 * 进行中的 Agent 行：最终消息还没入库时，工具调用与流式正文就落在这里。
 * 结构和最终 Agent 消息一致（运行卡在上、正文在下），交接时正文原地变成最终文本。
 */
export function AgentRunRow({
  group,
  agentName,
  agentNames,
  trigger,
  canStop,
  stopping,
  onStop,
}: {
  group: RunGroup
  agentName?: string
  agentNames?: Map<string, string>
  trigger?: ChatMessage
  canStop?: boolean
  stopping?: boolean
  onStop: (item: ChatMessage) => void
}) {
  const root = group.runs[0]
  const name = agentName || 'Agent'
  const text = streamingText(group)
  // 行标题已经知道是谁：卡片上也补上，不需要每张卡都从成员表里查。
  const names = new Map(agentNames ?? [])
  if (root) names.set(root.agentId, names.get(root.agentId) ?? name)
  const timestamp = root?.createdAt ? new Date(root.createdAt) : null
  const validTime = timestamp !== null && !Number.isNaN(timestamp.getTime())
  return (
    <article className="msg msg--agent" aria-label={`${name}正在回复`}>
      <Avatar name={name} type="agent" size="md" />
      <div className="msg__body">
        <p className="msg__head">
          <span className="msg__name">{name}</span>
          <Tag tone="agent">Agent</Tag>
          {validTime ? (
            <time className="msg__time" dateTime={root.createdAt ?? undefined}>
              {timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </time>
          ) : null}
        </p>
        <RunStack
          runs={group.runs}
          agentNames={names}
          trigger={trigger}
          canStop={canStop}
          stopping={stopping}
          onStop={onStop}
        />
        {text ? (
          <div className="msg__content-row">
            <LazyChatMarkdown text={text} />
          </div>
        ) : null}
      </div>
    </article>
  )
}
