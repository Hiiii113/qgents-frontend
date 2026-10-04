import { request } from './client'
import type { CreateMemoryPayload, Memory } from '@/types'

/**
 * 共享 Memory API —— 当前接口
 */
export const memoryApi = {
  /** 查询当前用户可见的 Memory。 */
  list(projectId: string) {
    return request<Memory[]>(`/projects/${projectId}/memories`)
  },
  /** 创建 Memory；管理员直接发布，普通成员保存草稿。 */
  create(projectId: string, payload: CreateMemoryPayload) {
    return request<Memory>(`/projects/${projectId}/memories`, {
      method: 'POST',
      body: payload,
    })
  },
  /** 获取 / 编辑草稿或审核中内容 */
  getById(projectId: string, memoryId: string) {
    return request<Memory>(`/projects/${projectId}/memories/${memoryId}`)
  },
  patch(projectId: string, memoryId: string, payload: Partial<CreateMemoryPayload>) {
    return request<Memory>(`/projects/${projectId}/memories/${memoryId}`, {
      method: 'PATCH',
      body: payload,
    })
  },
  /** 提交审核 */
  submitReview(projectId: string, memoryId: string) {
    return request<Memory>(`/projects/${projectId}/memories/${memoryId}/submit-review`, {
      method: 'POST',
    })
  },
  /** 批准并发布（Project Admin） */
  approve(projectId: string, memoryId: string) {
    return request<Memory>(`/projects/${projectId}/memories/${memoryId}/approve`, {
      method: 'POST',
    })
  },
  /** 拒绝（Project Admin） */
  reject(projectId: string, memoryId: string, reason: string) {
    return request<Memory>(`/projects/${projectId}/memories/${memoryId}/reject`, {
      method: 'POST',
      body: { reason },
    })
  },
  /** 归档（Project Admin） */
  archive(projectId: string, memoryId: string) {
    return request<Memory>(`/projects/${projectId}/memories/${memoryId}/archive`, {
      method: 'POST',
    })
  },
}
