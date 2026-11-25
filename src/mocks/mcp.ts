import { http, HttpResponse } from 'msw'
import type { CreateMcpServerPayload, McpServer, McpScope, McpAuthMode } from '@/types'
import { activeAgents } from './agents'
import { nextMockId } from './ids'
import { MOCK_PROJECTS } from './state'

/**
 * 项目 MCP mock：共享服务与个人服务共用一份列表，凭证状态与 Agent 分配沿用契约字段。
 * OAuth 起点直接回跳到本项目的设置页并带上片段参数，走真实的回调完成路径。
 */
const servers = new Map<string, McpServer[]>()
const oauthStates = new Map<string, { projectId: string; serverId: string }>()

const findProject = (id: string) =>
  Object.values(MOCK_PROJECTS)
    .flat()
    .find((project) => project.id === id)
const notFound = () =>
  HttpResponse.json({ error: { code: 'NOT_FOUND', message: '资源不存在' } }, { status: 404 })
const invalid = (message: string) =>
  HttpResponse.json({ error: { code: 'MCP_INVALID', message } }, { status: 422 })
const mcpPath = '/api/projects/:projectId/mcp'

function serversOf(projectId: string): McpServer[] {
  const existing = servers.get(projectId)
  if (existing) return existing
  const defaultAgentId = activeAgents(projectId)[0]?.id
  const seeded: McpServer[] = [
    {
      id: nextMockId(),
      name: 'Notion 知识库',
      url: 'https://mcp.notion.com/mcp',
      scope: 'SHARED',
      authMode: 'OAUTH',
      enabled: true,
      credentialStatus: 'CONNECTED',
      agentIds: defaultAgentId ? [defaultAgentId] : [],
    },
    {
      id: nextMockId(),
      name: 'GitHub 代码检索',
      url: 'https://api.githubcopilot.com/mcp/',
      scope: 'PERSONAL',
      authMode: 'BEARER',
      enabled: true,
      credentialStatus: 'MISSING',
      agentIds: [],
    },
    {
      id: nextMockId(),
      name: 'Sentry 告警',
      url: 'https://mcp.sentry.dev/mcp',
      scope: 'PERSONAL',
      authMode: 'OAUTH',
      enabled: true,
      credentialStatus: 'REAUTH_REQUIRED',
      agentIds: defaultAgentId ? [defaultAgentId] : [],
    },
  ]
  servers.set(projectId, seeded)
  return seeded
}

function findServer(projectId: string, serverId: string) {
  return serversOf(projectId).find((server) => server.id === serverId)
}

export const mcpHandlers = [
  http.get(mcpPath, ({ params }) => {
    const project = findProject(String(params.projectId))
    return project
      ? HttpResponse.json({ data: serversOf(project.id) })
      : notFound()
  }),

  http.post(mcpPath, async ({ params, request }) => {
    const project = findProject(String(params.projectId))
    if (!project) return notFound()
    const body = (await request.json()) as Partial<CreateMcpServerPayload>
    const name = body.name?.trim() ?? ''
    const url = body.url?.trim() ?? ''
    if (!name || !url || !body.scope || !body.authMode) {
      return invalid('MCP 服务需要名称、地址、归属和鉴权方式')
    }
    const created: McpServer = {
      id: nextMockId(),
      name,
      url,
      scope: body.scope as McpScope,
      authMode: body.authMode as McpAuthMode,
      enabled: true,
      credentialStatus: 'MISSING',
      agentIds: [],
    }
    serversOf(project.id).push(created)
    return HttpResponse.json({ data: created }, { status: 201 })
  }),

  http.put(`${mcpPath}/:serverId`, async ({ params, request }) => {
    const server = findServer(String(params.projectId), String(params.serverId))
    if (!server) return notFound()
    const body = (await request.json()) as { name?: string; enabled?: boolean }
    const name = body.name?.trim() ?? ''
    if (!name || typeof body.enabled !== 'boolean') return invalid('MCP 服务需要名称和启停状态')
    server.name = name
    server.enabled = body.enabled
    return new HttpResponse(null, { status: 204 })
  }),

  http.delete(`${mcpPath}/:serverId`, ({ params }) => {
    const project = findProject(String(params.projectId))
    if (!project) return notFound()
    const list = serversOf(project.id)
    const index = list.findIndex((server) => server.id === params.serverId)
    if (index < 0) return notFound()
    list.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.put(`${mcpPath}/:serverId/credential`, async ({ params, request }) => {
    const server = findServer(String(params.projectId), String(params.serverId))
    if (!server) return notFound()
    const body = (await request.json()) as { token?: string }
    if (!body.token?.trim()) return invalid('请输入 Token')
    server.credentialStatus = 'CONNECTED'
    return new HttpResponse(null, { status: 204 })
  }),

  http.delete(`${mcpPath}/:serverId/credential`, ({ params }) => {
    const server = findServer(String(params.projectId), String(params.serverId))
    if (!server) return notFound()
    server.credentialStatus = 'MISSING'
    return new HttpResponse(null, { status: 204 })
  }),

  http.put(`${mcpPath}/:serverId/agents`, async ({ params, request }) => {
    const server = findServer(String(params.projectId), String(params.serverId))
    if (!server) return notFound()
    const body = (await request.json()) as { agentIds?: unknown }
    if (!Array.isArray(body.agentIds) || body.agentIds.some((id) => typeof id !== 'string')) {
      return invalid('agentIds 必须是 Agent ID 数组')
    }
    server.agentIds = body.agentIds as string[]
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${mcpPath}/:serverId/oauth`, ({ params }) => {
    const project = findProject(String(params.projectId))
    const server = project ? findServer(project.id, String(params.serverId)) : undefined
    if (!project || !server) return notFound()
    const state = `mock-oauth-${nextMockId()}`
    oauthStates.set(state, { projectId: project.id, serverId: server.id })
    const callback = new URL(`/app/projects/${project.id}/settings`, window.location.origin)
    callback.searchParams.set('tab', 'mcp')
    callback.hash = `mcpState=${state}&mcpCode=mock-authorization-code`
    return HttpResponse.json({ data: { authorizationUrl: callback.toString() } })
  }),

  http.post(`${mcpPath}/oauth/complete`, async ({ params, request }) => {
    const project = findProject(String(params.projectId))
    if (!project) return notFound()
    const body = (await request.json()) as { state?: string; code?: string }
    const pending = body.state ? oauthStates.get(body.state) : undefined
    if (pending && pending.projectId === project.id) {
      oauthStates.delete(body.state!)
      if (body.code) {
        const server = findServer(project.id, pending.serverId)
        if (server) server.credentialStatus = 'CONNECTED'
      }
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${mcpPath}/:serverId/test`, ({ params }) => {
    const server = findServer(String(params.projectId), String(params.serverId))
    if (!server) return notFound()
    return HttpResponse.json({
      data: { tools: ['search', 'fetch_page', 'create_page'] },
    })
  }),
]
