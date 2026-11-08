import { memo } from 'react'
import { Avatar, Button, Tag, Tooltip } from 'antd'
import { FileOutlined, RobotOutlined, StopOutlined } from '@ant-design/icons'
import { AuthedImage } from '@/components/AuthedImage'
import { attachmentApi } from '@/api/attachment'
import { chatMessageText, messageField, QGENT_NAME, type ChatMember, type ChatMessage } from '@/types/chat'

interface Props {
  item: ChatMessage
  projectId?: string
  sender?: ChatMember
  reply?: ChatMessage
  currentUserId?: string
  canStop: boolean
  stopping: boolean
  onReply: (item: ChatMessage) => void
  onStop: (item: ChatMessage) => void
  onPreview: (item: ChatMessage) => void
  onLocate: (id: string) => void
}

function LinkedText({ text }: { text: string }) {
  return <>{text.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) => /^https?:\/\//.test(part)
    ? <a href={part} key={index} target="_blank" rel="noreferrer">{part}</a> : part)}</>
}

export const ChatMessageRow = memo(function ChatMessageRow({ item, projectId, sender, reply, currentUserId, canStop, stopping, onReply, onStop, onPreview, onLocate }: Props) {
  if (item.senderType === 'SYSTEM') return <div className="chat-system-message">{chatMessageText(item)}</div>
  const agent = item.senderType === 'AGENT'
  const own = item.senderId === currentUserId
  const name = agent ? QGENT_NAME : sender?.displayName || item.senderName || '成员'
  const timestamp = new Date(item.createdAt)
  const time = Number.isNaN(timestamp.getTime()) ? '' : timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const attachmentId = messageField(item, 'attachmentId')
  // 不信任消息内容里的 url：用当前项目与附件 ID 重建内容地址，避免把 Bearer 发到外部地址。
  const imageUrl = projectId && attachmentId ? attachmentApi.contentUrl(projectId, attachmentId) : null
  return <article className={`chat-message${agent ? ' chat-message--agent' : ''}${own ? ' chat-message--own' : ''}`} aria-label={`${name}的消息`}>
    <Avatar className="chat-message__avatar" src={agent ? undefined : sender?.avatarUrl} icon={agent ? <RobotOutlined /> : undefined}>{agent ? undefined : name.slice(0, 1)}</Avatar>
    <div className="chat-message__main">
      <div className="chat-message__meta"><strong>{name}</strong>{agent && <Tag bordered={false}>Qgent</Tag>}<time dateTime={item.createdAt} title={Number.isNaN(timestamp.getTime()) ? '' : timestamp.toLocaleString('zh-CN')}>{time}</time></div>
      {item.replyToId && <button className="chat-message__reply" onClick={() => onLocate(item.replyToId ?? '')}>
        <strong>{reply?.senderName || '回复消息'}</strong><span>{reply ? chatMessageText(reply).slice(0, 160) : '点击查看原消息'}</span>
      </button>}
      <div className="chat-message__body">
        {item.type === 'CODE' ? <pre><code>{messageField(item, 'code')}</code></pre>
          : item.type === 'IMAGE' ? <button className="chat-message__image" aria-label="预览图片" onClick={() => onPreview(item)}>
            <AuthedImage preview={false} loading="lazy" src={imageUrl} alt={messageField(item, 'name') || '聊天图片'} style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain' }} />
          </button>
          : item.type === 'FILE' ? <button className="chat-message__file" onClick={() => onPreview(item)} disabled={!attachmentId}>
            <FileOutlined /><span><strong>{messageField(item, 'name') || '附件'}</strong><small>点击预览或下载</small></span>
          </button>
          : <div className="chat-message__text"><LinkedText text={chatMessageText(item)} /></div>}
      </div>
      <div className="chat-message__actions">
        <Button type="text" size="small" onClick={() => onReply(item)}>回复</Button>
        {canStop && <Tooltip title="停止这条消息启动的 Qgent 工作"><Button type="text" size="small" loading={stopping} icon={<StopOutlined />} onClick={() => onStop(item)}>停止执行</Button></Tooltip>}
      </div>
    </div>
  </article>
})
