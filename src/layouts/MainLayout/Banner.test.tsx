import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppUiStore } from '@/store/appUiStore'
import { renderWorkspace } from '@/test/renderWorkspace'
import { Banner } from './Banner'

vi.mock('./PersonalCenter', () => ({ PersonalCenter: () => <button>个人中心</button> }))
vi.mock('./NotificationCenter', () => ({ NotificationCenter: () => <button>通知</button> }))

afterEach(() => {
  cleanup()
  useAppUiStore.getState().clearContext()
})

it('shows the current team selector and project entry in the global banner', () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  renderWorkspace(<Banner />, '/app/projects/p1/chat', '/app/*', (client) =>
    client.setQueryData(['teams', 'mine'], [{ id: 't1', name: '团队一' }]),
  )
  expect(screen.getByRole('link', { name: 'Qgents 项目首页' })).toHaveAttribute(
    'href',
    '/app/teams/t1',
  )
  expect(screen.getByRole('link', { name: '项目' })).toHaveAttribute('href', '/app/teams/t1')
  expect(screen.getByRole('button', { name: '当前团队 团队一，切换团队' })).toBeInTheDocument()
})
