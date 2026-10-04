export type AgentRole = string
export type AgentVisibility = 'PRIVATE' | 'PENDING' | 'TEAM' | 'SYSTEM'
export type AgentStatus = 'ACTIVE' | 'ARCHIVED'
export interface AgentSummary {
  id: string
  name: string
  avatar: string | null
  role: AgentRole
  description: string | null
  visibility: AgentVisibility
  status: AgentStatus
  createdBy: string | null
  isDefault?: boolean
  githubEnabled: boolean
  reviewReason?: string | null
  reviewedBy?: string | null
  reviewedAt?: string | null
}
export interface AgentDetail extends AgentSummary { prompt?: string | null }
export interface CreateAgentPayload {
  name: string
  avatar?: string
  role: AgentRole
  description: string
  prompt: string
  githubEnabled?: boolean
}
export type UpdateAgentPayload = Partial<CreateAgentPayload>
