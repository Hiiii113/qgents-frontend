import { useEffect } from 'react'
import { subscribeRealtime } from './realtimeClient'

/**
 * 挂载全局 WebSocket 实时通道（单连接 + 用户级聚合流）。
 * AppShell 挂载一次即可；所有业务实时事件都从这条连接来，无 SSE 降级。
 */
export function useRealtimeEvents(): void {
  useEffect(() => subscribeRealtime(), [])
}
