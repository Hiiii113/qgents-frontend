import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useLocation } from 'react-router-dom'
import { renderWorkspace } from '@/test/renderWorkspace'
import { SettingsPage } from './SettingsPage'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
afterEach(cleanup)

function CurrentAddress() {
  const location = useLocation()
  return <output>{location.pathname + location.search}</output>
}

it('opens project members inside settings and keeps the selected tab in the URL', async () => {
  renderWorkspace(<><SettingsPage /><CurrentAddress /></>, '/app/projects/p1/settings?tab=members', '/app/projects/:projectId/settings', client => {
    client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1', name: '项目', role: 'PROJECT_ADMIN' })
    client.setQueryData(['projects', 'p1', 'members'], [{ userId: 'u1', displayName: '项目创建者', role: 'PROJECT_ADMIN' }])
    client.setQueryData(['teams', 't1', 'members'], [])
  })
  expect(await screen.findByText('项目创建者')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: '成员管理' })).toHaveAttribute('aria-selected', 'true')
  fireEvent.click(screen.getByRole('tab', { name: '基本信息' }))
  expect(await screen.findByRole('button', { name: '保存资料' })).toBeInTheDocument()
  expect(screen.getByText('/app/projects/p1/settings?tab=basic')).toBeInTheDocument()
})
