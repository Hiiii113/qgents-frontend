import { memo, useState } from 'react'
import { Avatar, Button, Dropdown, Tag } from 'antd'
import { EnterOutlined, FileOutlined, RobotOutlined } from '@ant-design/icons'
import { AuthedImage } from '@/components/AuthedImage'
import { attachmentApi } from '@/api/attachment'
import { chatMessageText, messageField, type ChatMember, type ChatMessage } from '@/types/chat'
import { ChatCodeBlock } from './ChatMarkdown'
import { LazyChatMarkdown } from './LazyChatMarkdown'

interface Props {
  item: ChatMessage
  projectId?: string
  sender?: ChatMember
  reply?: ChatMessage
  currentUserId?: string
  onReply: (item: ChatMessage) => void
  onPreview: (item: ChatMessage) => void
  onLocate: (id: string) => void
  /** 选中头像菜单里的「@名字」后，把该成员 @ 进输入框；右键本身不修改草稿。 */
  onMention?: (member: ChatMember) => void
  /** 同一发送者连续发言时，只有组首渲染作者行与头像。 */
  groupStart?: boolean
  groupEnd?: boolean
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

/**
 * 头像即「@ ta」入口：右键或点击打开同一个动作菜单，选中才把成员 @ 进输入框。
 * 只有当前群成员（participants 里解析出的 sender）且不是自己时才给菜单：
 * 历史发送者、已不在群里的成员和自己都无法真正发出提及，只显示静态头像。
 */
function MentionAvatar({
  name,
  agent,
  avatarUrl,
  member,
  onMention,
}: {
  name: string
  agent: boolean
  avatarUrl?: string | null
  member: ChatMember | null
  onMention?: (member: ChatMember) => void
}) {
  const [open, setOpen] = useState(false)
  const avatar = (
    <Avatar
      className="chat-message__avatar"
      size={32}
      src={avatarUrl}
      icon={agent ? <RobotOutlined /> : undefined}
    >
      {agent ? undefined : name.slice(0, 1)}
    </Avatar>
  )
  if (!member || !onMention)
    return (
      <span className="chat-message__avatar-static" aria-hidden="true">
        {avatar}
      </span>
    )
  return (
    <Dropdown
      trigger={['contextMenu']}
      autoFocus
      rootClassName="chat-mention-menu"
      placement="bottomLeft"
      open={open}
      onOpenChange={setOpen}
      menu={{
        items: [{ key: 'mention', label: `@${name}` }],
        onClick: () => {
          setOpen(false)
          onMention(member)
        },
      }}
    >
      <button
        type="button"
        className="chat-message__avatar-hit"
        aria-label={`提及 ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`点击或右键 @${name}`}
        // 打开交给菜单；关闭由 antd 的点击外部 / Escape / 选中菜单项处理。
        onClick={() => setOpen(true)}
      >
        {avatar}
      </button>
    </Dropdown>
  )
}

/** 正文按消息类型分流：只有 Agent 的文字消息按 Markdown 渲染。 */
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
  // 不信任消息内容里的 url：用当前项目与附件 ID 重建内容地址，避免把 Bearer 发到外部地址。
  const imageUrl =
    projectId && attachmentId ? attachmentApi.contentUrl(projectId, attachmentId) : null
  if (item.type === 'CODE')
    return (
      <ChatCodeBlock language={messageField(item, 'language')} code={messageField(item, 'code')} />
    )
  if (item.type === 'IMAGE')
    return (
      <button className="chat-message__image" aria-label="预览图片" onClick={() => onPreview(item)}>
        <AuthedImage
          preview={false}
          loading="lazy"
          src={imageUrl}
          alt={messageField(item, 'name') || '聊天图片'}
        />
      </button>
    )
  if (item.type === 'FILE')
    return (
      <button
        className="chat-message__file"
        onClick={() => onPreview(item)}
        disabled={!attachmentId}
      >
        <FileOutlined aria-hidden="true" />
        <span>
          <strong>{messageField(item, 'name') || '附件'}</strong>
          <small>点击预览或下载</small>
        </span>
      </button>
    )
  if (agent) return <LazyChatMarkdown text={chatMessageText(item)} />
  return (
    <div className="chat-message__text">
      <LinkedText text={chatMessageText(item)} />
    </div>
  )
}

export const ChatMessageRow = memo(function ChatMessageRow({
  item,
  projectId,
  sender,
  reply,
  currentUserId,
  onReply,
  onPreview,
  onLocate,
  onMention,
  groupStart = true,
  groupEnd = true,
}: Props) {
  if (item.senderType === 'SYSTEM')
    return <div className="chat-system-message">{chatMessageText(item)}</div>
  const agent = item.senderType === 'AGENT'
  // 人和 Agent 的 id 各自从 1 开始，会撞号；只比 id 会把 Agent 当成自己在说话。
  const own = item.senderType === 'USER' && item.senderId === currentUserId
  const name = sender?.displayName || item.senderName || (agent ? 'Agent' : '成员')
  const timestamp = new Date(item.createdAt)
  const validTime = !Number.isNaN(timestamp.getTime())
  const time = validTime
    ? timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : ''
  const mentionTarget: ChatMember | null = !own && sender ? sender : null
  return (
    <article
      className={`chat-message${agent ? ' chat-message--agent' : ''}${
        own ? ' chat-message--own' : ''
      }${groupStart ? ' chat-message--group-start' : ''}${
        groupEnd ? ' chat-message--group-end' : ''
      }`}
      aria-label={`${name}的消息`}
    >
      {/* 自己不发自己的消息头像，网格退化成单列；他人的头像只在组首，组内其余用占位格保持列宽。 */}
      {!own &&
        (groupStart ? (
          <MentionAvatar
            name={name}
            agent={agent}
            avatarUrl={sender?.avatarUrl}
            member={mentionTarget}
            onMention={onMention}
          />
        ) : (
          <span className="chat-message__avatar-placeholder" aria-hidden="true" />
        ))}
      <div className="chat-message__main">
        {groupStart && (
          <div className="chat-message__head">
            <strong className="chat-message__author">{name}</strong>
            {agent && <Tag className="chat-message__tag">Agent</Tag>}
            <time
              dateTime={item.createdAt}
              title={validTime ? timestamp.toLocaleString('zh-CN') : ''}
            >
              {time}
            </time>
          </div>
        )}
        <div className="chat-message__bubble">
          {item.replyToId && (
            <button className="chat-message__quote" onClick={() => onLocate(item.replyToId ?? '')}>
              <strong>{reply?.senderName || '回复消息'}</strong>
              <span>{reply ? chatMessageText(reply).slice(0, 160) : '点击查看原消息'}</span>
            </button>
          )}
          <div className="chat-message__body">
            <MessageBody item={item} projectId={projectId} agent={agent} onPreview={onPreview} />
          </div>
          <div className="chat-message__actions">
            <Button
              type="text"
              size="small"
              aria-label="回复这条消息"
              onClick={() => onReply(item)}
            >
              <EnterOutlined className="chat-message__reply-icon" aria-hidden="true" />
              <span className="chat-message__reply-label">回复</span>
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
})
