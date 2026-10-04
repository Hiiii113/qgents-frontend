import { PATHS } from '@/routes/paths'
import type { Notification } from '@/types'

/** 通知 → 跳转目标路由（无对应资源时兜底到项目详情） */
export function notificationTargetPath(n: Notification): string | null {
  if (n.kind === 'INVITED') return PATHS.JOIN_TEAM
  const projectId = n.projectId
  if (!projectId) return null
  return PATHS.projectChat(projectId, n.kind === 'MESSAGE_MENTION' ? n.resourceId : undefined, n.groupId)
}

