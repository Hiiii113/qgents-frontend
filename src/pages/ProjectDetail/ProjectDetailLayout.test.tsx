import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLocation } from 'react-router-dom'
import { renderWorkspace } from '@/test/renderWorkspace'
import { chatApi } from '@/api/chat'
import { chatKeys } from '@/query/chatKeys'
import ProjectDetailLayout from './ProjectDetailLayout'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Address() {
  const location = useLocation()
  return <output>{location.pathname + location.search}</output>
}

const groups = [
  { id: 'g1', projectId: 'p1', title: '默认聊天', defaultGroup: true },
  { id: 'g2', projectId: 'p1', title: '产品讨论', defaultGroup: false },
]

function seed(client: Parameters<Parameters<typeof renderWorkspace>[3]>[0]) {
  client.setQueryData(['projects', 'p1'], {
    id: 'p1',
    teamId: 't1',
    name: '项目甲',
    role: 'PROJECT_ADMIN',
  })
  client.setQueryData(chatKeys.groups('p1'), groups)
}

describe('project navigation', () => {
  it('shows the primary sections and keeps the selected group and message in every link', () => {
    renderWorkspace(
      <>
        <ProjectDetailLayout />
        <Address />
      </>,
      '/app/projects/p1/chat?groupId=g2&messageId=m9',
      '/app/projects/:projectId/*',
      seed,
    )

    const nav = screen.getByRole('navigation', { name: '项目导航' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '聊天' })).toHaveAttribute(
      'href',
      '/app/projects/p1/chat?groupId=g2&messageId=m9',
    )
    expect(screen.getByRole('link', { name: 'Agent' })).toHaveAttribute(
      'href',
      '/app/projects/p1/agents?groupId=g2&messageId=m9',
    )
    expect(screen.getByRole('link', { name: '项目记忆' })).toHaveAttribute(
      'href',
      '/app/projects/p1/memory?groupId=g2&messageId=m9',
    )
    expect(screen.getByRole('link', { name: 'Skill' })).toHaveAttribute(
      'href',
      '/app/projects/p1/skills?groupId=g2&messageId=m9',
    )
    expect(screen.getByRole('link', { name: '仓库' })).toHaveAttribute(
      'href',
      '/app/projects/p1/code?groupId=g2&messageId=m9',
    )
    expect(screen.getByRole('link', { name: '项目设置' })).toHaveAttribute(
      'href',
      '/app/projects/p1/settings?groupId=g2&messageId=m9',
    )
    // 项目身份只在牌头带的选择器里，第二行只有功能导航
    const header = document.querySelector('.project-header') as HTMLElement
    expect(header).not.toHaveTextContent('项目甲')
    expect(screen.queryByRole('link', { name: '返回团队项目' })).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: '产品讨论' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '产品讨论' }).closest('.project-group')).toHaveClass(
      'is-active',
    )
    expect(screen.getByRole('link', { name: '默认聊天' })).toHaveAttribute(
      'href',
      '/app/projects/p1/chat?groupId=g1',
    )
    expect(screen.getByRole('link', { name: '聊天' })).toHaveClass('active')
    expect(screen.queryByRole('link', { name: /返回聊天/ })).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: '搜索群聊' }), {
      target: { value: '产品' },
    })
    expect(screen.queryByRole('link', { name: '默认聊天' })).not.toBeInTheDocument()
  })

  it('does not render or load the group list on management pages', () => {
    renderWorkspace(
      <>
        <ProjectDetailLayout />
        <Address />
      </>,
      '/app/projects/p1/agents?groupId=g2',
      '/app/projects/:projectId/*',
      (client) => {
        client.setQueryData(['projects', 'p1'], {
          id: 'p1',
          teamId: 't1',
          name: '项目',
          role: 'PROJECT_ADMIN',
        })
        client.setQueryData(chatKeys.groups('p1'), groups)
      },
    )
    expect(screen.getByRole('navigation', { name: '项目导航' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: '群聊列表' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '搜索群聊' })).not.toBeInTheDocument()
    // 非聊天页不显示群名，即使 URL 还带着 groupId
    expect(screen.queryByText(/默认聊天|产品讨论/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '聊天' })).toHaveAttribute(
      'href',
      '/app/projects/p1/chat?groupId=g2',
    )
  })

  it('opens the narrow-screen drawer, navigates by keyboard and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    renderWorkspace(
      <>
        <ProjectDetailLayout />
        <Address />
      </>,
      '/app/projects/p1/chat?groupId=g2&messageId=m9',
      '/app/projects/:projectId/*',
      seed,
    )

    const trigger = screen.getByRole('button', { name: '打开项目导航' })
    await user.click(trigger)
    const menu = await screen.findByRole('navigation', { name: '项目菜单' })
    expect(menu).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: '项目记忆' }).length).toBeGreaterThan(0)

    const link = screen
      .getAllByRole('link', { name: '项目记忆' })
      .find((item) => menu.contains(item))
    expect(link).toBeDefined()
    link!.focus()
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(
        screen.getByText('/app/projects/p1/memory?groupId=g2&messageId=m9'),
      ).toBeInTheDocument(),
    )
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})

describe('group board', () => {
  const now = Date.now()

  it('orders groups by recent activity, not by name', () => {
    renderWorkspace(
      <ProjectDetailLayout />,
      '/app/projects/p1/chat?groupId=g1',
      '/app/projects/:projectId/*',
      (client) => {
        client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1', name: '项目' })
        client.setQueryData(chatKeys.groups('p1'), [
          {
            id: 'g1',
            projectId: 'p1',
            title: '瓦房',
            lastMessageAt: new Date(now - 6e5).toISOString(),
          },
          {
            id: 'g2',
            projectId: 'p1',
            title: '安卓',
            lastMessageAt: new Date(now - 6e6).toISOString(),
          },
        ])
      },
    )

    const links = screen.getAllByRole('link', { name: /瓦房|安卓/ })
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual(['瓦房', '安卓'])
  })

  it('keeps a group lit as changed until it is opened', async () => {
    const { client } = renderWorkspace(
      <ProjectDetailLayout />,
      '/app/projects/p1/chat?groupId=g1',
      '/app/projects/:projectId/*',
      (seedClient) => {
        seedClient.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1', name: '项目' })
        seedClient.setQueryData(chatKeys.groups('p1'), [
          {
            id: 'g1',
            projectId: 'p1',
            title: '瓦房',
            lastMessageAt: new Date(now - 6e6).toISOString(),
          },
          {
            id: 'g2',
            projectId: 'p1',
            title: '安卓',
            lastMessageAt: new Date(now - 9e6).toISOString(),
          },
        ])
      },
    )

    expect(screen.queryByText('更新')).not.toBeInTheDocument()

    // g2 有新动静：它自己升到上面并亮起来
    client.setQueryData(chatKeys.groups('p1'), [
      {
        id: 'g1',
        projectId: 'p1',
        title: '瓦房',
        lastMessageAt: new Date(now - 6e6).toISOString(),
      },
      {
        id: 'g2',
        projectId: 'p1',
        title: '安卓',
        lastMessageAt: new Date(now - 3e4).toISOString(),
      },
    ])

    const flag = await screen.findByText('更新')
    expect(flag).toBeInTheDocument()
    const g2 = screen.getByRole('link', { name: '安卓' })
    expect(g2.closest('.project-group')).toHaveClass('is-changed')
    expect(screen.getAllByRole('link', { name: /瓦房|安卓/ })[0]).toBe(g2)
  })

  it('toggles the pin from the list row without leaving the chat', async () => {
    const user = userEvent.setup()
    const pin = vi.spyOn(chatApi, 'pin').mockResolvedValue(undefined)
    // 置顶成功后列表会重新拉取，用同一份数据回答，避免测试依赖 Mock 服务。
    vi.spyOn(chatApi, 'groups').mockResolvedValue([
      { id: 'g1', projectId: 'p1', title: '瓦房', pinned: true },
      { id: 'g2', projectId: 'p1', title: '安卓' },
    ])
    renderWorkspace(
      <>
        <ProjectDetailLayout />
        <Address />
      </>,
      '/app/projects/p1/chat?groupId=g1',
      '/app/projects/:projectId/*',
      (client) => {
        client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1', name: '项目' })
        client.setQueryData(chatKeys.groups('p1'), [
          { id: 'g1', projectId: 'p1', title: '瓦房', pinned: true },
          { id: 'g2', projectId: 'p1', title: '安卓' },
        ])
      },
    )

    const pinned = screen.getByRole('button', { name: '取消置顶' })
    expect(pinned).toHaveAttribute('aria-pressed', 'true')
    const unpinned = screen.getByRole('button', { name: '置顶' })
    expect(unpinned).toHaveAttribute('aria-pressed', 'false')

    await user.click(unpinned)

    expect(pin).toHaveBeenCalledWith('p1', 'g2', true)
    // 只切换置顶，不跳转
    expect(screen.getByText('/app/projects/p1/chat?groupId=g1')).toBeInTheDocument()
  })
})
