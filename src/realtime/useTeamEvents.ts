import { useEventStream } from './useEventStream'
import { queryClient } from '@/query'
import { useRealtimeConnectionStatus } from './realtimeClient'

/**
 * 团队级 SSE（GET /teams/{teamId}/events）—— 团队成员可订阅。
 *
 * 收到事件后 invalidate 对应团队缓存：
 * - project.member.added → 团队项目列表（被拉进项目实时可见）
 * - team.member.updated → 团队成员列表
 */
export function useTeamEvents(teamId: string | undefined): void {
  const realtimeStatus = useRealtimeConnectionStatus()
  const useSseFallback = Boolean(teamId) && realtimeStatus !== 'connected'
  useEventStream(
    useSseFallback ? `team.${teamId}` : '',
    useSseFallback ? `/teams/${encodeURIComponent(teamId ?? '')}/events` : '',
    (eventType) => {
      if (!teamId) return
      if (eventType === 'project.member.added') {
        void queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'projects'] })
      } else if (eventType === 'team.member.updated') {
        void queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'members'] })
      }
    },
  )
}
