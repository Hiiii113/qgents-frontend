import { request } from './client'
import type { AgentApplication, ProjectAgent } from '@/types/agent'

const projectPath = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/agents`

/** 项目内 Agent：列表只返回已启用 Agent，提交申请返回待审批记录。 */
export const agentApi = {
  list: (projectId: string) => request<ProjectAgent[]>(projectPath(projectId)),
  apply: (projectId: string, body: AgentApplication) =>
    request<ProjectAgent>(`${projectPath(projectId)}/applications`, { method: 'POST', body }),
}
