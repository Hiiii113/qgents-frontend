import { http, HttpResponse } from 'msw'
import type { AgentDetail, CreateAgentPayload } from '@/types/agent'
import type { CreateSkillPayload, Skill } from '@/types/skill'
import type { AvailableRepository, GithubConnection, ImportedRepository } from '@/api/repositories'
import { MOCK_PROJECTS, MOCK_USER } from './state'

export const mockAgents: AgentDetail[] = [{ id: 'agent-general', name: '通用助手', avatar: null, role: 'GENERAL', description: '讨论方案、整理知识，也能在接入 GitHub 后协助代码工作。', prompt: '根据项目成员的要求开展工作。', visibility: 'TEAM', status: 'ACTIVE', createdBy: MOCK_USER.id, isDefault: true, githubEnabled: false }]
const skills: Skill[] = []
const connections: GithubConnection[] = [{ id: 'installation-demo', teamId: 'team-owned-001', providerInstallationId: 1001, accountLogin: 'qgents-demo', accountType: 'Organization', suspended: false }]
const available: AvailableRepository[] = [{ installationId: 'installation-demo', repositoryId: 10001, fullName: 'qgents-demo/web', defaultBranch: 'main', htmlUrl: 'https://github.com/qgents-demo/web', privateRepository: false }]
const imported = new Map<string, ImportedRepository[]>()
const notFound = () => HttpResponse.json({ error: { code: 'NOT_FOUND', message: '资源不存在' } }, { status: 404 })
const agentPath = '/api/teams/:teamId/agents'
const agentAvatars = new Map<string, { bytes: ArrayBuffer; mediaType: string }>()
const skillPath = '/api/projects/:projectId/skills'
const githubPath = '/api/teams/:teamId/integrations/github'
export const capabilityHandlers = [
  http.post(`${agentPath}/avatar/credential`, async ({ params, request }) => {
    const body = await request.json() as { mediaType: string }
    const objectKey = `agents/${params.teamId}/${crypto.randomUUID()}.png`
    return HttpResponse.json({ data: { objectKey, uploadUrl: `${new URL(request.url).origin}/api/mock-agent-avatars/${encodeURIComponent(objectKey)}`, method: 'PUT', headers: { 'Content-Type': body.mediaType }, expiresAt: new Date(Date.now() + 300000).toISOString() } })
  }),
  http.put('/api/mock-agent-avatars/:objectKey', async ({ params, request }) => {
    agentAvatars.set(String(params.objectKey), { bytes: await request.arrayBuffer(), mediaType: request.headers.get('Content-Type') || 'image/png' })
    return new HttpResponse(null, { status: 200 })
  }),
  http.get('/api/mock-agent-avatars/:objectKey', ({ params }) => {
    const avatar = agentAvatars.get(String(params.objectKey))
    return avatar ? new HttpResponse(avatar.bytes, { headers: { 'Content-Type': avatar.mediaType } }) : notFound()
  }),
  http.post(`${agentPath}/avatar/confirm`, async ({ request }) => {
    const { objectKey } = await request.json() as { objectKey: string }
    return agentAvatars.has(objectKey) ? HttpResponse.json({ data: { avatarUrl: `${new URL(request.url).origin}/api/mock-agent-avatars/${encodeURIComponent(objectKey)}` } }) : notFound()
  }),
  http.get(agentPath, () => HttpResponse.json({ data: mockAgents })),
  http.get(`${agentPath}/:agentId`, ({ params }) => { const agent = mockAgents.find(item => item.id === params.agentId); return agent ? HttpResponse.json({ data: agent }) : notFound() }),
  http.post(agentPath, async ({ request }) => {
    const body = await request.json() as CreateAgentPayload
    const agent: AgentDetail = { ...body, githubEnabled: body.githubEnabled ?? false, id: crypto.randomUUID(), avatar: body.avatar ?? null, visibility: 'PRIVATE', status: 'ACTIVE', createdBy: MOCK_USER.id, isDefault: false }
    mockAgents.push(agent); return HttpResponse.json({ data: agent }, { status: 201 })
  }),
  http.patch(`${agentPath}/:agentId`, async ({ params, request }) => {
    const agent = mockAgents.find(item => item.id === params.agentId); if (!agent) return notFound()
    const body = await request.json() as Partial<CreateAgentPayload>
    if (agent.isDefault && Object.keys(body).some(key => key !== 'name' && key !== 'avatar')) return HttpResponse.json({ error: { code: 'AGENT_INVALID_REQUEST', message: '默认 Agent 仅支持修改昵称与头像' } }, { status: 422 })
    Object.assign(agent, body); return HttpResponse.json({ data: agent })
  }),
  http.put(`${agentPath}/:agentId/github-capability`, async ({ params, request }) => {
    const agent = mockAgents.find(item => item.id === params.agentId); if (!agent) return notFound()
    const body = await request.json() as { enabled: boolean }
    agent.githubEnabled = body.enabled
    return HttpResponse.json({ data: agent })
  }),
  ...(['publish', 'approve', 'reject', 'archive'] as const).map(action => http.post(`${agentPath}/:agentId/${action}`, ({ params }) => {
    const agent = mockAgents.find(item => item.id === params.agentId); if (!agent) return notFound()
    if (action === 'archive') agent.status = 'ARCHIVED'
    else agent.visibility = action === 'reject' ? 'PRIVATE' : 'TEAM'
    return HttpResponse.json({ data: agent })
  })),
  http.get(skillPath, ({ params }) => HttpResponse.json({ data: skills.filter(skill => skill.projectId === params.projectId) })),
  http.get(`${skillPath}/:skillId`, ({ params }) => HttpResponse.json({ data: skills.find(skill => skill.id === params.skillId) })),
  http.post(skillPath, async ({ params, request }) => {
    const body = await request.json() as CreateSkillPayload
    const now = new Date().toISOString()
    const projectId = String(params.projectId)
    const autoPublish = body.visibility === 'PRIVATE' || Object.values(MOCK_PROJECTS).flat().find(project => project.id === projectId)?.role === 'PROJECT_ADMIN'
    const skill: Skill = { ...body, id: crypto.randomUUID(), projectId, status: autoPublish ? 'PUBLISHED' : 'DRAFT', creator: MOCK_USER, reviewer: autoPublish ? MOCK_USER : null, reviewedAt: autoPublish ? now : null, createdAt: now, updatedAt: now }
    skills.push(skill); return HttpResponse.json({ data: skill }, { status: 201 })
  }),
  http.patch(`${skillPath}/:skillId`, async ({ params, request }) => {
    const skill = skills.find(item => item.id === params.skillId); if (!skill) return notFound()
    Object.assign(skill, await request.json(), { updatedAt: new Date().toISOString() }); return HttpResponse.json({ data: skill })
  }),
  ...(['submit-review', 'approve', 'reject', 'archive'] as const).map(action => http.post(`${skillPath}/:skillId/${action}`, ({ params }) => {
    const skill = skills.find(item => item.id === params.skillId); if (!skill) return notFound()
    skill.status = action === 'submit-review' ? 'PENDING_REVIEW' : action === 'approve' ? 'PUBLISHED' : action === 'reject' ? 'REJECTED' : 'ARCHIVED'
    return HttpResponse.json({ data: skill })
  })),
  http.get(`${githubPath}/installations`, ({ params }) => HttpResponse.json({ data: connections.filter(item => item.teamId === params.teamId) })),
  http.get(`${githubPath}/repositories`, ({ params }) => HttpResponse.json({ data: available.filter(item => connections.some(connection => connection.id === item.installationId && connection.teamId === params.teamId)) })),
  http.post(`${githubPath}/installations`, () => HttpResponse.json({ data: { installationUrl: 'https://github.com/apps/qgents/installations/new' } })),
  http.post(`${githubPath}/installations/:installationId/sync`, () => HttpResponse.json({ data: null })),
  http.delete(`${githubPath}/installations/:installationId`, ({ params }) => { const index = connections.findIndex(item => item.id === params.installationId); if (index >= 0) connections.splice(index, 1); return HttpResponse.json({ data: null }) }),
  http.get('/api/projects/:projectId/repositories', ({ params }) => HttpResponse.json({ data: imported.get(String(params.projectId)) ?? [] })),
  http.post('/api/projects/:projectId/repositories', async ({ params, request }) => {
    const { installationId, repositoryId } = await request.json() as { installationId: string; repositoryId: number }
    const repository = available.find(item => item.installationId === installationId && item.repositoryId === repositoryId); if (!repository) return notFound()
    const projectId = String(params.projectId)
    const item: ImportedRepository = { ...repository, id: crypto.randomUUID(), projectId, providerRepositoryId: repositoryId }
    const list = imported.get(projectId) ?? []; list.push(item); imported.set(projectId, list)
    return HttpResponse.json({ data: item }, { status: 201 })
  }),
  http.delete('/api/projects/:projectId/repositories/:repositoryId', ({ params }) => {
    const projectId = String(params.projectId); imported.set(projectId, (imported.get(projectId) ?? []).filter(item => item.id !== params.repositoryId)); return HttpResponse.json({ data: null })
  }),
  http.get('/api/notifications', () => HttpResponse.json({ data: [], page: { hasMore: false, nextCursor: null } })),
  http.post('/api/notifications/read-all', () => HttpResponse.json({ data: null })),
  http.post('/api/notifications/:id/read', () => HttpResponse.json({ data: null })),
  http.post('/api/projects/:projectId/avatar/credential', () => HttpResponse.json({ error: { code: 'AVATAR_STORAGE_NOT_CONFIGURED', message: '演示环境未配置头像存储' } }, { status: 501 })),
  http.post('/api/projects/:projectId/attachments', () => HttpResponse.json({ error: { code: 'ATTACHMENT_STORAGE_NOT_CONFIGURED', message: '演示环境未配置附件存储' } }, { status: 501 })),
]
