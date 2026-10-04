export type ActivityType = 'GROUP_CREATED'
export type ActivityTargetType = 'PROJECT'
export interface ActivityActor { id: string; displayName: string; avatar?: string | null }
export interface ActivityTarget { type: ActivityTargetType; id: string; title?: string }
export interface Activity {
  id: string
  type: ActivityType
  title: string
  summary?: string | null
  actor: ActivityActor | null
  target: ActivityTarget
  link?: string | null
  createdAt: string
}
