import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderWorkspace } from '@/test/renderWorkspace'
import { chatKeys } from '@/components/chat/useChatMessages'
import ProjectDetailLayout from './ProjectDetailLayout'
afterEach(cleanup)
describe('project navigation', () => {
  it('selects the requested group and opens project settings without a tools dropdown', () => {
    renderWorkspace(
      <ProjectDetailLayout />,
      '/app/projects/p1/chat?groupId=g2',
      '/app/projects/:projectId/*',
      (client) => {
        client.setQueryData(['projects', 'p1'], {
          id: 'p1',
          teamId: 't1',
          name: '项目',
          role: 'PROJECT_ADMIN',
        })
        client.setQueryData(chatKeys.groups('p1'), [
          { id: 'g1', projectId: 'p1', title: '默认聊天', defaultGroup: true },
          { id: 'g2', projectId: 'p1', title: '产品讨论', defaultGroup: false },
        ])
      },
    )
    expect(screen.getByRole('link', { name: '产品讨论' })).toHaveClass('is-active')
    expect(screen.getByRole('link', { name: '默认聊天' })).toHaveAttribute(
      'href',
      '/app/projects/p1/chat?groupId=g1',
    )
    expect(screen.queryByRole('link', { name: /仓库/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /返回项目列表/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /项目设置/ })).toHaveAttribute(
      'href',
      '/app/projects/p1/settings',
    )
    expect(screen.queryByRole('button', { name: /项目工具/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: '项目导航' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '搜索群聊' }), {
      target: { value: '产品' },
    })
    expect(screen.queryByRole('link', { name: '默认聊天' })).not.toBeInTheDocument()
  })
})
