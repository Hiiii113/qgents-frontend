import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const importedRepository = {
  id: 'r1',
  projectId: 'p1',
  installationId: 'i1',
  providerRepositoryId: 11,
  fullName: 'qg/web',
  defaultBranch: 'main',
  htmlUrl: 'https://github.com/qg/web',
  privateRepository: false,
}

function renderCodePage(path: string) {
  vi.spyOn(repositoriesApi, 'connections').mockResolvedValue([
    {
      id: 'i1',
      teamId: 't1',
      providerInstallationId: 12,
      accountLogin: 'qg',
      accountType: 'Organization',
      suspended: false,
    },
  ])
  vi.spyOn(repositoriesApi, 'imported').mockResolvedValue([importedRepository])
  return renderWorkspace(
    <ReposPage />,
    path,
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
}

it('shows merged pull requests with their repository and opens GitHub', async () => {
  vi.spyOn(repositoriesApi, 'pullRequests').mockResolvedValue([
    {
      repository: 'qg/web',
      number: 12,
      title: '加只读 PR 页签',
      state: 'closed',
      merged: true,
      author: 'dev',
      htmlUrl: 'https://github.com/qg/web/pull/12',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ])
  renderCodePage('/app/projects/p1/code?tab=pulls')

  expect(await screen.findByText('加只读 PR 页签')).toBeInTheDocument()
  expect(screen.getByText('已合并')).toBeInTheDocument()
  expect(screen.getByText('qg/web', { selector: '.table__cell' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /加只读 PR 页签/ })).toHaveAttribute(
    'href',
    'https://github.com/qg/web/pull/12',
  )
})

it('refetches pull requests when status and repository filters change', async () => {
  const pullRequests = vi.spyOn(repositoriesApi, 'pullRequests').mockResolvedValue([])
  const user = userEvent.setup()
  renderCodePage('/app/projects/p1/code?tab=pulls')

  await waitFor(() =>
    expect(pullRequests.mock.calls.at(-1)?.[1]).toEqual({
      state: 'open',
      repositoryId: undefined,
    }),
  )
  await user.click(screen.getByLabelText('状态'))
  await user.click(screen.getByRole('option', { name: '全部' }))
  await waitFor(() =>
    expect(pullRequests.mock.calls.at(-1)?.[1]).toEqual({
      state: 'all',
      repositoryId: undefined,
    }),
  )
  await user.click(screen.getByLabelText('仓库'))
  await user.click(screen.getByRole('option', { name: 'qg/web' }))
  await waitFor(() =>
    expect(pullRequests.mock.calls.at(-1)?.[1]).toEqual({
      state: 'all',
      repositoryId: 11,
    }),
  )
})
