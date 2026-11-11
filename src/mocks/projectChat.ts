import { http, HttpResponse } from 'msw'
import {
  chatMessageText,
  type ChatGroup,
  type ChatMember,
  type ChatMessage,
  type SendChatMessage,
} from '@/types/chat'
import type { Project } from '@/types/project'
import type { ProjectAgent } from '@/types/agent'
import { MOCK_PROJECTS, MOCK_PROJECT_MEMBERS, MOCK_TEAM_MEMBERS, MOCK_USER } from './state'
import { activeAgents, projectAgents } from './agents'
import { nextMockId } from './ids'

const groups = new Map<string, ChatGroup>()
const groupMembers = new Map<string, ChatMember[]>()
const messages = new Map<string, ChatMessage[]>()
const sent = new Map<string, ChatMessage>()
// 触发消息 -> 还在生成回复的 Agent；停止执行按触发消息清理这些定时器。
const pending = new Map<string, Set<string>>()
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>[]>()
const projects = () => Object.values(MOCK_PROJECTS).flat()
let nextGroupId = 100
const defaultGroupIds = new Map<string, string>()
const agentReplyDelayMs = 300
const findProject = (id: unknown) => projects().find((project) => project.id === id)
const notFound = () =>
  HttpResponse.json({ error: { code: 'NOT_FOUND', message: '资源不存在' } }, { status: 404 })
const invalidAgent = (code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status: 422 })
function agentMember(agent: ProjectAgent): ChatMember {
  return { id: agent.id, displayName: agent.name, avatarUrl: agent.avatarUrl, memberType: 'AGENT' }
}
function defaultAgentMember(projectId: string) {
  const agent = projectAgents(projectId).find((item) => item.defaultAgent)
  return agent ? [agentMember(agent)] : []
}
function groupFor(project: Project) {
  let group = [...groups.values()].find(
    (item) => item.projectId === project.id && item.defaultGroup,
  )
  if (!group) {
    const id = defaultGroupIds.get(project.id) ?? String(nextGroupId++)
    defaultGroupIds.set(project.id, id)
    group = {
      defaultGroup: true,
      id,
      projectId: project.id,
      title: project.name,
      createdAt: project.createdAt ?? new Date().toISOString(),
      memberCount: (project.memberCount ?? 1) + 1,
      unreadCount: 0,
      pinned: false,
    }
    groups.set(group.id, group)
    groupMembers.set(group.id, defaultAgentMember(project.id))
    messages.set(group.id, [
      {
        id: '1',
        groupId: group.id,
        sequence: 1,
        type: 'SYSTEM',
        content: { text: '欢迎来到项目聊天。分享想法，或 @Agent 一起开展工作。' },
        senderId: '',
        senderName: 'Qgents',
        senderType: 'SYSTEM',
        createdAt: group.createdAt ?? new Date().toISOString(),
      },
    ])
  }
  return group
}
function append(
  group: ChatGroup,
  body: Omit<ChatMessage, 'id' | 'sequence' | 'createdAt' | 'groupId'>,
) {
  const history = messages.get(group.id) ?? []
  const item: ChatMessage = {
    ...body,
    id: nextMockId(),
    groupId: group.id,
    sequence: (history.at(-1)?.sequence ?? 0) + 1,
    createdAt: new Date().toISOString(),
  }
  history.push(item)
  messages.set(group.id, history)
  group.lastMessageAt = item.createdAt
  group.latestActivityAt = item.createdAt
  group.latestMessage = {
    type: item.type,
    text: chatMessageText(item),
    senderName: item.senderName,
  }
  return item
}
function userMembers(projectId: string, userIds: string[]): ChatMember[] {
  return MOCK_TEAM_MEMBERS.filter(
    (member) =>
      userIds.includes(member.userId) &&
      (MOCK_PROJECT_MEMBERS[projectId] ?? []).some((item) => item.userId === member.userId),
  ).map((member) => ({
    id: member.userId,
    displayName: member.displayName,
    email: member.email,
    avatarUrl: member.avatarUrl,
    memberType: 'USER' as const,
  }))
}
/** 邀请名单里的 Agent 必须属于本项目且已启用；未通过审批的申请不能入群。 */
function invitedAgents(projectId: string, agentIds: string[]): ChatMember[] | null {
  const available = new Map(activeAgents(projectId).map((agent) => [agent.id, agent]))
  const agents = agentIds.map((id) => available.get(id))
  return agents.every((agent): agent is ProjectAgent => Boolean(agent))
    ? agents.map(agentMember)
    : null
}
/** 默认群用户随项目同步，其他群只含邀请名单；两类群都可能已有 Agent。 */
function membersOf(group: ChatGroup): ChatMember[] {
  const stored = groupMembers.get(group.id) ?? []
  const synced = group.defaultGroup
    ? userMembers(
        group.projectId,
        (MOCK_PROJECT_MEMBERS[group.projectId] ?? []).map((member) => member.userId),
      )
    : []
  return [...new Map([...synced, ...stored].map((member) => [member.id, member])).values()]
}
const path = '/api/projects/:projectId/groups/:groupId'
export const projectChatHandlers = [
  http.get('/api/teams/:teamId/projects', ({ params }) =>
    HttpResponse.json({ data: MOCK_PROJECTS[String(params.teamId)] ?? [] }),
  ),
  http.post('/api/teams/:teamId/projects', async ({ params, request }) => {
    const body = (await request.json()) as {
      name: string
      description?: string
      memberIds?: string[]
    }
    const project: Project = {
      id: nextMockId(),
      teamId: String(params.teamId),
      name: body.name,
      description: body.description,
      role: 'PROJECT_ADMIN',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      memberCount: (body.memberIds?.filter((id) => id !== MOCK_USER.id).length ?? 0) + 1,
    }
    ;(MOCK_PROJECTS[project.teamId] ??= []).push(project)
    MOCK_PROJECT_MEMBERS[project.id] = MOCK_TEAM_MEMBERS.filter(
      (member) => member.userId === MOCK_USER.id || body.memberIds?.includes(member.userId),
    ).map((member) => ({
      ...member,
      role: member.userId === MOCK_USER.id ? 'PROJECT_ADMIN' : 'PROJECT_MEMBER',
    }))
    groupFor(project)
    return HttpResponse.json({ data: project }, { status: 201 })
  }),
  http.get('/api/projects/:projectId', ({ params }) => {
    const project = findProject(params.projectId)
    return project ? HttpResponse.json({ data: project }) : notFound()
  }),
  http.patch('/api/projects/:projectId', async ({ params, request }) => {
    const project = findProject(params.projectId)
    if (!project) return notFound()
    const body = (await request.json()) as {
      name?: string
      description?: string
      avatarUrl?: string
    }
    Object.assign(project, body)
    return HttpResponse.json({ data: project })
  }),
  ...(['archive', 'restore'] as const).map((action) =>
    http.post(`/api/projects/:projectId/${action}`, ({ params }) => {
      const project = findProject(params.projectId)
      if (!project) return notFound()
      project.status = action === 'archive' ? 'ARCHIVED' : 'ACTIVE'
      return HttpResponse.json({ data: null })
    }),
  ),
  http.get('/api/projects/:projectId/members', ({ params }) =>
    HttpResponse.json({
      data: MOCK_PROJECT_MEMBERS[String(params.projectId)] ?? [],
      page: { hasMore: false, nextCursor: null },
    }),
  ),
  http.post('/api/projects/:projectId/members', async ({ params, request }) => {
    const { userId } = (await request.json()) as { userId: string }
    const member = MOCK_TEAM_MEMBERS.find((item) => item.userId === userId)
    if (!member) return notFound()
    const list = (MOCK_PROJECT_MEMBERS[String(params.projectId)] ??= [])
    if (!list.some((item) => item.userId === userId))
      list.push({ ...member, role: 'PROJECT_MEMBER' })
    return HttpResponse.json({ data: null })
  }),
  http.patch('/api/projects/:projectId/members/:userId', async ({ params, request }) => {
    const member = MOCK_PROJECT_MEMBERS[String(params.projectId)]?.find(
      (item) => item.userId === params.userId,
    )
    if (!member) return notFound()
    const { role } = (await request.json()) as { role: 'PROJECT_ADMIN' | 'PROJECT_MEMBER' }
    member.role = role
    return HttpResponse.json({ data: null })
  }),
  http.delete('/api/projects/:projectId/members/:userId', ({ params }) => {
    MOCK_PROJECT_MEMBERS[String(params.projectId)] = (
      MOCK_PROJECT_MEMBERS[String(params.projectId)] ?? []
    ).filter((item) => item.userId !== params.userId)
    return HttpResponse.json({ data: null })
  }),
  http.get('/api/projects/:projectId/groups', ({ params }) => {
    const project = findProject(params.projectId)
    return project
      ? HttpResponse.json({
          data:
            (groupFor(project),
            [...groups.values()].filter((group) => group.projectId === project.id)),
        })
      : notFound()
  }),
  http.post('/api/projects/:projectId/groups', async ({ params, request }) => {
    const project = findProject(params.projectId)
    if (!project) return notFound()
    const body = (await request.json()) as { title: string; userIds: string[]; agentIds: string[] }
    const agents = invitedAgents(project.id, body.agentIds)
    if (!agents) return invalidAgent('INVALID_GROUP_AGENT', '只能邀请本项目已启用的 Agent')
    const group: ChatGroup = {
      id: nextMockId(),
      projectId: project.id,
      title: body.title.trim(),
      defaultGroup: false,
      createdBy: MOCK_USER.id,
      createdAt: new Date().toISOString(),
      unreadCount: 0,
    }
    groups.set(group.id, group)
    messages.set(group.id, [])
    groupMembers.set(group.id, [
      ...userMembers(project.id, [MOCK_USER.id, ...body.userIds]),
      ...agents,
    ])
    group.memberCount = groupMembers.get(group.id)?.length
    return HttpResponse.json({ data: group }, { status: 201 })
  }),
  http.get(`${path}/members`, ({ params }) => {
    const group = groups.get(String(params.groupId))
    if (!group) return notFound()
    return HttpResponse.json({ data: membersOf(group) })
  }),
  http.post(`${path}/members`, async ({ params, request }) => {
    const group = groups.get(String(params.groupId))
    if (!group) return notFound()
    const body = (await request.json()) as { userIds: string[]; agentIds: string[] }
    const agents = invitedAgents(group.projectId, body.agentIds)
    if (!agents) return invalidAgent('INVALID_GROUP_AGENT', '只能邀请本项目已启用的 Agent')
    const members = new Map(
      [...membersOf(group), ...userMembers(group.projectId, body.userIds), ...agents].map(
        (member) => [member.id, member],
      ),
    )
    groupMembers.set(group.id, [...members.values()])
    group.memberCount = members.size
    return HttpResponse.json({ data: [...members.values()] })
  }),
  http.get(`${path}/messages/incremental`, ({ params, request }) => {
    const after = Number(new URL(request.url).searchParams.get('afterSequence') ?? 0)
    const all = (messages.get(String(params.groupId)) ?? []).filter(
      (item) => (item.sequence ?? 0) > after,
    )
    return HttpResponse.json({
      data: all.slice(0, 100),
      page: { hasMore: all.length > 100, nextCursor: null },
    })
  }),
  http.get(`${path}/messages/:messageId`, ({ params }) => {
    const item = messages.get(String(params.groupId))?.find((item) => item.id === params.messageId)
    return item ? HttpResponse.json({ data: item }) : notFound()
  }),
  http.get(`${path}/messages`, ({ params, request }) => {
    const cursor = new URL(request.url).searchParams.get('cursor')
    const all = [...(messages.get(String(params.groupId)) ?? [])]
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
  http.post(`${path}/messages`, async ({ params, request }) => {
    const body = (await request.json()) as SendChatMessage
    const key = `${params.groupId}:${body.clientMessageId}`
    const existing = sent.get(key)
    if (existing) return HttpResponse.json({ data: existing })
    const project = findProject(params.projectId)
    if (!project) return notFound()
    const group = groups.get(String(params.groupId))
    if (!group || group.projectId !== project.id) return notFound()
    const members = membersOf(group)
    const mentioned = [
      ...new Set(
        (body.mentions ?? [])
          .filter((mention) => mention.type === 'AGENT')
          .map((mention) => mention.id),
      ),
    ]
    const agents = mentioned.map((id) =>
      members.find((member) => member.memberType === 'AGENT' && member.id === id),
    )
    if (agents.some((agent) => !agent))
      return invalidAgent('AGENT_NOT_IN_GROUP', 'Agent 未加入当前群聊')
    const item = append(group, {
      type: body.type,
      content: body.content,
      replyToId: body.replyToId,
      mentions: body.mentions,
      senderId: MOCK_USER.id,
      senderName: MOCK_USER.displayName,
      senderType: 'USER',
    })
    sent.set(key, item)
    if (agents.length) {
      const runs = new Set(agents.map((agent) => agent?.id ?? ''))
      pending.set(item.id, runs)
      pendingTimers.set(
        item.id,
        agents.map((agent) =>
          setTimeout(() => {
            append(group, {
              type: 'TEXT',
              content: {
                text: '收到，我会按这个方向跟进。当前为演示环境，真实执行结果由后端返回。',
              },
              replyToId: item.id,
              senderId: agent?.id ?? '',
              senderName: agent?.displayName ?? '',
              senderType: 'AGENT',
            })
            runs.delete(agent?.id ?? '')
            if (!runs.size) {
              pending.delete(item.id)
              pendingTimers.delete(item.id)
            }
          }, agentReplyDelayMs),
        ),
      )
    }
    return HttpResponse.json({ data: item }, { status: 201 })
  }),
  http.post(`${path}/messages/:messageId/cancel-agent`, ({ params }) => {
    const id = String(params.messageId)
    const runs = pending.get(id)
    pendingTimers.get(id)?.forEach(clearTimeout)
    pendingTimers.delete(id)
    pending.delete(id)
    return HttpResponse.json({ data: { cancelledRuns: runs?.size ?? 0 } })
  }),
  http.post(`${path}/read`, ({ params }) => {
    const group = groups.get(String(params.groupId))
    if (group) group.unreadCount = 0
    return HttpResponse.json({
      data: { lastReadSequenceNo: messages.get(String(params.groupId))?.at(-1)?.sequence ?? 0 },
    })
  }),
  http.put(`${path}/pin`, async ({ params, request }) => {
    const group = groups.get(String(params.groupId))
    if (!group) return notFound()
    const { pinned } = (await request.json()) as { pinned: boolean }
    group.pinned = pinned
    return HttpResponse.json({ data: group })
  }),
]
