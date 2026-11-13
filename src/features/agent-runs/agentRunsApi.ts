import { request } from '@/api/client'
import { parseAgentRunSnapshots, type AgentRunSnapshot } from './agentRunState'

/** 契约路径（前端 base 已含 /api，后端代理再补 /v1）。 */
export function agentEventsPath(projectId: string, groupId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/groups/${encodeURIComponent(groupId)}/agent-events`
}

export async function fetchAgentRunSnapshots(
  projectId: string,
  groupId: string,
  signal?: AbortSignal,
): Promise<AgentRunSnapshot[]> {
  const payload = await request<unknown>(
    `/projects/${encodeURIComponent(projectId)}/agent-runs?groupId=${encodeURIComponent(groupId)}`,
    { signal },
  )
  return parseAgentRunSnapshots(payload)
}
