import { afterEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/query'
import { dispatchRealtimeFrame, realtimeWsUrl } from './realtimeClient'
import type { RealtimeFrame } from '@/types'

afterEach(() => vi.restoreAllMocks())

describe('realtimeWsUrl', () => {
  it('builds the ws endpoint with the access token in the query', () => {
    const url = realtimeWsUrl('token-123')
    expect(url.startsWith('ws://') || url.startsWith('wss://')).toBe(true)
    expect(url.endsWith('/ws/realtime?token=token-123')).toBe(true)
  })

  it('URL-encodes the token', () => {
    expect(realtimeWsUrl('a b&c')).toContain('?token=a%20b%26c')
  })
})

describe('dispatchRealtimeFrame', () => {
  it('refreshes chat participants after Qgent joins without refetching message history', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    dispatchRealtimeFrame({ type: 'group.member.updated', scope: 'project', projectId: 'p1', groupId: 'g1', payload: {} })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['chat', 'projects', 'p1', 'members'] })
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ['chat', 'projects', 'p1', 'groups', 'g1', 'messages'] })
  })
  it('refreshes chat membership when project members change', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    dispatchRealtimeFrame({ type: 'project.member.added', scope: 'team', teamId: 't1', resourceId: 'p1', payload: { projectId: 'p1' } })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['chat', 'projects', 'p1', 'members'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['chat', 'projects', 'p1', 'groups'], exact: true })
  })
  it('refreshes the notification list for any notification-scope frame (type=kind, e.g. PROJECT_ADDED)', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    dispatchRealtimeFrame({
      type: 'PROJECT_ADDED',
      scope: 'notification',
      recipientUserId: '1',
      payload: { notificationId: '1', kind: 'PROJECT_ADDED' },
    })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['notifications'] })
  })

  it('refreshes the project group list without refetching message history for message.created', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    const frame: RealtimeFrame = {
      type: 'message.created',
      scope: 'project',
      projectId: '1',
      groupId: '1',
      resourceId: '1',
      payload: { projectId: '1', groupId: '1', messageId: '1' },
    }
    dispatchRealtimeFrame(frame)
    expect(spy).toHaveBeenCalledWith({ queryKey: ['chat', 'projects', '1', 'groups'], exact: true })
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ['chat', 'projects', '1', 'groups', '1', 'messages'] })
  })

  it('ignores removed task event types', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    dispatchRealtimeFrame({
      type: 'task.updated',
      scope: 'project',
      projectId: '1',
      payload: { projectId: '1', taskId: '1' },
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it('refreshes team lists for team-scope events', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    dispatchRealtimeFrame({
      type: 'project.member.added',
      scope: 'team',
      teamId: '1',
      payload: { teamId: '1' },
    })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['teams', 'mine'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['teams', '1', 'projects'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['teams', '1', 'members'] })
  })

  it('ignores a project frame without a project id', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    dispatchRealtimeFrame({ type: 'message.created', scope: 'project', payload: {} })
    expect(spy).not.toHaveBeenCalled()
  })
})
