/**
 * 项目内一对一私聊：对端是同一项目的另一位成员或一个 Agent。
 * 记录只对会话双方可见；项目管理员不因角色获得查看权，非参与者一律按不存在处理。
 */
export type DirectPeerType = 'USER' | 'AGENT'

export interface DirectPeer {
  type: DirectPeerType
  id: string
  displayName: string
  avatarUrl?: string | null
}

export interface DirectConversation {
  id: string
  projectId: string
  peer: DirectPeer
  lastMessage?: { senderName?: string | null; text?: string | null; type?: string } | null
  lastMessageAt?: string | null
  latestActivityAt?: string | null
  createdAt?: string
  unreadCount?: number
}

/** 发起私聊：同一项目的同一对端永远返回同一个会话。 */
export interface StartDirectMessage {
  peerType: DirectPeerType
  peerId: string
}

/** 会话按最近活动排序。 */
export function directActivityAt(conversation: DirectConversation): number {
  return (
    new Date(conversation.latestActivityAt ?? conversation.lastMessageAt ?? 0).getTime() || 0
  )
}

/** 会话里只有两个人：最后一条不是对端发的，就是自己发的。 */
export function directPreviewPrefix(conversation: DirectConversation): string {
  const sender = conversation.lastMessage?.senderName
  return sender && sender !== conversation.peer.displayName ? '你：' : ''
}
