import { request } from './client'
import type { Notification } from '@/types'

/**
 * 通知中心 API —— 列表及已读状态来自后端。

 */
export const notificationApi = {
  /** 获取当前用户通知列表 */
  list() {
    return request<Notification[]>('/notifications')
  },
  /** 标记单条已读 */
  markRead(id: string) {
    return request<void>(`/notifications/${id}/read`, { method: 'POST' })
  },
  /** 全部已读 */
  markAllRead() {
    return request<void>('/notifications/read-all', { method: 'POST' })
  },
}
