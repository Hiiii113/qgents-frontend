import { http, HttpResponse } from 'msw'
import type { ProjectAgent } from '@/types/agent'
import { chatMessageText, type ChatMessage, type SendChatMessage } from '@/types/chat'
import type { DirectConversation, DirectPeer } from '@/types/directMessage'
import { activeAgents } from './agents'
import { nextMockId } from './ids'
import { MOCK_PROJECT_MEMBERS, MOCK_PROJECTS, MOCK_USER } from './state'

/**
 * 私聊 mock：会话按项目隔离，消息沿用群聊结构（groupId 里放会话 id）。
 * 对端是 Agent 时发完消息会自动回一条，并按实时帧的形状派发事件，走真实的增量补齐路径。
 */
const conversations = new Map<string, DirectConversation[]>()
const history = new Map<string, ChatMessage[]>()
const sent = new Map<string, ChatMessage>()
const replyTimers = new Map<string, ReturnType<typeof setTimeout>>()

const projects = () => Object.values(MOCK_PROJECTS).flat()
const findProject = (id: unknown) => projects().find((project) => project.id === id)
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const notFound = () =>
  HttpResponse.json(
    { error: { code: 'DIRECT_CONVERSATION_NOT_FOUND', message: '会话不存在' } },
    { status: 404 },
  )
const invalid = (code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status: 422 })

function userPeer(projectId: string, userId: string): DirectPeer | null {
  const member = (MOCK_PROJECT_MEMBERS[projectId] ?? []).find((item) => item.userId === userId)
  if (!member) return null
  return {
    type: 'USER',
    id: member.userId,
    displayName: member.displayName,
    avatarUrl: member.avatarUrl,
  }
}

function agentPeer(projectId: string, agentId: string): DirectPeer | null {
  const agent = activeAgents(projectId).find((item) => item.id === agentId)
  return agent
    ? { type: 'AGENT', id: agent.id, displayName: agent.name, avatarUrl: agent.avatarUrl }
    : null
}

function append(
  conversation: DirectConversation,
  input: {
    type: ChatMessage['type']
    content: unknown
    senderId: string
    senderName: string
    senderType: ChatMessage['senderType']
    replyToId?: string | null
    clientMessageId?: string | null
  },
): ChatMessage {
  const items = history.get(conversation.id) ?? []
  const item: ChatMessage = {
    ...input,
    id: nextMockId(),
    groupId: conversation.id,
    sequence: (items.at(-1)?.sequence ?? 0) + 1,
    createdAt: new Date().toISOString(),
  }
  items.push(item)
  history.set(conversation.id, items)
  conversation.lastMessage = {
    type: item.type,
    text: chatMessageText(item),
    senderName: item.senderName ?? '',
  }
  conversation.lastMessageAt = item.createdAt
  conversation.latestActivityAt = item.createdAt
  return item
}

function create(projectId: string, peer: DirectPeer): DirectConversation {
  const createdAt = new Date().toISOString()
  const conversation: DirectConversation = {
    id: nextMockId(),
    projectId,
    peer,
    lastMessage: null,
    lastMessageAt: null,
    latestActivityAt: createdAt,
    createdAt,
    unreadCount: 0,
  }
  conversationsOf(projectId).push(conversation)
  history.set(conversation.id, [])
  return conversation
}

/** 演示项目 2 预置两条私聊：一个成员、一个 Agent，其余项目从空列表开始。 */
function seed(projectId: string): DirectConversation[] {
  const created: DirectConversation[] = []
  conversations.set(projectId, created)
  if (projectId !== '2') return created

  const peerUser = userPeer(projectId, '2')
  if (peerUser) {
    const conversation = create(projectId, peerUser)
    conversation.createdAt = minutesAgo(240)
    append(conversation, {
      type: 'TEXT',
      content: { text: '聊天页的头像列我调过一次了，再看下长回复的换行。' },
      senderId: peerUser.id,
      senderName: peerUser.displayName,
      senderType: 'USER',
    })
    append(conversation, {
      type: 'TEXT',
      content: { text: '收到，我在演示群看下效果。' },
      senderId: MOCK_USER.id,
      senderName: MOCK_USER.displayName,
      senderType: 'USER',
    })
    conversation.unreadCount = 0
  }

  const agent: ProjectAgent | undefined = activeAgents(projectId).find((item) => item.defaultAgent)
  if (agent) {
    const conversation = create(projectId, {
      type: 'AGENT',
      id: agent.id,
      displayName: agent.name,
      avatarUrl: agent.avatarUrl,
    })
    conversation.createdAt = minutesAgo(90)
    append(conversation, {
      type: 'TEXT',
      content: {
        text: '这里是私聊，直接说要做什么就行。我能读你和我在同一个群里的群消息。',
      },
      senderId: agent.id,
      senderName: agent.name,
      senderType: 'AGENT',
    })
    conversation.unreadCount = 1
  }
  return created
}

function conversationsOf(projectId: string): DirectConversation[] {
  return conversations.get(projectId) ?? seed(projectId)
}

function conversationOf(projectId: string, conversationId: string) {
  return conversationsOf(projectId).find((item) => item.id === conversationId)
}

function replyLater(conversation: DirectConversation, trigger: ChatMessage) {
  const timer = setTimeout(() => {
    replyTimers.delete(conversation.id)
    append(conversation, {
      type: 'TEXT',
      content: { text: '收到，我按这个方向处理。当前是演示环境，真实执行结果由后端返回。' },
      senderId: conversation.peer.id,
      senderName: conversation.peer.displayName,
      senderType: 'AGENT',
      replyToId: trigger.id,
      clientMessageId: `qgent-reply:${trigger.id}`,
    })
    conversation.unreadCount = (conversation.unreadCount ?? 0) + 1
    if (typeof window !== 'undefined')
      window.dispatchEvent(
        new CustomEvent('qgents:message-event', {
          detail: { projectId: conversation.projectId, groupId: conversation.id },
        }),
      )
  }, 400)
  replyTimers.set(conversation.id, timer)
}

const base = '/api/projects/:projectId/direct-messages'
const one = `${base}/:conversationId`

export const directMessageHandlers = [
  http.get(base, ({ params }) => {
    const project = findProject(params.projectId)
    if (!project) return notFound()
    return HttpResponse.json({ data: conversationsOf(project.id) })
  }),
  http.post(base, async ({ params, request }) => {
    const project = findProject(params.projectId)
    if (!project) return notFound()
    const body = (await request.json()) as { peerType?: string; peerId?: string }
    const peerId = String(body.peerId ?? '')
    if (peerId === MOCK_USER.id) return invalid('DIRECT_PEER_INVALID', '不能和自己私聊')
    const peer =
      body.peerType === 'AGENT'
        ? agentPeer(project.id, peerId)
        : body.peerType === 'USER'
          ? userPeer(project.id, peerId)
          : null
    if (!peer)
      return body.peerType === 'AGENT'
        ? invalid('AGENT_NOT_ACTIVE', 'Agent 未启用或不属于本项目')
        : invalid('DIRECT_PEER_INVALID', '对端类型或成员不合法')
    const existing = conversationsOf(project.id).find(
      (item) => item.peer.type === peer.type && item.peer.id === peer.id,
    )
    return HttpResponse.json({ data: existing ?? create(project.id, peer) })
  }),
  http.get(one, ({ params }) => {
    const project = findProject(params.projectId)
    if (!project) return notFound()
    const conversation = conversationOf(project.id, String(params.conversationId))
    return conversation ? HttpResponse.json({ data: conversation }) : notFound()
  }),
  http.get(`${one}/messages/incremental`, ({ params, request }) => {
    const project = findProject(params.projectId)
    if (!project) return notFound()
    const conversation = conversationOf(project.id, String(params.conversationId))
    if (!conversation) return notFound()
    const after = Number(new URL(request.url).searchParams.get('afterSequence') ?? 0)
    const items = (history.get(conversation.id) ?? []).filter(
      (item) => (item.sequence ?? 0) > after,
    )
    return HttpResponse.json({
      data: items.slice(0, 100),
      page: { hasMore: items.length > 100, nextCursor: null },
    })
  }),
  http.get(`${one}/messages/:messageId`, ({ params }) => {
    const project = findProject(params.projectId)
    if (!project) return notFound()
    const conversation = conversationOf(project.id, String(params.conversationId))
    if (!conversation) return notFound()
    const item = (history.get(conversation.id) ?? []).find(
      (message) => message.id === params.messageId,
    )
    return item ? HttpResponse.json({ data: item }) : notFound()
  }),
  http.get(`${one}/messages`, ({ params, request }) => {
    const project = findProject(params.projectId)
    if (!project) return notFound()
    const conversation = conversationOf(project.id, String(params.conversationId))
    if (!conversation) return notFound()
    const cursor = new URL(request.url).searchParams.get('cursor')
    const all = [...(history.get(conversation.id) ?? [])]
      .reverse()
      .filter((item) => !cursor || (item.sequence ?? 0) < Number(cursor))
    const data = all.slice(0, 30)
    return HttpResponse.json({
      data,
      page: {
        hasMore: all.length > 30,
        nextCursor: all.length > 30 ? String(data.at(-1)?.sequence) : null,
      },
    })
  }),
  http.post(`${one}/messages`, async ({ params, request }) => {
    const project = findProject(params.projectId)
    if (!project) return notFound()
    const conversation = conversationOf(project.id, String(params.conversationId))
    if (!conversation) return notFound()
    const body = (await request.json()) as SendChatMessage
    if (body.mentions?.length)
      return invalid('DIRECT_MENTION_NOT_SUPPORTED', '私聊不支持提及')
    const key = `${conversation.id}:${body.clientMessageId}`
    const existing = sent.get(key)
    if (existing) return HttpResponse.json({ data: existing })
    const item = append(conversation, {
      type: body.type,
      content: body.content,
      replyToId: body.replyToId ?? null,
      clientMessageId: body.clientMessageId,
      senderId: MOCK_USER.id,
      senderName: MOCK_USER.displayName,
      senderType: 'USER',
    })
    sent.set(key, item)
    if (conversation.peer.type === 'AGENT') replyLater(conversation, item)
    return HttpResponse.json({ data: item }, { status: 201 })
  }),
  http.post(`${one}/read`, ({ params }) => {
    const project = findProject(params.projectId)
    if (!project) return notFound()
    const conversation = conversationOf(project.id, String(params.conversationId))
    if (!conversation) return notFound()
    conversation.unreadCount = 0
    return HttpResponse.json({
      data: {
        conversationId: conversation.id,
        lastReadSequenceNo: history.get(conversation.id)?.at(-1)?.sequence ?? 0,
        unreadCount: 0,
      },
    })
  }),
]
