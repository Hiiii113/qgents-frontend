import { request } from './client'
import type {
  CompleteMcpOAuthPayload,
  CreateMcpServerPayload,
  McpServer,
  McpToolList,
  UpdateMcpServerPayload,
} from '@/types'

const projectMcpPath = (projectId: string) =>
  `/projects/${encodeURIComponent(projectId)}/mcp`

const serverPath = (projectId: string, serverId: string) =>
  `${projectMcpPath(projectId)}/${encodeURIComponent(serverId)}`

/** 项目 MCP 服务：共享凭证与个人凭证都在服务端保存，前端不落地 token。 */
export const mcpApi = {
  list(projectId: string) {
    return request<McpServer[]>(projectMcpPath(projectId))
  },

  create(projectId: string, payload: CreateMcpServerPayload) {
    return request<McpServer>(projectMcpPath(projectId), { method: 'POST', body: payload })
  },

  update(projectId: string, serverId: string, payload: UpdateMcpServerPayload) {
    return request<void>(serverPath(projectId, serverId), { method: 'PUT', body: payload })
  },

  remove(projectId: string, serverId: string) {
    return request<void>(serverPath(projectId, serverId), { method: 'DELETE' })
  },

  saveCredential(projectId: string, serverId: string, token: string) {
    return request<void>(`${serverPath(projectId, serverId)}/credential`, {
      method: 'PUT',
      body: { token },
    })
  },

  disconnectCredential(projectId: string, serverId: string) {
    return request<void>(`${serverPath(projectId, serverId)}/credential`, { method: 'DELETE' })
  },

  assignAgents(projectId: string, serverId: string, agentIds: string[]) {
    return request<void>(`${serverPath(projectId, serverId)}/agents`, {
      method: 'PUT',
      body: { agentIds },
    })
  },

  startOAuth(projectId: string, serverId: string) {
    return request<{ authorizationUrl: string }>(`${serverPath(projectId, serverId)}/oauth`, {
      method: 'POST',
    })
  },

  /** 回调页读到 mcpState / mcpCode 后回到服务端换取并保存凭证。 */
  completeOAuth(projectId: string, payload: CompleteMcpOAuthPayload) {
    return request<void>(`${projectMcpPath(projectId)}/oauth/complete`, {
      method: 'POST',
      body: payload,
    })
  },

  test(projectId: string, serverId: string) {
    return request<McpToolList>(`${serverPath(projectId, serverId)}/test`, { method: 'POST' })
  },
}
