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

it('shows the current team and project as context, without a team switcher', () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  renderWorkspace(<Banner />, '/app/projects/p1/chat', '/app/*', (client) => {
    client.setQueryData(['teams', 'mine'], [{ id: 't1', name: '团队一' }])
    client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1', name: '项目一' })
  })
  expect(screen.getByRole('link', { name: 'Qgents 项目首页' })).toHaveAttribute(
    'href',
    '/app/teams/t1',
  )
  expect(screen.getByRole('link', { name: '团队一' })).toHaveAttribute('href', '/app/teams/t1')
  expect(screen.getByText('项目一')).toBeInTheDocument()
  // 切换团队收进团队设置，顶栏不再提供入口
  expect(screen.queryByRole('button', { name: /切换团队/ })).not.toBeInTheDocument()
})
