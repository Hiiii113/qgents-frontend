import { http, HttpResponse } from 'msw'
import type { AgentApplication, ProjectAgent } from '@/types/agent'
import { nextMockId } from './ids'
import { MOCK_PROJECTS } from './state'

const agents = new Map<string, ProjectAgent[]>()
const findProject = (id: string) => Object.values(MOCK_PROJECTS).flat().find(project => project.id === id)
const notFound = () => HttpResponse.json({ error: { code: 'NOT_FOUND', message: '资源不存在' } }, { status: 404 })

/** 每个项目首次访问时创建自己的默认 Agent；ID 来自统一自增序列，项目之间互不复用。 */
export function projectAgents(projectId: string): ProjectAgent[] {
  const existing = agents.get(projectId)
  if (existing) return existing
  const created: ProjectAgent[] = [{
    id: nextMockId(), name: 'Qgent', description: '项目默认 Agent，负责协作与执行', defaultAgent: true, status: 'ACTIVE',
  }]
  agents.set(projectId, created)
  return created
}

/** 已启用 Agent 才能邀请入群并参与对话；待审批申请留在 PENDING。 */
export const activeAgents = (projectId: string) => projectAgents(projectId).filter(agent => agent.status === 'ACTIVE')

export const agentHandlers = [
  http.get('/api/projects/:projectId/agents', ({ params }) => {
    const project = findProject(String(params.projectId))
    return project ? HttpResponse.json({ data: activeAgents(project.id) }) : notFound()
  }),
  http.post('/api/projects/:projectId/agents/applications', async ({ params, request }) => {
    const project = findProject(String(params.projectId))
    if (!project) return notFound()
    const body = await request.json() as Partial<AgentApplication>
    const name = body.name?.trim() ?? ''
    const systemPrompt = body.systemPrompt?.trim() ?? ''
    if (!name || !systemPrompt) {
      return HttpResponse.json({ error: { code: 'AGENT_APPLICATION_INVALID', message: 'Agent 申请需要名称和系统提示词' } }, { status: 422 })
    }
    const application: ProjectAgent = {
      id: nextMockId(), name, description: body.description?.trim() || undefined, avatarUrl: body.avatarUrl?.trim() || undefined,
      defaultAgent: false, status: 'PENDING',
    }
    projectAgents(project.id).push(application)
    return HttpResponse.json({ data: application }, { status: 201 })
  }),
]
