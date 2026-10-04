import { describe, expect, it } from 'vitest'
import { notificationTargetPath } from './notificationTargetPath'
import type { Notification } from '@/types'
const notification: Notification = { id: 'n1', kind: 'MESSAGE_MENTION', projectId: 'p1', groupId: 'g1', resourceId: 'm1', title: '提及你', isRead: false, createdAt: '2026-10-01T00:00:00Z' }
describe('notification routing', () => {
  it('opens the project chat and locates a mentioned message', () => expect(notificationTargetPath(notification)).toBe('/app/projects/p1/chat?messageId=m1&groupId=g1'))
  it('opens invitations and safely handles missing project context', () => {
    expect(notificationTargetPath({ ...notification, kind: 'INVITED' })).toBe('/app/teams/join')
    expect(notificationTargetPath({ ...notification, projectId: undefined })).toBeNull()
  })
})
