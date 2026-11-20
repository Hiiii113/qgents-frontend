import { request, requestPage } from './client'
import type { ChatMessage, SendChatMessage } from '@/types/chat'
import type { DirectConversation, StartDirectMessage } from '@/types/directMessage'

const conversationsPath = (projectId: string) =>
  `/projects/${encodeURIComponent(projectId)}/direct-messages`
const conversationPath = (projectId: string, conversationId: string) =>
  `${conversationsPath(projectId)}/${encodeURIComponent(conversationId)}`

/**
 * 私聊消息沿用群聊 MessageResponse，groupId 里放的是会话 id。
 * 消息组件只认 ChatMessage，这里把它当成会话归属用。
 */
function toChatMessage(conversationId: string, raw: ChatMessage): ChatMessage {
  return { ...raw, groupId: raw.groupId || conversationId }
}

function toPage(
  conversationId: string,
  page: { data: ChatMessage[]; page: { hasMore: boolean; nextCursor: string | null } },
) {
  return { ...page, data: page.data.map((item) => toChatMessage(conversationId, item)) }
}

export const directMessageApi = {
  /** 只看自己参与的会话；管理员没有额外入口。 */
  conversations: (projectId: string) =>
    request<DirectConversation[]>(conversationsPath(projectId)),

  /** 发起或取回与某人的会话，重复调用不会新建。 */
  open: (projectId: string, body: StartDirectMessage) =>
    request<DirectConversation>(conversationsPath(projectId), { method: 'POST', body }),

  async messages(
    projectId: string,
    conversationId: string,
    cursor?: string,
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({ limit: '30' })
    if (cursor) params.set('cursor', cursor)
    const page = await requestPage<ChatMessage>(
      `${conversationPath(projectId, conversationId)}/messages?${params}`,
      { signal },
    )
    return toPage(conversationId, page)
  },

  async incremental(
    projectId: string,
    conversationId: string,
    afterSequence: number,
    signal?: AbortSignal,
  ) {
    const page = await requestPage<ChatMessage>(
      `${conversationPath(projectId, conversationId)}/messages/incremental?afterSequence=${afterSequence}&limit=100`,
      { signal },
    )
    return toPage(conversationId, page)
  },

  async message(projectId: string, conversationId: string, messageId: string) {
    const raw = await request<ChatMessage>(
      `${conversationPath(projectId, conversationId)}/messages/${encodeURIComponent(messageId)}`,
    )
    return toChatMessage(conversationId, raw)
  },

  async send(projectId: string, conversationId: string, body: SendChatMessage) {
    // 私聊不支持 @；空数组与不传等价，这里显式去掉以免后端判成非法提及。
    const { mentions: _mentions, ...rest } = body
    const message = await request<ChatMessage>(
      `${conversationPath(projectId, conversationId)}/messages`,
      { method: 'POST', body: rest },
    )
    return toChatMessage(conversationId, message)
  },

  read: (projectId: string, conversationId: string) =>
    request<{ conversationId: string; lastReadSequenceNo: number; unreadCount: number }>(
      `${conversationPath(projectId, conversationId)}/read`,
      { method: 'POST' },
    ),
}
