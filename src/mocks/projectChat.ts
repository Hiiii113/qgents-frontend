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

/** 附件演示内容：图片与文本各一份，供聊天里的图片/附件消息真实预览。 */
const SHOWCASE_ATTACHMENTS: Record<string, { fileName: string; mediaType: string; body: string }> =
  {
    'seed-chat-shot': {
      fileName: '聊天排版对比.png',
      mediaType: 'image/svg+xml',
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="#FAFAF7"/>
  <rect x="24" y="24" width="32" height="32" rx="2" fill="#111312"/>
  <rect x="72" y="26" width="120" height="12" fill="#C9CBC2"/>
  <rect x="72" y="48" width="420" height="10" fill="#E3E4DE"/>
  <rect x="72" y="64" width="360" height="10" fill="#E3E4DE"/>
  <rect x="72" y="96" width="32" height="32" rx="2" fill="#EDF1E9"/>
  <rect x="120" y="98" width="96" height="12" fill="#C9CBC2"/>
  <rect x="120" y="120" width="440" height="10" fill="#E3E4DE"/>
  <rect x="120" y="136" width="300" height="10" fill="#E3E4DE"/>
</svg>`,
    },
    'seed-chat-checklist': {
      fileName: '聊天体验走查清单.md',
      mediaType: 'text/markdown; charset=utf-8',
      body: '# 聊天体验走查清单\n\n- 头像永远在正文左上角，长回复不居中\n- Agent 正文 Markdown：标题 / 列表 / 代码 / 表格\n- 右键头像只弹菜单，选中才 @\n- 停止执行只在 Agent 尚未回复时出现\n',
    },
  }

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

/**
 * 演示群：固定构造 Agent 长 Markdown、代码块、GFM 表格、图片、附件与
 * 「Agent 尚未回复」的待执行状态。只创建独立群，不碰默认群的真实消息。
 */
function seedChatShowcase() {
  const project = findProject('2')
  if (!project) return
  const [qgent] = projectAgents(project.id)
  const helper: ProjectAgent = {
    id: nextMockId(),
    name: '前端助手',
    description: '负责聊天与界面实现的 Agent',
    defaultAgent: false,
    status: 'ACTIVE',
  }
  projectAgents(project.id).push(helper)

  const group: ChatGroup = {
    id: nextMockId(),
    projectId: project.id,
    title: 'Qgent 长回复演示',
    defaultGroup: false,
    createdBy: MOCK_USER.id,
    createdAt: minutesAgo(180),
    unreadCount: 0,
    pinned: false,
  }
  groups.set(group.id, group)
  const humans = userMembers(project.id, ['1', '2', '3'])
  groupMembers.set(group.id, [...humans, agentMember(qgent), agentMember(helper)])
  group.memberCount = groupMembers.get(group.id)?.length

  const history: ChatMessage[] = []
  const push = (
    minutes: number,
    body: Omit<ChatMessage, 'id' | 'sequence' | 'createdAt' | 'groupId'>,
  ) => {
    const item: ChatMessage = {
      ...body,
      id: `seed-${group.id}-${history.length + 1}`,
      groupId: group.id,
      sequence: history.length + 1,
      createdAt: minutesAgo(minutes),
    }
    history.push(item)
    return item
  }
  push(178, {
    type: 'SYSTEM',
    content: { text: '演示群：包含 Agent 长回复、代码块、表格、附件与待执行状态。' },
    senderId: '',
    senderName: 'Qgents',
    senderType: 'SYSTEM',
  })
  push(172, {
    type: 'TEXT',
    content: { text: '长回复在窄屏上很难读，先把消息行和输入区整体过一遍。' },
    senderId: '1',
    senderName: '陈同学',
    senderType: 'USER',
  })
  push(171, {
    type: 'TEXT',
    content: { text: '注意保留虚拟列表和历史分页，别把阅读位置弄丢了。' },
    senderId: '1',
    senderName: '陈同学',
    senderType: 'USER',
  })
  const planTrigger = push(168, {
    type: 'TEXT',
    content: { text: '@Qgent 先给一版排版方案，重点讲清楚正文层级。' },
    senderId: '2',
    senderName: '张工',
    senderType: 'USER',
    mentions: [{ type: 'AGENT', id: qgent.id }],
  })
  push(166, {
    type: 'TEXT',
    content: {
      text: [
        '## 消息行排版结论',
        '',
        '先给结论：**头像列 + 作者行 + 正文**三层固定，正文再长也不会把人挤到中间。',
        '',
        '- 头像固定在正文左上角，32px，不随消息高度居中',
        '- 作者、Agent 标签、时间占一行，回复/停止靠右，悬停才出现',
        '- 正文长段落限 62ch，代码块和表格自己横向滚动',
        '',
        '> 人类消息保持纯文本，只有 Agent 回复走 Markdown。',
        '',
        '实现细节见 `src/components/chat/ChatMessageRow.tsx`，样式变量统一取 `tokens.ts`。',
        '',
        '还需要你确认三点：',
        '',
        '1. 连续消息是否每次都重复头像',
        '2. 表格在 375px 下允许横向滚动',
        '3. 停止执行只在 Agent 尚未回复时出现',
        '',
        '可参考 [W3C 焦点管理指南](https://www.w3.org/WAI/tutorials/) 的做法。',
      ].join('\n'),
    },
    replyToId: planTrigger.id,
    senderId: qgent.id,
    senderName: qgent.name,
    senderType: 'AGENT',
  })
  push(164, {
    type: 'TEXT',
    content: {
      text: [
        '### 三版排版对比',
        '',
        '| 方案 | 头像位置 | 长回复可读性 | 备注 |',
        '| --- | --- | --- | --- |',
        '| 气泡 | 正文左侧 | 一般 | 彩色底色太吵，已否决 |',
        '| 头像列 + 作者行 | 固定左上角 | 好 | 当前采用，窄屏也不挤 |',
        '| 极简无头像 | 无 | 差 | 三个 Agent 同时说话时容易看串 |',
      ].join('\n'),
    },
    replyToId: planTrigger.id,
    senderId: qgent.id,
    senderName: qgent.name,
    senderType: 'AGENT',
  })
  push(162, {
    type: 'CODE',
    content: {
      language: 'ts',
      code: [
        "type Sender = 'USER' | 'AGENT' | 'SYSTEM'",
        '',
        'export function isAgent(sender: Sender): boolean {',
        "  return sender === 'AGENT'",
        '}',
      ].join('\n'),
    },
    replyToId: planTrigger.id,
    senderId: qgent.id,
    senderName: qgent.name,
    senderType: 'AGENT',
  })
  push(150, {
    type: 'TEXT',
    content: { text: '这是头像与正文的对比图，窄屏下再看一次。' },
    senderId: '3',
    senderName: '李设计',
    senderType: 'USER',
  })
  push(149, {
    type: 'IMAGE',
    content: {
      attachmentId: 'seed-chat-shot',
      url: '',
      name: '聊天排版对比.png',
      size: 24576,
      mediaType: 'image/svg+xml',
    },
    senderId: '3',
    senderName: '李设计',
    senderType: 'USER',
  })
  push(146, {
    type: 'FILE',
    content: {
      attachmentId: 'seed-chat-checklist',
      url: '',
      name: '聊天体验走查清单.md',
      size: 5120,
      mediaType: 'text/markdown',
    },
    senderId: '2',
    senderName: '张工',
    senderType: 'USER',
  })
  push(120, {
    type: 'TEXT',
    content: { text: '@前端助手 代码块和表格在 375px 下再确认一遍。' },
    senderId: '2',
    senderName: '张工',
    senderType: 'USER',
    mentions: [{ type: 'AGENT', id: helper.id }],
  })
  push(118, {
    type: 'TEXT',
    content: { text: '好，我先看长回复这一版，窄屏等前端助手回来。' },
    senderId: '1',
    senderName: '陈同学',
    senderType: 'USER',
  })

  messages.set(group.id, history)
  const last = history.at(-1)
  group.lastMessageAt = last?.createdAt
  group.latestActivityAt = last?.createdAt
  group.latestMessage = last
    ? { type: last.type, text: chatMessageText(last), senderName: last.senderName }
    : null
}
seedChatShowcase()

/**
 * 与 agent-runs mock 约定的固定演示群：SSE 只在这个群播放执行过程，
 * 群与触发消息 ID 固定为 901 / 9011，方便快照与流事件对齐。
 */
function seedAgentRunDemo() {
  const project = findProject('2')
  if (!project) return
  const agent = projectAgents(project.id).find((item) => item.defaultAgent)
  if (!agent) return
  const createdAt = minutesAgo(30)
  const group: ChatGroup = {
    id: '901',
    projectId: project.id,
    title: 'Agent 进度演示',
    defaultGroup: false,
    createdBy: MOCK_USER.id,
    createdAt,
    unreadCount: 0,
    pinned: false,
  }
  groups.set(group.id, group)
  const members = [...userMembers(group.projectId, [MOCK_USER.id]), agentMember(agent)]
  groupMembers.set(group.id, members)
  group.memberCount = members.length
  const message: ChatMessage = {
    id: '9011',
    groupId: group.id,
    sequence: 1,
    type: 'TEXT',
    content: { text: '@Qgent 演示一次真实执行过程' },
    senderId: MOCK_USER.id,
    senderName: MOCK_USER.displayName,
    senderType: 'USER',
    mentions: [{ type: 'AGENT', id: agent.id }],
    createdAt,
  }
  messages.set(group.id, [message])
  group.lastMessageAt = createdAt
  group.latestActivityAt = createdAt
  group.latestMessage = {
    type: message.type,
    text: chatMessageText(message),
    senderName: message.senderName,
  }
}
seedAgentRunDemo()

/** 固定演示群的 ID 与触发消息；只有它们能收到模拟运行的正式回复。 */
const DEMO_GROUP_ID = '901'
const DEMO_TRIGGER_ID = '9011'

/**
 * 仅供 agent-runs 模拟 SSE 在终态调用：给演示群 901 补一条正式 Agent 回复。
 * 正式消息带 clientMessageId=qgent-reply:<rootRunId>，hook 据此精确替换临时进度行。
 * 其它群/触发消息不存在时返回 null，不伪造真实发送。
 */
export function appendDemoReply(input: {
  rootRunId: string
  agentId: string
  agentName: string
  text: string
}): ChatMessage | null {
  const group = groups.get(DEMO_GROUP_ID)
  const history = group ? messages.get(group.id) : undefined
  if (!group || !history?.some((item) => item.id === DEMO_TRIGGER_ID)) return null
  const reply: ChatMessage = {
    id: nextMockId(),
    groupId: group.id,
    sequence: (history.at(-1)?.sequence ?? 0) + 1,
    type: 'TEXT',
    content: { text: input.text },
    senderId: input.agentId,
    senderName: input.agentName,
    senderType: 'AGENT',
    replyToId: DEMO_TRIGGER_ID,
    clientMessageId: `qgent-reply:${input.rootRunId}`,
    createdAt: new Date().toISOString(),
  }
  history.push(reply)
  group.lastMessageAt = reply.createdAt
  group.latestActivityAt = reply.createdAt
  group.latestMessage = {
    type: reply.type,
    text: chatMessageText(reply),
    senderName: reply.senderName,
  }
  // mock 没有 WS：手动派发消息事件，让聊天页增量拉取这条正式回复，临时进度行才会消失。
  if (typeof window !== 'undefined')
    window.dispatchEvent(
      new CustomEvent('qgents:message-event', {
        detail: { projectId: group.projectId, groupId: group.id },
      }),
    )
  return reply
}

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
  // 演示附件：图片与文本走同一内容接口，预览弹窗与缩略图都能真实加载。
  http.get('/api/projects/:projectId/attachments/:attachmentId', ({ params }) => {
    const file = SHOWCASE_ATTACHMENTS[String(params.attachmentId)]
    if (!file) return notFound()
    return HttpResponse.json({
      data: {
        attachmentId: String(params.attachmentId),
        fileName: file.fileName,
        mediaType: file.mediaType,
        sizeBytes: file.body.length,
        previewable: true,
        previewType: file.mediaType.startsWith('image/') ? 'IMAGE' : 'TEXT',
        contentUrl: `/api/projects/${params.projectId}/attachments/${params.attachmentId}/content`,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    })
  }),
  http.get('/api/projects/:projectId/attachments/:attachmentId/content', ({ params }) => {
    const file = SHOWCASE_ATTACHMENTS[String(params.attachmentId)]
    return file
      ? new HttpResponse(file.body, { headers: { 'Content-Type': file.mediaType } })
      : notFound()
  }),
]
