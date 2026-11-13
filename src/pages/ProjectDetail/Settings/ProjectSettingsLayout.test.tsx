import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Route, Routes, useLocation } from 'react-router-dom'
import { renderWorkspace } from '@/test/renderWorkspace'
import { SettingsPage } from './SettingsPage'
import { ProjectSettingsLayout } from './ProjectSettingsLayout'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
afterEach(cleanup)

function Address() {
  const location = useLocation()
  return <output>{location.pathname + location.search}</output>
}

function openSettings(path: string) {
  return renderWorkspace(
    <Routes>
      <Route element={<ProjectSettingsLayout />}>
        <Route
          path="settings"
          element={
            <>
              <SettingsPage />
              <Address />
            </>
          }
        />
      </Route>
    </Routes>,
    path,
    '/app/projects/:projectId/*',
    (client) => {
      client.setQueryData(['projects', 'p1'], {
        id: 'p1',
        teamId: 't1',
        name: '项目',
        role: 'PROJECT_ADMIN',
      })
      client.setQueryData(
        ['projects', 'p1', 'members'],
        [{ userId: 'u1', displayName: '创建者', role: 'PROJECT_ADMIN' }],
      )
      client.setQueryData(['teams', 't1', 'members'], [])
    },
  )
}

it('keeps only project information and members under settings', () => {
  openSettings('/app/projects/p1/settings?groupId=g2')
  expect(screen.getByRole('heading', { name: '项目设置' })).toBeInTheDocument()
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['基本信息', '成员管理'])
  for (const label of ['Agent', 'Skill', '项目记忆', '仓库']) {
    expect(screen.queryByRole('tab', { name: label })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
  }
})

it('switches between the two settings tabs and preserves the chat group', async () => {
  openSettings('/app/projects/p1/settings?groupId=g2')
  fireEvent.click(screen.getByRole('tab', { name: '成员管理' }))
  expect(await screen.findByText('创建者')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: '成员管理' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByText('/app/projects/p1/settings?groupId=g2&tab=members')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('tab', { name: '基本信息' }))
  expect(await screen.findByRole('button', { name: '保存资料' })).toBeInTheDocument()
  expect(screen.getByText('/app/projects/p1/settings?groupId=g2&tab=basic')).toBeInTheDocument()
})
