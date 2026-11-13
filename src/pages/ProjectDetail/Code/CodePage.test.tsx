import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { repositoriesApi } from '@/api/repositories'
import { renderWorkspace } from '@/test/renderWorkspace'
import { CodePage } from './CodePage'
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
function show(role: string) {
  renderWorkspace(
    <CodePage />,
    '/app/projects/p1/code',
    '/app/projects/:projectId/code',
    (client) => {
      client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1', name: '项目', role })
      client.setQueryData(['repositories', 'p1'], [])
    },
  )
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

  it('lists a few available repositories as searchable checkboxes and imports the checked ones', async () => {
    const available = vi.spyOn(repositoriesApi, 'available').mockResolvedValue([
      {
        installationId: 'i1',
        repositoryId: 11,
        fullName: 'qg/web',
        defaultBranch: 'main',
        htmlUrl: '#',
        privateRepository: false,
      },
      {
        installationId: 'i1',
        repositoryId: 12,
        fullName: 'qg/api',
        defaultBranch: 'main',
        htmlUrl: '#',
        privateRepository: true,
      },
    ])
    const imported = vi.spyOn(repositoriesApi, 'import').mockResolvedValue({
      id: 'r1',
      projectId: 'p1',
      installationId: 'i1',
      providerRepositoryId: 11,
      fullName: 'qg/web',
      defaultBranch: 'main',
      htmlUrl: '#',
      privateRepository: false,
    })
    show('PROJECT_ADMIN')
    fireEvent.click(screen.getByRole('button', { name: /导入仓库/ }))

    expect(await screen.findByRole('checkbox', { name: 'qg/web' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'qg/api' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '搜索可导入仓库' }), {
      target: { value: 'web' },
    })
    expect(screen.queryByRole('checkbox', { name: 'qg/api' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'qg/web' }))
    fireEvent.click(screen.getByRole('button', { name: '导入所选仓库' }))
    await waitFor(() =>
      expect(imported).toHaveBeenCalledWith('p1', { installationId: 'i1', repositoryId: 11 }),
    )
    expect(available).toHaveBeenCalledWith('t1')
  })

  it('keeps the failure alert instead of claiming there are no repositories', async () => {
    vi.spyOn(repositoriesApi, 'imported').mockRejectedValue(new Error('仓库加载失败'))
    renderWorkspace(
      <CodePage />,
      '/app/projects/p1/code',
      '/app/projects/:projectId/code',
      (client) => {
        client.setQueryData(['projects', 'p1'], {
          id: 'p1',
          teamId: 't1',
          name: '项目',
          role: 'PROJECT_ADMIN',
        })
      },
    )
    expect(await screen.findByText('仓库加载失败')).toBeInTheDocument()
    expect(screen.queryByText('还没有导入仓库。')).not.toBeInTheDocument()
  })

  it('shows a no-match result when the imported repository search finds nothing', async () => {
    vi.spyOn(repositoriesApi, 'imported').mockResolvedValue([
      {
        id: 'r1',
        projectId: 'p1',
        installationId: 'i1',
        providerRepositoryId: 11,
        fullName: 'qg/web',
        defaultBranch: 'main',
        htmlUrl: '#',
        privateRepository: false,
      },
    ])
    renderWorkspace(
      <CodePage />,
      '/app/projects/p1/code',
      '/app/projects/:projectId/code',
      (client) => {
        client.setQueryData(['projects', 'p1'], {
          id: 'p1',
          teamId: 't1',
          name: '项目',
          role: 'PROJECT_ADMIN',
        })
      },
    )
    expect(await screen.findByText('qg/web')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '搜索仓库' }), {
      target: { value: 'api' },
    })
    expect(screen.getByText('没有匹配的仓库。')).toBeInTheDocument()
    expect(screen.queryByText('还没有导入仓库。')).not.toBeInTheDocument()
  })
})
