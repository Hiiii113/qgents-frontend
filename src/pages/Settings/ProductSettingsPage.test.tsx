import type { QueryClient } from '@tanstack/react-query'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useLocation } from 'react-router-dom'
import { renderWorkspace } from '@/test/renderWorkspace'
import { useAppUiStore } from '@/store/appUiStore'
import ProductSettingsPage from './ProductSettingsPage'

const { selectTeam, updateMe, listMine, logout, user } = vi.hoisted(() => ({
  selectTeam: vi.fn(),
  updateMe: vi.fn(),
  listMine: vi.fn(),
  logout: vi.fn(),
  user: { id: 'u1', email: 'hele@example.test', displayName: '何乐' },
}))

vi.mock('@/api', () => ({
  authApi: { selectTeam, updateMe },
  teamApi: { listMine },
  uploadAvatar: vi.fn(),
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user, updateUser: vi.fn(), logout }),
}))

const TEAMS = [
  { id: 't1', name: '砺行科技' },
  { id: 't2', name: '澄海实验室' },
]

/** 把当前地址渲染出来，验证切换成功才离开本页。 */
function Address() {
  const location = useLocation()
  return <output>{`${location.pathname}${location.search}`}</output>
}

function open(seed: (client: QueryClient) => void = () => {}) {
  return renderWorkspace(
    <>
      <ProductSettingsPage />
      <Address />
    </>,
    '/app/settings?tab=teams',
    '*',
    seed,
  )
}

beforeEach(() => {
  useAppUiStore.getState().setCurrentTeam('t1')
  listMine.mockReturnValue(new Promise(() => {}))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useAppUiStore.getState().setCurrentTeam(null)
})

it('stays on the page when switching teams fails', async () => {
  selectTeam.mockRejectedValueOnce(new Error('暂无团队访问权限'))
  open((client) => client.setQueryData(['teams', 'mine'], TEAMS))

  fireEvent.click(await screen.findByRole('button', { name: '切换到澄海实验室' }))

  await waitFor(() => expect(selectTeam).toHaveBeenCalledWith('t2'))
  expect(screen.getByText('/app/settings?tab=teams')).toBeInTheDocument()
  expect(useAppUiStore.getState().currentTeamId).toBe('t1')
})

it('switches the current team only after the server accepts', async () => {
  selectTeam.mockResolvedValueOnce(undefined)
  open((client) => client.setQueryData(['teams', 'mine'], TEAMS))

  fireEvent.click(await screen.findByRole('button', { name: '切换到澄海实验室' }))

  await waitFor(() => expect(screen.getByText('/app/teams/t2')).toBeInTheDocument())
  expect(useAppUiStore.getState().currentTeamId).toBe('t2')
})
