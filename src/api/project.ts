import { request, requestPage } from './client'
import { withQuery } from './requestHelpers'
import type { CreateProjectPayload, Project, ProjectMember, UpdateProjectPayload } from '@/types'

/**
 * 项目管理 API —— 当前接口
 */
export const projectApi = {
  /** GET /teams/{teamId}/projects — 团队下的项目列表（仅返回有权限访问的） */
  listByTeam(teamId: string) {
    return request<Project[]>(`/teams/${teamId}/projects`)
  },

  /** POST /teams/{teamId}/projects — 创建项目 */
  create(payload: CreateProjectPayload) {
    return request<Project>(`/teams/${payload.teamId}/projects`, {
      method: 'POST',
      body: payload,
    })
  },

  /** GET /projects/{projectId} — 获取项目资料 */
  getById(projectId: string) {
    return request<Project>(`/projects/${projectId}`)
  },

  /** PATCH /projects/{projectId} — 修改项目资料（仅 PROJECT_ADMIN） */
  update(projectId: string, payload: UpdateProjectPayload) {
    return request<Project>(`/projects/${projectId}`, {
      method: 'PATCH',
      body: payload,
    })
  },

  /** POST /projects/{projectId}/avatar/credential — 签发项目头像直传凭证（OSS 未启用时 501） */
  avatarCredential(projectId: string, input: { mediaType: string; sizeBytes: number }) {
    return request<{ objectKey: string; uploadUrl: string; method: string; headers: Record<string, string>; expiresAt: string }>(
      `/projects/${projectId}/avatar/credential`, { method: 'POST', body: input })
  },

  /** POST /projects/{projectId}/avatar/confirm — 确认项目头像上传并返回公共读 URL */
  avatarConfirm(projectId: string, objectKey: string) {
    return request<{ avatarUrl: string }>(`/projects/${projectId}/avatar/confirm`, {
      method: 'POST',
      body: { objectKey },
    })
  },

  /** POST /projects/{projectId}/archive — 归档项目 */
  archive(projectId: string) {
    return request<void>(`/projects/${projectId}/archive`, { method: 'POST' })
  },

  /** POST /projects/{projectId}/restore — 恢复项目 */
  restore(projectId: string) {
    return request<void>(`/projects/${projectId}/restore`, { method: 'POST' })
  },

  /**
   * GET /projects/{projectId}/members — 项目成员（ 分页契约）。
   * 仅返回 project_members 显式成员（不为 canonical Team Owner 虚构行）；
   * 当前用户可访问项目但不在列表中是合法状态，权限判断用 GET /projects/{id} 的 data.role。
   */
  listMembersPage(projectId: string, filters: { cursor?: string; limit?: number } = {}) {
    return requestPage<ProjectMember>(withQuery(`/projects/${projectId}/members`, filters))
  },

  /**
   * 兼容旧调用方：循环翻页拉取全部显式项目成员。
   * 成员量级小（项目成员），一次全量返回便于 displayName 补全与差集计算。
   */
  async listMembers(projectId: string): Promise<ProjectMember[]> {
    const all: ProjectMember[] = []
    let cursor: string | undefined
    do {
      const page = await this.listMembersPage(projectId, { cursor, limit: 100 })
      all.push(...page.data)
      cursor = page.page.hasMore ? (page.page.nextCursor ?? undefined) : undefined
    } while (cursor)
    return all
  },

  /** POST /projects/{projectId}/members — 将现有团队成员加入项目 */
  addMember(projectId: string, userId: string) {
    return request<void>(`/projects/${projectId}/members`, {
      method: 'POST',
      body: { userId },
    })
  },

  /** PATCH /projects/{projectId}/members/{userId} — 调整项目成员角色 */
  updateMemberRole(projectId: string, userId: string, role: string) {
    return request<void>(`/projects/${projectId}/members/${userId}`, {
      method: 'PATCH',
      body: { role },
    })
  },

  /** DELETE /projects/{projectId}/members/{userId} — 从项目移除成员 */
  removeMember(projectId: string, userId: string) {
    return request<void>(`/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    })
  },
}
