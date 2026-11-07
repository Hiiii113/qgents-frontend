import { request } from './client'
import type { ProjectMemory, SaveProjectMemoryPayload } from '@/types'

/**
 * 项目长期记忆 API —— memory.md 单文件
 */
export const memoryApi = {
  /** 读取项目 memory.md 全文、版本和最后修改时间。 */
  get(projectId: string) {
    return request<ProjectMemory>(`/projects/${projectId}/memory`)
  },
  /** 整篇保存；version 与当前内容不一致时后端返回 409。 */
  save(projectId: string, payload: SaveProjectMemoryPayload) {
    return request<ProjectMemory>(`/projects/${projectId}/memory`, {
      method: 'PUT',
      body: payload,
    })
  },
}
