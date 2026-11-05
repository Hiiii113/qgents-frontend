import { request } from './client'
import type { CreateSkillPayload, Skill, SkillPreview, UpdateSkillPayload } from '@/types'

/**
 * 共享 Skill API —— 当前接口
 */
export const skillApi = {
  /** 查询 Skill（支持状态、标签过滤） */
  list(projectId: string) {
    return request<Skill[]>(`/projects/${projectId}/skills`)
  },
  preview(projectId: string, file: File) {
    const body = new FormData()
    body.append('file', file)
    return request<SkillPreview>(`/projects/${projectId}/skills/preview`, { method: 'POST', body })
  },
  /** 创建 Skill：PRIVATE 与 Project Admin 自建 PROJECT_SHARED 直接 PUBLISHED，普通成员共享 Skill 返回 DRAFT。 */
  create(projectId: string, payload: CreateSkillPayload) {
    const body = new FormData()
    body.append('file', payload.file)
    body.append('visibility', payload.visibility)
    body.append('tags', JSON.stringify(payload.tags))
    return request<Skill>(`/projects/${projectId}/skills`, {
      method: 'POST',
      body,
    })
  },
  /** 获取 / 编辑草稿或审核中内容 */
  getById(projectId: string, skillId: string) {
    return request<Skill>(`/projects/${projectId}/skills/${skillId}`)
  },
  patch(projectId: string, skillId: string, payload: UpdateSkillPayload) {
    return request<Skill>(`/projects/${projectId}/skills/${skillId}`, {
      method: 'PATCH',
      body: payload,
    })
  },
  /** 提交审核 */
  submitReview(projectId: string, skillId: string) {
    return request<Skill>(`/projects/${projectId}/skills/${skillId}/submit-review`, {
      method: 'POST',
    })
  },
  /** 批准并发布（Project Admin） */
  approve(projectId: string, skillId: string) {
    return request<Skill>(`/projects/${projectId}/skills/${skillId}/approve`, {
      method: 'POST',
    })
  },
  /** 拒绝（Project Admin） */
  reject(projectId: string, skillId: string, reason: string) {
    return request<Skill>(`/projects/${projectId}/skills/${skillId}/reject`, {
      method: 'POST',
      body: { reason },
    })
  },
  /** 归档 / 下线已发布 Skill（Project Admin） */
  archive(projectId: string, skillId: string) {
    return request<Skill>(`/projects/${projectId}/skills/${skillId}/archive`, {
      method: 'POST',
    })
  },
}
