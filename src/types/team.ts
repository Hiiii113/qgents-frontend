/**
 * 团队相关类型 —— 当前接口
 */

// 团队角色
export type TeamRole = 'TEAM_OWNER' | 'TEAM_ADMIN' | 'TEAM_MEMBER'

export interface Team {
  id: string
  name: string
  // 当前用户在团队中的角色
  role?: TeamRole
  description?: string
  avatarUrl?: string
  createdAt?: string
  // 团队成员数
  memberCount?: number
}

export interface TeamMember {
  userId: string
  // 成员显示名
  displayName?: string
  // 成员邮箱
  email?: string
  role: TeamRole
  avatarUrl?: string
}

// PATCH /teams/{teamId} 请求体；创建团队不接受 avatarUrl
export interface CreateTeamPayload {
  name: string
  description?: string
  // 头像由头像上传 confirm 写入；这里仅用空串清空，非空地址会被服务端拒绝
  avatarUrl?: string
}

// POST /teams/{teamId}/invitations 请求体
export interface CreateInvitationPayload {
  email: string
  role: TeamRole
  expiresInDays?: number
}

// 团队邀请
export interface TeamInvitation {
  id: string
  email: string
  role: TeamRole
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'
  createdAt: string
  expiresAt: string
}

// POST /team-invitations/{reference}/accept 响应（= TeamMemberResponse）
export interface AcceptInvitationResponse {
  userId: string
  displayName: string
  role: TeamRole
  joinedAt: string
}

/**
 * 当前用户收到的待处理团队邀请（GET /team-invitations，收件人视角）
 * - 不返回 token（后端只存哈希），接受用 id
 * - role 恒为 TEAM_MEMBER
 * - status 含 EXPIRED（PENDING 但已过期按 EXPIRED 展示）
 */
export interface MyTeamInvitation {
  id: string
  teamId: string
  teamName: string
  role: TeamRole
  inviterDisplayName: string
  status: 'PENDING' | 'EXPIRED'
  expiresAt: string
  createdAt: string
}
