import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Drawer, Badge, Button, Typography, Space } from 'antd'
import { BellOutlined, CheckOutlined, UserAddOutlined, MessageOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationApi } from '@/api'
import { useNotificationEvents } from '@/realtime/useNotificationEvents'
import { useRealtimeConnectionStatus } from '@/realtime/realtimeClient'
import './NotificationCenter.css'
import { notificationTargetPath } from './notificationTargetPath'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import type { Notification, NotificationKind } from '@/types'

const { Text } = Typography

/** 每种通知类型的图标与配色 */
const KIND_META: Record<NotificationKind, { icon: ReactNode; color: string }> = {
  INVITED: { icon: <UserAddOutlined />, color: 'var(--accent)' },
  TEAM_JOINED: { icon: <UserAddOutlined />, color: 'var(--accent)' },
  PROJECT_ADDED: { icon: <MessageOutlined />, color: 'var(--accent)' },
  MESSAGE_MENTION: { icon: <MessageOutlined />, color: 'var(--warning)' },
}

/** 后端可能下发未在枚举中的 kind，兜底展示，避免 meta 为 undefined 导致崩溃 */
const FALLBACK_META: { icon: ReactNode; color: string } = {
  icon: <BellOutlined />,
  color: 'var(--ink-300)',
}

/** 通知中心 —— 顶部铃铛 + 右侧抽屉
 * 通知列表与已读状态来自后端通知接口
 */
export function NotificationCenter() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const realtimeStatus = useRealtimeConnectionStatus()
  // WebSocket 连通时已覆盖通知事件；仅断开时保留 SSE 兜底，避免重复长连接占满 HTTP/1.1 槽位。
  useNotificationEvents(realtimeStatus !== 'connected')

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.list(),
  })
  const unreadCount = notifications.filter((n) => !n.isRead).length

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      const previous = queryClient.getQueryData<Notification[]>(['notifications'])
      queryClient.setQueryData<Notification[]>(['notifications'], (current = []) =>
        current.map((notification) =>
          notification.id === id ? { ...notification, isRead: true } : notification,
        ),
      )
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications'], context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
  const markAllRead = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      const previous = queryClient.getQueryData<Notification[]>(['notifications'])
      queryClient.setQueryData<Notification[]>(['notifications'], (current = []) =>
        current.map((notification) => ({ ...notification, isRead: true })),
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications'], context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  function handleItemClick(n: Notification) {
    if (!n.isRead) markRead.mutate(n.id)
    setOpen(false)
    const to = notificationTargetPath(n)
    if (!to) return
    if (n.kind === 'MESSAGE_MENTION') {
      // 带被 @ 的消息 id 跳转：ChatPanel 收到后自动滚动高亮到该消息（无 id 时兜底跳到最上面一条被 @ 消息）
      navigate(to, { state: { mentionMessageId: n.resourceId } })
    } else {
      navigate(to)
    }
  }

  return (
    <>
      <Badge count={unreadCount} size="small">
        <Button
          type="text"
          icon={<BellOutlined />}
          aria-label="通知"
          onClick={() => setOpen(true)}
        />
      </Badge>

      <Drawer
        title="通知中心"
        placement="right"
        size={380}
        open={open}
        onClose={() => setOpen(false)}
        extra={
          notifications.length > 0 && (
            <Button
              type="text"
              size="small"
              icon={<CheckOutlined />}
              disabled={unreadCount === 0}
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              全部已读
            </Button>
          )
        }
        styles={{ body: { padding: 0 } }}
      >
        {notifications.length === 0 ? (
          <div className="qg-notice-empty">
            <p className="qg-notice-empty__title">暂无通知</p>
            <p className="qg-notice-empty__hint">有人提到你、邀请你或项目有更新时会出现在这里。</p>
          </div>
        ) : (
          notifications.map((n) => {
            const meta = KIND_META[n.kind] ?? FALLBACK_META
            return (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`qg-notice${n.isRead ? '' : ' qg-notice--unread'}`}
              >
                <span className="qg-notice__icon" style={{ color: meta.color }}>
                  {meta.icon}
                </span>
                <div className="qg-notice__body">
                  <Space size={6} align="center">
                    {!n.isRead && <Badge status="processing" />}
                    <Text strong={!n.isRead}>{n.title}</Text>
                  </Space>
                  {n.description && <p className="qg-notice__description">{n.description}</p>}
                  <p className="qg-notice__time">{formatRelativeTime(n.createdAt)}</p>
                </div>
              </div>
            )
          })
        )}
      </Drawer>
    </>
  )
}
