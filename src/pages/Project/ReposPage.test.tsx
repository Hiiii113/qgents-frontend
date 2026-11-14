import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { repositoriesApi } from '@/api/repositories'
import { renderWorkspace } from '@/test/renderWorkspace'
import ReposPage from './ReposPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('replaces the repository list with a blocking panel when GitHub is disconnected', async () => {
  vi.spyOn(repositoriesApi, 'connections').mockResolvedValue([])
  vi.spyOn(repositoriesApi, 'imported').mockResolvedValue([
    {
      id: 'r1',
      projectId: 'p1',
      installationId: 'i1',
      providerRepositoryId: 11,
      fullName: 'qg/web',
      defaultBranch: 'main',
      htmlUrl: 'https://github.com/qg/web',
      privateRepository: false,
    },
  ])
  renderWorkspace(
    <ReposPage />,
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

  expect(await screen.findByText('这个项目的仓库暂时无法访问')).toBeInTheDocument()
  expect(screen.queryByText('qg/web')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /导入仓库/ })).not.toBeInTheDocument()
})
