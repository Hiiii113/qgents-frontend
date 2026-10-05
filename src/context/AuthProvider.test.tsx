import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { authApi } from '@/api/auth'
import { useCurrentTeamId, useAppUiStore } from '@/store/appUiStore'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './AuthContext'

vi.mock('@/utils/rsaConfig', () => ({ RSA_KEY_ID: 'test', encryptPassword: async () => 'encrypted' }))
const me = { user: { id: 'u1', email: 'u@example.test', displayName: '小林' },
  teams: [{ id: 't1', name: '团队一' }, { id: 't2', name: '团队二' }], projects: [], currentTeamId: 't2' }

beforeEach(() => { localStorage.clear(); useAppUiStore.getState().clearContext() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function SessionView() {
  const auth = useAuth()
  const teamId = useCurrentTeamId()
  return <><output>{auth.isBootstrapping ? '加载' : `${auth.user?.displayName ?? '未登录'}:${teamId ?? '无团队'}`}</output>
    <button onClick={async () => auth.completeAuth(await auth.login('u@example.test', 'password'))}>登录</button>
    <button onClick={() => void auth.logout()}>退出</button></>
}
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><AuthProvider><SessionView /></AuthProvider></QueryClientProvider>)
  return client
}

it('restores the backend selected team on a fresh browser session', async () => {
  localStorage.setItem('qgents_access_token', 'test-token')
  vi.spyOn(authApi, 'me').mockResolvedValue(me)
  const client = setup()
  expect(await screen.findByText('小林:t2')).toBeInTheDocument()
  expect(client.getQueryData(['teams', 'mine'])).toEqual(me.teams)
})

it('uses the backend resolved team immediately after login', async () => {
  vi.spyOn(authApi, 'login').mockResolvedValue({ user: me.user, accessToken: 'access', refreshToken: 'refresh',
    accessTokenExpiresIn: 900, refreshTokenExpiresIn: 3600 })
  vi.spyOn(authApi, 'me').mockResolvedValue(me)
  setup()
  fireEvent.click(screen.getByRole('button', { name: '登录' }))
  expect(await screen.findByText('小林:t2')).toBeInTheDocument()
})

it('clears team context and cached data when logging out', async () => {
  localStorage.setItem('qgents_access_token', 'test-token')
  vi.spyOn(authApi, 'me').mockResolvedValue(me)
  vi.spyOn(authApi, 'logout').mockResolvedValue(undefined)
  const client = setup()
  await screen.findByText('小林:t2')
  fireEvent.click(screen.getByRole('button', { name: '退出' }))
  await waitFor(() => expect(screen.getByText('未登录:无团队')).toBeInTheDocument())
  expect(client.getQueryData(['teams', 'mine'])).toBeUndefined()
})
