import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderWorkspace } from '@/test/renderWorkspace'
import { CodePage } from './CodePage'
afterEach(cleanup)
function show(role: string) {
  renderWorkspace(<CodePage />, '/app/projects/p1/code', '/app/projects/:projectId/code', client => {
    client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1', name: '项目', role })
    client.setQueryData(['repositories', 'p1'], [])
  })
}
describe('project repositories', () => {
  it('offers explicit import to project admins and keeps work in chat', () => {
    show('PROJECT_ADMIN')
    expect(screen.getByRole('button', { name: /导入仓库/ })).toBeInTheDocument()
    expect(screen.queryByText('工作分支')).not.toBeInTheDocument()
    expect(screen.queryByText('质量门禁')).not.toBeInTheDocument()
  })
  it('keeps import controls hidden for project members', () => {
    show('PROJECT_MEMBER')
    expect(screen.queryByRole('button', { name: /导入仓库/ })).not.toBeInTheDocument()
  })
})
