import { lazy, Suspense } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { MainLayout } from './index'

vi.mock('./Banner', () => ({ Banner: () => <nav>团队导航</nav> }))
vi.mock('@/realtime/useRealtimeEvents', () => ({ useRealtimeEvents: () => undefined }))

afterEach(cleanup)

it('keeps navigation visible while a lazy page loads', () => {
  const PendingPage = lazy(() => new Promise<{ default: () => null }>(() => undefined))
  render(
    <MemoryRouter initialEntries={['/app/teams']}>
      <Suspense fallback={<div>全屏加载</div>}>
        <Routes>
          <Route path="/app" element={<MainLayout />}>
            <Route path="teams" element={<PendingPage />} />
          </Route>
        </Routes>
      </Suspense>
    </MemoryRouter>,
  )
  expect(screen.getByRole('navigation')).toHaveTextContent('团队导航')
  expect(screen.getByRole('status', { name: '加载中' })).toBeInTheDocument()
  expect(screen.queryByText('全屏加载')).not.toBeInTheDocument()
})
