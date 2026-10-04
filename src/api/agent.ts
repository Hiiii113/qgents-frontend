import { request } from './client'
import type { AgentDetail, AgentSummary, CreateAgentPayload, UpdateAgentPayload } from '@/types/agent'
const path = (teamId: string) => `/teams/${encodeURIComponent(teamId)}/agents`
const itemPath = (teamId: string, agentId: string) => `${path(teamId)}/${encodeURIComponent(agentId)}`
export const agentApi = {
  list: (teamId: string) => request<AgentSummary[]>(path(teamId)),
  get: (teamId: string, agentId: string) => request<AgentDetail>(itemPath(teamId, agentId)),
  create: (teamId: string, body: CreateAgentPayload) => request<AgentDetail>(path(teamId), { method: 'POST', body }),
  update: (teamId: string, agentId: string, body: UpdateAgentPayload) => request<AgentDetail>(itemPath(teamId, agentId), { method: 'PATCH', body }),
  configureGithub: (teamId: string, agentId: string, enabled: boolean) => request<AgentDetail>(`${itemPath(teamId, agentId)}/github-capability`, { method: 'PUT', body: { enabled } }),
  publish: (teamId: string, agentId: string) => request<AgentDetail>(`${itemPath(teamId, agentId)}/publish`, { method: 'POST' }),
  approve: (teamId: string, agentId: string) => request<AgentDetail>(`${itemPath(teamId, agentId)}/approve`, { method: 'POST' }),
  reject: (teamId: string, agentId: string, reason?: string) => request<AgentDetail>(`${itemPath(teamId, agentId)}/reject`, { method: 'POST', body: reason ? { reason } : undefined }),
  archive: (teamId: string, agentId: string) => request<AgentDetail>(`${itemPath(teamId, agentId)}/archive`, { method: 'POST' }),
  avatarCredential: (teamId: string, body: { mediaType: string; sizeBytes: number }) => request<{ objectKey: string; uploadUrl: string; method: string; headers: Record<string, string>; expiresAt: string }>(`${path(teamId)}/avatar/credential`, { method: 'POST', body }),
  avatarConfirm: (teamId: string, objectKey: string) => request<{ avatarUrl: string }>(`${path(teamId)}/avatar/confirm`, { method: 'POST', body: { objectKey } }),
}
