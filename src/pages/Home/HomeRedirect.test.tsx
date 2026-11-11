import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useAppUiStore } from '@/store/appUiStore'
import { renderWorkspace } from '@/test/renderWorkspace'
import { HomeRedirect } from './HomeRedirect'

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ hasTeam: true, setHasTeam: vi.fn() }),
}))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useAppUiStore.getState().clearContext()
})
function renderHome(seed: Parameters<typeof renderWorkspace>[3] = () => {}) {
  renderWorkspace(
    <Routes>
      <Route index element={<HomeRedirect />} />
      <Route path="teams/:teamId" element={<div>当前团队项目</div>} />
    </Routes>,
    '/app',
    '/app/*',
    seed,
  )
}

it('enters the selected team without showing a team list or overwriting it with cached account data', async () => {
  useAppUiStore.getState().setCurrentTeam('t2')
  const me = vi.spyOn(authApi, 'me')
  renderHome((client) =>
    client.setQueryData(['me'], { currentTeamId: 't1', teams: [{ id: 't1' }] }),
  )
  expect(await screen.findByText('当前团队项目')).toBeInTheDocument()
  expect(useAppUiStore.getState().currentTeamId).toBe('t2')
  expect(me).not.toHaveBeenCalled()
})

it('resolves a missing selection through the backend and opens the available team', async () => {
  useAppUiStore.getState().clearContext()
  vi.spyOn(authApi, 'me').mockResolvedValue({
    user: { id: 'u1', email: 'u@example.test', displayName: '用户' },
    teams: [{ id: 't2', name: '团队二' }],
    projects: [],
    currentTeamId: 't2',
  })
  renderHome()
  expect(await screen.findByText('当前团队项目')).toBeInTheDocument()
  expect(useAppUiStore.getState().currentTeamId).toBe('t2')
})
