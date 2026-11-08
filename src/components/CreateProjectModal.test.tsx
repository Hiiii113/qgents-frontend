import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { renderWorkspace } from '@/test/renderWorkspace'
import { CreateProjectModal } from './CreateProjectModal'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'self' } }) }))
afterEach(cleanup)

it('excludes the creator from project invitations', async () => {
  renderWorkspace(<CreateProjectModal teamId="t1" open onClose={vi.fn()} />, '/app/teams/t1', '/app/teams/:teamId', client => {
    client.setQueryData(['teams', 't1', 'members'], [
      { userId: 'self', displayName: '我自己' },
      { userId: 'other', displayName: '团队伙伴' },
      { userId: 'owner', displayName: '团队所有者', role: 'TEAM_OWNER' },
    ])
  })
  fireEvent.mouseDown(screen.getByRole('combobox'))
  expect(await screen.findByText('团队伙伴')).toBeInTheDocument()
  expect(screen.queryByText('我自己')).not.toBeInTheDocument()
  expect(screen.queryByText('团队所有者')).not.toBeInTheDocument()
})
