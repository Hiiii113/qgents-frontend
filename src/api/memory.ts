import { request } from './client'
import type { ProjectMemory } from '@/types'

/** 项目长期记忆 API —— 只读取 memory.md；写入由聊天中的 Qgent 工具完成。 */
export const memoryApi = {
  /** 读取项目 memory.md 全文和最后修改时间。 */
  get(projectId: string) {
    return request<ProjectMemory>(`/projects/${projectId}/memory`)
  },
}
