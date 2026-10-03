import { PATHS } from '@/routes/paths'
import type { Notification } from '@/types'

/** 通知 → 跳转目标路由（无对应资源时兜底到项目详情） */
export function notificationTargetPath(n: Notification): string | null {
  if (n.kind === 'INVITED') return PATHS.JOIN_TEAM
  const projectId = n.projectId
  if (!projectId) return null
  switch (n.kind) {
    case 'MESSAGE_MENTION':
      // 群聊 @ 提及：跳转到来源需求群
      return n.groupId ? PATHS.projectReqChat(projectId, n.groupId) : PATHS.projectTasks(projectId)
    case 'TASK_COMPLETED':
    case 'TASK_FAILED':
    case 'TASK_AWAITING_CONFIRMATION':
    case 'AGENT_INPUT_REQUIRED':
      return n.resourceId ? PATHS.projectTaskDetail(projectId, n.resourceId) : PATHS.projectTasks(projectId)
    case 'MR_PENDING':
      return n.resourceId ? PATHS.projectCodeMr(projectId, n.resourceId) : PATHS.projectCode(projectId)
    case 'DELIVERABLE_PENDING':
      // §7.1：diff.created 触发 DELIVERABLE_PENDING，resourceId = diffId → 跳交付中心 Diff 详情
      return n.resourceId ? PATHS.projectDiff(projectId, n.resourceId) : PATHS.projectDiffs(projectId)
    default:
      return PATHS.projectDetail(projectId)
  }
}

