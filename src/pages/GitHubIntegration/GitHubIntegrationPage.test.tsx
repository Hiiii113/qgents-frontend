import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderWorkspace } from '@/test/renderWorkspace'
import { GitHubIntegrationPage } from './GitHubIntegrationPage'
afterEach(cleanup)
describe('team GitHub connection', () => {
  it('uses suspension from current backend fields and grants control only to the owner', () => {
    renderWorkspace(<GitHubIntegrationPage />, '/app/integrations/github?teamId=t1', '/app/integrations/github', client => {
      client.setQueryData(['teams', 't1'], { id: 't1', role: 'TEAM_MEMBER' })
      client.setQueryData(['github', 't1', 'connections'], [{ id: 'i1', teamId: 't1', accountLogin: 'demo', accountType: 'Organization', suspended: true }])
    })
    expect(screen.getByText('demo')).toBeInTheDocument()
    expect(screen.getByText('已暂停')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /连接 GitHub App/ })).not.toBeInTheDocument()
  })
})
