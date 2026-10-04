import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderWorkspace } from '@/test/renderWorkspace'
import { chatKeys } from '@/components/chat/useChatMessages'
import ProjectDetailLayout from './ProjectDetailLayout'
afterEach(cleanup)
describe('project navigation', () => {
  it('selects the requested group and keeps project capabilities in a menu', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /项目工具/ }))
    expect(await screen.findByRole('menuitem', { name: /项目仓库/ })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '搜索群聊' }), {
      target: { value: '产品' },
    })
    expect(screen.queryByRole('link', { name: '默认聊天' })).not.toBeInTheDocument()
  })
})
