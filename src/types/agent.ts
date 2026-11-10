/** 项目内 Agent：申请未通过时为 PENDING，只有 ACTIVE 能邀请入群并参与对话。 */
export type AgentStatus = 'PENDING' | 'ACTIVE' | 'REJECTED'

export interface ProjectAgent {
  // Agent ID，由后端按项目内自增生成，不使用全局固定 ID
  id: string
  name: string
  description?: string | null
  avatarUrl?: string | null
  // 是否项目默认 Agent；每个项目都有自己的默认 Agent
  defaultAgent: boolean
  status: AgentStatus
}

// POST /projects/{projectId}/agents/applications 请求体：名称与系统提示词必填
export interface AgentApplication {
  name: string
  description?: string
  systemPrompt: string
  avatarUrl?: string
}
