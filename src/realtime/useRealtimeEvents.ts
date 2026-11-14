import { useEffect } from 'react'
import { subscribeRealtime } from './realtimeClient'

/**
 * 挂载全局 WebSocket 实时通道（单连接 + 用户级聚合流）。
 * AppShell 挂载一次即可；断线时由 SSE 接管。
 */
export function useRealtimeEvents(): void {
  useEffect(() => subscribeRealtime(), [])
}
