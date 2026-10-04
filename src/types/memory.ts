/**
 * 共享 Memory —— 当前接口
 *
 * Memory 是经人工确认后供项目复用的知识，不是原始聊天记录。
 */

// Memory 状态：DRAFT -> PENDING_REVIEW -> APPROVED / REJECTED / ARCHIVED
export type MemoryStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'ARCHIVED'

// 创建者 / 审核者摘要（展示用）
export interface MemoryActor {
  id: string
  displayName: string
}

export interface Memory {
  id: string
  projectId: string
  title: string
  content: string
  category: string
  tags: string[]
  status: MemoryStatus
  creator: MemoryActor
  reviewer: MemoryActor | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

// 创建 Memory 请求体（POST /memories）
export interface CreateMemoryPayload {
  title: string
  content: string
  category: string
  tags: string[]
}
