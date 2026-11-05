import { http, HttpResponse } from 'msw'
import { chatMessageText, QGENT_ID, QGENT_NAME, type ChatGroup, type ChatMember, type ChatMessage, type SendChatMessage } from '@/types/chat'
import type { Project } from '@/types/project'
import { MOCK_PROJECTS, MOCK_PROJECT_MEMBERS, MOCK_TEAM_MEMBERS, MOCK_USER } from './state'
import { nextMockId } from './ids'

const groups = new Map<string, ChatGroup>()
const groupMembers = new Map<string, ChatMember[]>()
const messages = new Map<string, ChatMessage[]>()
const sent = new Map<string, ChatMessage>()
const pending = new Map<string, ReturnType<typeof setTimeout>>()
const projects = () => Object.values(MOCK_PROJECTS).flat()
let nextGroupId = 100
const defaultGroupIds = new Map<string, string>()
const findProject = (id: unknown) => projects().find(project => project.id === id)
const notFound = () => HttpResponse.json({ error: { code: 'NOT_FOUND', message: '资源不存在' } }, { status: 404 })
function groupFor(project: Project) {
  let group = [...groups.values()].find(item => item.projectId === project.id && item.defaultGroup)
  if (!group) {
    const id = defaultGroupIds.get(project.id) ?? String(nextGroupId++)
    defaultGroupIds.set(project.id, id)
    group = { defaultGroup: true, id, projectId: project.id, title: project.name, createdAt: project.createdAt ?? new Date().toISOString(), memberCount: (project.memberCount ?? 1) + 1, unreadCount: 0, pinned: false }
    groups.set(group.id, group)
    groupMembers.set(group.id, [{ id: QGENT_ID, displayName: QGENT_NAME, memberType: 'AGENT' }])
    messages.set(group.id, [{ id: '1', groupId: group.id, sequence: 1, type: 'SYSTEM', content: { text: '欢迎来到项目聊天。分享想法，或 @Qgent 一起开展工作。' }, senderId: '', senderName: 'Qgents', senderType: 'SYSTEM', createdAt: group.createdAt ?? new Date().toISOString() }])
  }
  return group
}
function append(group: ChatGroup, body: Omit<ChatMessage, 'id' | 'sequence' | 'createdAt' | 'groupId'>) {
  const history = messages.get(group.id) ?? []
  const item: ChatMessage = { ...body, id: nextMockId(), groupId: group.id, sequence: (history.at(-1)?.sequence ?? 0) + 1, createdAt: new Date().toISOString() }
  history.push(item); messages.set(group.id, history)
  group.lastMessageAt = item.createdAt; group.latestActivityAt = item.createdAt
  group.latestMessage = { type: item.type, text: chatMessageText(item), senderName: item.senderName }
  return item
}
function inviteMembers(projectId: string, userIds: string[], agentIds: string[]): ChatMember[] {
  return [
    ...MOCK_TEAM_MEMBERS.filter(member => userIds.includes(member.userId) && (MOCK_PROJECT_MEMBERS[projectId] ?? []).some(item => item.userId === member.userId)).map(member => ({ id: member.userId, displayName: member.displayName, email: member.email, avatarUrl: member.avatarUrl, memberType: 'USER' as const })),
    ...(agentIds.includes(QGENT_ID) ? [{ id: QGENT_ID, displayName: QGENT_NAME, memberType: 'AGENT' as const }] : []),
  ]
}
const path = '/api/projects/:projectId/groups/:groupId'
export const projectChatHandlers = [
  http.get('/api/teams/:teamId/projects', ({ params }) => HttpResponse.json({ data: MOCK_PROJECTS[String(params.teamId)] ?? [] })),
  http.post('/api/teams/:teamId/projects', async ({ params, request }) => {
    const body = await request.json() as { name: string; description?: string; memberIds?: string[] }
    const project: Project = { id: nextMockId(), teamId: String(params.teamId), name: body.name, description: body.description, role: 'PROJECT_ADMIN', status: 'ACTIVE', createdAt: new Date().toISOString(), memberCount: (body.memberIds?.filter(id => id !== MOCK_USER.id).length ?? 0) + 1, githubEnabled: true }
    ;(MOCK_PROJECTS[project.teamId] ??= []).push(project)
    MOCK_PROJECT_MEMBERS[project.id] = MOCK_TEAM_MEMBERS.filter(member => member.userId === MOCK_USER.id || body.memberIds?.includes(member.userId)).map(member => ({ ...member, role: member.userId === MOCK_USER.id ? 'PROJECT_ADMIN' : 'PROJECT_MEMBER' }))
    groupFor(project)
    return HttpResponse.json({ data: project }, { status: 201 })
  }),
  http.get('/api/projects/:projectId', ({ params }) => { const project = findProject(params.projectId); return project ? HttpResponse.json({ data: project }) : notFound() }),
  http.patch('/api/projects/:projectId', async ({ params, request }) => {
    const project = findProject(params.projectId); if (!project) return notFound()
    const body = await request.json() as { name?: string; description?: string; avatarUrl?: string; githubEnabled?: boolean }
    Object.assign(project, body); return HttpResponse.json({ data: project })
  }),
  ...(['archive', 'restore'] as const).map(action => http.post(`/api/projects/:projectId/${action}`, ({ params }) => {
    const project = findProject(params.projectId); if (!project) return notFound()
    project.status = action === 'archive' ? 'ARCHIVED' : 'ACTIVE'; return HttpResponse.json({ data: null })
  })),
  http.get('/api/projects/:projectId/members', ({ params }) => HttpResponse.json({ data: MOCK_PROJECT_MEMBERS[String(params.projectId)] ?? [], page: { hasMore: false, nextCursor: null } })),
  http.post('/api/projects/:projectId/members', async ({ params, request }) => {
    const { userId } = await request.json() as { userId: string }
    const member = MOCK_TEAM_MEMBERS.find(item => item.userId === userId); if (!member) return notFound()
    const list = MOCK_PROJECT_MEMBERS[String(params.projectId)] ??= []
    if (!list.some(item => item.userId === userId)) list.push({ ...member, role: 'PROJECT_MEMBER' })
    return HttpResponse.json({ data: null })
  }),
  http.patch('/api/projects/:projectId/members/:userId', async ({ params, request }) => {
    const member = MOCK_PROJECT_MEMBERS[String(params.projectId)]?.find(item => item.userId === params.userId)
    if (!member) return notFound()
    const { role } = await request.json() as { role: 'PROJECT_ADMIN' | 'PROJECT_MEMBER' }; member.role = role
    return HttpResponse.json({ data: null })
  }),
  http.delete('/api/projects/:projectId/members/:userId', ({ params }) => {
    MOCK_PROJECT_MEMBERS[String(params.projectId)] = (MOCK_PROJECT_MEMBERS[String(params.projectId)] ?? []).filter(item => item.userId !== params.userId)
    return HttpResponse.json({ data: null })
  }),
  http.get('/api/projects/:projectId/groups', ({ params }) => { const project = findProject(params.projectId); return project ? HttpResponse.json({ data: (groupFor(project), [...groups.values()].filter(group => group.projectId === project.id)) }) : notFound() }),
  http.post('/api/projects/:projectId/groups', async ({ params, request }) => {
    const project = findProject(params.projectId); if (!project) return notFound()
    const body = await request.json() as { title: string; userIds: string[]; agentIds: string[] }
    const group: ChatGroup = { id: nextMockId(), projectId: project.id, title: body.title.trim(), defaultGroup: false, createdBy: MOCK_USER.id, createdAt: new Date().toISOString(), unreadCount: 0 }
    groups.set(group.id, group); messages.set(group.id, [])
    groupMembers.set(group.id, inviteMembers(project.id, [MOCK_USER.id, ...body.userIds], body.agentIds))
    group.memberCount = groupMembers.get(group.id)?.length
    return HttpResponse.json({ data: group }, { status: 201 })
  }),
  http.get(`${path}/members`, ({ params }) => {
    const group = groups.get(String(params.groupId)); if (!group) return notFound()
    const members = group.defaultGroup ? [...inviteMembers(group.projectId, (MOCK_PROJECT_MEMBERS[group.projectId] ?? []).map(member => member.userId), []), { id: QGENT_ID, displayName: QGENT_NAME, memberType: 'AGENT' as const }] : groupMembers.get(group.id) ?? []
    const all = new Map([...members, ...(groupMembers.get(group.id) ?? [])].map(member => [member.id, member]))
    return HttpResponse.json({ data: [...all.values()] })
  }),
  http.post(`${path}/members`, async ({ params, request }) => {
    const group = groups.get(String(params.groupId)); if (!group) return notFound()
    const body = await request.json() as { userIds: string[]; agentIds: string[] }
    const existing = group.defaultGroup ? inviteMembers(group.projectId, (MOCK_PROJECT_MEMBERS[group.projectId] ?? []).map(member => member.userId), []) : []
    const members = new Map([...existing, ...(groupMembers.get(group.id) ?? []), ...inviteMembers(group.projectId, body.userIds, body.agentIds)].map(member => [member.id, member]))
    groupMembers.set(group.id, [...members.values()]); group.memberCount = members.size
    return HttpResponse.json({ data: [...members.values()] })
  }),
  http.get(`${path}/messages/incremental`, ({ params, request }) => {
    const after = Number(new URL(request.url).searchParams.get('afterSequence') ?? 0)
    const all = (messages.get(String(params.groupId)) ?? []).filter(item => (item.sequence ?? 0) > after)
    return HttpResponse.json({ data: all.slice(0, 100), page: { hasMore: all.length > 100, nextCursor: null } })
  }),
  http.get(`${path}/messages/:messageId`, ({ params }) => { const item = messages.get(String(params.groupId))?.find(item => item.id === params.messageId); return item ? HttpResponse.json({ data: item }) : notFound() }),
  http.get(`${path}/messages`, ({ params, request }) => {
    const cursor = new URL(request.url).searchParams.get('cursor')
    const all = [...(messages.get(String(params.groupId)) ?? [])].reverse().filter(item => !cursor || (item.sequence ?? 0) < Number(cursor))
    const data = all.slice(0, 30)
    return HttpResponse.json({ data, page: { hasMore: all.length > 30, nextCursor: all.length > 30 ? String(data.at(-1)?.sequence) : null } })
  }),
  http.post(`${path}/messages`, async ({ params, request }) => {
    const body = await request.json() as SendChatMessage
    const key = `${params.groupId}:${body.clientMessageId}`
    const existing = sent.get(key); if (existing) return HttpResponse.json({ data: existing })
    const project = findProject(params.projectId); if (!project) return notFound()
    const group = groups.get(String(params.groupId)); if (!group || group.projectId !== project.id) return notFound()
    const agentMentions = (body.mentions ?? []) as Array<{ type: string; id: string }>
    if (agentMentions.some(mention => mention.type === 'AGENT' && mention.id !== QGENT_ID)
      || (agentMentions.some(mention => mention.type === 'AGENT') && !(groupMembers.get(group.id) ?? []).some(member => member.id === QGENT_ID))) {
      return HttpResponse.json({ error: { code: 'INVALID_QGENT_MENTION', message: '请只在已邀请 Qgent 的群聊中提及 Qgent。' } }, { status: 422 })
    }
    const item = append(group, { type: body.type, content: body.content, replyToId: body.replyToId, mentions: body.mentions, senderId: MOCK_USER.id, senderName: MOCK_USER.displayName, senderType: 'USER' })
    sent.set(key, item)
    const agent = body.mentions?.find(mention => mention.type === 'AGENT')
    if (agent) pending.set(item.id, setTimeout(() => {
      append(group, { type: 'TEXT', content: { text: '收到，我可以协助梳理方案和处理项目工作。当前为演示环境，真实执行结果由后端返回。' }, replyToId: item.id, senderId: QGENT_ID, senderName: QGENT_NAME, senderType: 'AGENT' })
      pending.delete(item.id)
    }, 2000))
    return HttpResponse.json({ data: item }, { status: 201 })
  }),
  http.post(`${path}/messages/:messageId/cancel-agent`, ({ params }) => {
    const timer = pending.get(String(params.messageId)); if (timer) clearTimeout(timer)
    pending.delete(String(params.messageId)); return HttpResponse.json({ data: { cancelledRuns: timer ? 1 : 0 } })
  }),
  http.post(`${path}/read`, ({ params }) => {
    const group = groups.get(String(params.groupId)); if (group) group.unreadCount = 0
    return HttpResponse.json({ data: { lastReadSequenceNo: messages.get(String(params.groupId))?.at(-1)?.sequence ?? 0 } })
  }),
  http.put(`${path}/pin`, async ({ params, request }) => {
    const group = groups.get(String(params.groupId)); if (!group) return notFound()
    const { pinned } = await request.json() as { pinned: boolean }; group.pinned = pinned
    return HttpResponse.json({ data: group })
  }),
]
