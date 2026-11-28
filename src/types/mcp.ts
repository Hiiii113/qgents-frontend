/** 项目 MCP：共享服务由管理员维护凭证；个人服务由每位成员保存自己的凭证。 */
export type McpScope = 'SHARED' | 'PERSONAL'
export type McpAuthMode = 'BEARER' | 'OAUTH'
export type McpCredentialStatus = 'MISSING' | 'CONNECTED' | 'REAUTH_REQUIRED'

export interface McpServer {
  id: string
  name: string
  url: string
  scope: McpScope
  authMode: McpAuthMode
  enabled: boolean
  credentialStatus: McpCredentialStatus
  agentIds: string[]
}

/** 服务地址、归属与鉴权方式只在创建时提交，之后不可修改。 */
export interface CreateMcpServerPayload {
  name: string
  url: string
  scope: McpScope
  authMode: McpAuthMode
}

/** PUT /{id} 只保存名称与启停。 */
export interface UpdateMcpServerPayload {
  name: string
  enabled: boolean
}

/** OAuth 回调里的授权码可能缺失（成员在供应商页面取消授权）。 */
export interface CompleteMcpOAuthPayload {
  state: string
  code?: string
}

export interface McpToolList {
  tools: string[]
}
