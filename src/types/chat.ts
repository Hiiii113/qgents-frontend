/** 当前后端的项目群聊协议；项目自动拥有默认群，也支持邀请成员的新群。 */
export interface ChatGroup {
  id: string
  projectId: string
  title: string
  createdAt?: string
  createdBy?: string
  lastMessageAt?: string | null
  memberCount?: number
  unreadCount?: number
  mentionedUnread?: number
  defaultGroup?: boolean
  pinned?: boolean
  latestActivityAt?: string | null
  latestMessage?: { senderName?: string | null; text?: string | null; type?: string } | null
}

// 成员和提及都按成员类型与真实 ID 表达；Agent ID 由项目内 Agent 记录提供。
export type ChatMention = { type: 'USER' | 'AGENT'; id: string }
export interface ChatMember {
  id: string
  displayName: string
  memberType: 'USER' | 'AGENT'
  avatarUrl?: string | null
  email?: string | null
}
export interface ChatMessage {
  id: string
  groupId: string
  sequence?: number
  type: 'TEXT' | 'CODE' | 'IMAGE' | 'FILE' | 'SYSTEM'
  content: unknown
  senderId?: string | null
  senderType: 'USER' | 'AGENT' | 'SYSTEM'
  senderName?: string | null
  replyToId?: string | null
  /** 客户端生成的消息标识；Agent 最终回复为 `qgent-reply:<rootRunId>`，用于替换临时流式正文。 */
  clientMessageId?: string | null
  mentions?: ChatMention[] | null
  createdAt: string
}
export interface SendChatMessage {
  type: 'TEXT' | 'CODE' | 'IMAGE' | 'FILE'
  content:
    | { text: string }
    | { code: string; language: string }
    | {
        attachmentId: string
        url: string
        name?: string
        size?: number
        mediaType?: string
      }
  mentions?: ChatMention[]
  replyToId?: string
  clientMessageId: string
}

export function messageField(message: ChatMessage, field: string): string {
  if (typeof message.content !== 'object' || message.content === null) return ''
  const value: unknown = Reflect.get(message.content, field)
  return typeof value === 'string' ? value : ''
}
/** 群列表预览只出纯文本：Agent 回复是 Markdown，原文的 ** 和表格线留在列表里会像坏数据。 */
export function chatPreview(text: string, limit = 80): string {
  return text
    .replace(/```[\s\S]*?```/g, '代码块')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '图片')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)
}
export function chatMessageText(message: ChatMessage): string {
  if (message.type === 'CODE') return messageField(message, 'code')
  if (message.type === 'IMAGE') return '图片'
  if (message.type === 'FILE') return messageField(message, 'name') || '附件'
  return messageField(message, 'text')
}
