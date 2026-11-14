import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { renderWorkspace } from '@/test/renderWorkspace'
import GithubPage from './GithubPage'

afterEach(cleanup)

it('shows suspended installations and available repositories read-only to non-owners', async () => {
  renderWorkspace(
    <GithubPage />,
    '/app/integrations/github?teamId=t1',
    '/app/integrations/github',
    (client) => {
      client.setQueryData(['teams', 't1'], { id: 't1', name: '砺行科技', role: 'TEAM_MEMBER' })
      client.setQueryData(
        ['github', 't1', 'connections'],
        [
          {
            id: 'i1',
            teamId: 't1',
            providerInstallationId: 1,
            accountLogin: 'demo-org',
            accountType: 'Organization',
            suspended: true,
          },
        ],
      )
      client.setQueryData(
        ['github', 't1', 'repositories'],
        [
          {
            installationId: 'i1',
            repositoryId: 10001,
            fullName: 'demo-org/qgents-web',
            defaultBranch: 'main',
            htmlUrl: 'https://github.com/demo-org/qgents-web',
            privateRepository: true,
          },
        ],
      )
    },
  )

  expect(await screen.findByText('demo-org')).toBeInTheDocument()
  expect(screen.getByText('已暂停')).toBeInTheDocument()
  expect(screen.getByText('demo-org/qgents-web')).toBeInTheDocument()
  expect(screen.getByText('私有')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /连接 GitHub App/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '刷新授权' })).not.toBeInTheDocument()
})

it('offers the owner a reconnect action once a connection exists', async () => {
  renderWorkspace(
    <GithubPage />,
    '/app/integrations/github?teamId=t1',
    '/app/integrations/github',
    (client) => {
      client.setQueryData(['teams', 't1'], { id: 't1', name: '砺行科技', role: 'TEAM_OWNER' })
      client.setQueryData(
        ['github', 't1', 'connections'],
        [
          {
            id: 'i1',
            teamId: 't1',
            providerInstallationId: 1,
            accountLogin: 'demo-org',
            accountType: 'User',
            suspended: false,
          },
        ],
      )
      client.setQueryData(['github', 't1', 'repositories'], [])
    },
  )

  expect(await screen.findByRole('button', { name: '重新连接' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '刷新授权' })).toBeInTheDocument()
  expect(screen.getByText('已连接')).toBeInTheDocument()
  expect(screen.getByText('没有可访问的仓库')).toBeInTheDocument()
})
