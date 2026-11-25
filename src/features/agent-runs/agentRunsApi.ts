import { request } from '@/api/client'
import { parseAgentRunSnapshots, type AgentRunSnapshot } from './agentRunState'

/** REST 快照入口（挂载与 WS 重连时重查），WS 只负责增量帧。 */
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
