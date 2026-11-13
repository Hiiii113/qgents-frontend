import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLocation } from 'react-router-dom'
import { renderWorkspace } from '@/test/renderWorkspace'
import { notificationApi } from '@/api'
import { NotificationCenter } from './NotificationCenter'
import { notificationTargetPath } from './notificationTargetPath'
import type { Notification } from '@/types'

// 铃铛挂在实时通道上；这里只验证列表与点击行为，不起 SSE 连接。
vi.mock('@/realtime/useNotificationEvents', () => ({ useNotificationEvents: () => undefined }))
// 标记已读不退化为网络请求，只断言调用参数；缓存更新由组件自己完成。
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return {
    ...actual,
    notificationApi: {
      ...actual.notificationApi,
      markRead: vi.fn(() => Promise.resolve()),
      markAllRead: vi.fn(() => Promise.resolve()),
    },
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const notification: Notification = {
  id: 'n1',
  kind: 'MESSAGE_MENTION',
  projectId: 'p1',
  groupId: 'g1',
  resourceId: 'm1',
  title: '提及你',
  isRead: false,
  createdAt: '2026-10-01T00:00:00Z',
}

function Address() {
  const location = useLocation()
  return <output>{`${location.pathname}${location.search}`}</output>
}

async function openPanel(items: Notification[]) {
  const user = userEvent.setup()
  renderWorkspace(
    <>
      <NotificationCenter />
      <Address />
    </>,
    '/app',
    '/app/*',
    (client) => client.setQueryData(['notifications'], items),
  )
  await user.click(screen.getByRole('button', { name: '通知' }))
  await screen.findByText('通知中心')
  return user
}

describe('notification routing', () => {
  it('opens the project chat and locates a mentioned message', () =>
    expect(notificationTargetPath(notification)).toBe(
      '/app/projects/p1/chat?messageId=m1&groupId=g1',
    ))
  it('opens invitations and safely handles missing project context', () => {
    expect(notificationTargetPath({ ...notification, kind: 'INVITED' })).toBe('/app/teams/join')
    expect(notificationTargetPath({ ...notification, projectId: undefined })).toBeNull()
  })
})

describe('notification list', () => {
  it('opens an anchored panel, not a page drawer', async () => {
    await openPanel([notification])
    expect(document.querySelector('.ant-drawer')).not.toBeInTheDocument()
    expect(document.querySelector('.qg-notice-panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /全部已读/ })).toBeEnabled()
  })

  it('每条通知是一个可按 Enter 触发的按钮，点了标已读并跳到被提及的消息', async () => {
    const user = await openPanel([notification])
    const item = screen.getByRole('button', { name: /提及你/ })
    expect(item).toHaveAttribute('type', 'button')

    item.focus()
    await user.keyboard('{Enter}')

    expect(vi.mocked(notificationApi.markRead)).toHaveBeenCalledWith('n1')
    expect(screen.getByText('/app/projects/p1/chat?messageId=m1&groupId=g1')).toBeInTheDocument()
  })

  it('已读通知不再重复标已读，邀请通知跳到加入团队页', async () => {
    const user = await openPanel([
      {
        ...notification,
        id: 'n2',
        kind: 'INVITED',
        title: '邀请你加入团队',
        isRead: true,
        projectId: undefined,
      },
    ])
    await user.click(screen.getByRole('button', { name: /邀请你加入团队/ }))

    expect(notificationApi.markRead).not.toHaveBeenCalled()
    expect(screen.getByText('/app/teams/join')).toBeInTheDocument()
  })

  it('shows the empty state without the 全部已读 action', async () => {
    await openPanel([])
    expect(screen.getByText('暂无通知')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /全部已读/ })).not.toBeInTheDocument()
  })
})
