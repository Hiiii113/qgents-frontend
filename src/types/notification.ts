export type NotificationKind = 'MESSAGE_MENTION' | 'INVITED' | 'TEAM_JOINED' | 'PROJECT_ADDED'
export interface Notification {
  id: string
  kind: NotificationKind
  title: string
  description?: string
  isRead: boolean
  createdAt: string
  projectId?: string
  groupId?: string
  resourceId?: string
}
