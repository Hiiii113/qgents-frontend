/** 当前后端的项目群聊协议；项目自动拥有默认群，也支持邀请成员的新群。 */
export interface ChatGroup {
  id: string
  projectId: string
  title: string
  createdAt?: string
  createdBy?: string
  lastMessageAt?: string | null
  description?: string | null
  memberCount?: number
  unreadCount?: number
  mentionedUnread?: number
  defaultGroup?: boolean
  pinned?: boolean
  latestActivityAt?: string | null
  latestMessage?: { senderName?: string | null; text?: string | null; type?: string } | null
}

export interface ChatMention { type: 'USER' | 'AGENT'; id: string }
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
  mentions?: ChatMention[] | null
  createdAt: string
}
export interface SendChatMessage {
  type: 'TEXT' | 'CODE' | 'IMAGE' | 'FILE'
  content: { text: string } | { code: string; language: string } | {
    attachmentId: string; url: string; name?: string; size?: number; mediaType?: string
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
export function chatMessageText(message: ChatMessage): string {
  if (message.type === 'CODE') return messageField(message, 'code')
  if (message.type === 'IMAGE') return '图片'
  if (message.type === 'FILE') return messageField(message, 'name') || '附件'
  return messageField(message, 'text')
}
