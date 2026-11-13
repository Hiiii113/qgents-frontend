import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { teamApi } from '@/api/team'
import { useAppUiStore } from '@/store/appUiStore'
import { renderWorkspace } from '@/test/renderWorkspace'
import { TeamSelector } from './TeamSelector'

const teams = [
  { id: 't1', name: '团队一' },
  { id: 't2', name: '团队二', avatarUrl: 'https://example.test/team.png' },
]

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useAppUiStore.getState().clearContext()
})

function renderSelector(
  seed?: (client: Parameters<Parameters<typeof renderWorkspace>[3]>[0]) => void,
) {
  return renderWorkspace(
    <Routes>
      <Route index element={<TeamSelector />} />
      <Route path="teams/:teamId" element={<div>团队项目首页</div>} />
      <Route path="teams/create" element={<div>创建团队页</div>} />
      <Route path="teams/join" element={<div>加入团队页</div>} />
    </Routes>,
    '/app',
    '/app/*',
    seed ?? ((client) => client.setQueryData(['teams', 'mine'], teams)),
  )
}

it('shows the current team before the menu is opened and marks it as selected', async () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  renderSelector()
  const trigger = screen.getByRole('button', { name: '当前团队 团队一，切换团队' })
  expect(trigger).toBeInTheDocument()

  fireEvent.click(trigger)
  const current = await screen.findByRole('menuitem', { name: /团队一/ })
  expect(current).toHaveTextContent('当前')
  expect(current.querySelector('.team-selector__current')).toBeInTheDocument()
  expect(current.querySelector('[aria-current="true"]')).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: /团队二/ })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: /创建团队/ })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: /加入团队/ })).toBeInTheDocument()
})

it('saves the selected team before opening that team projects', async () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  const save = vi.spyOn(authApi, 'selectTeam').mockResolvedValue(undefined)
  renderSelector()
  fireEvent.click(screen.getByRole('button', { name: /当前团队 团队一/ }))
  fireEvent.click(await screen.findByRole('menuitem', { name: /团队二/ }))
  expect(await screen.findByText('团队项目首页')).toBeInTheDocument()
  expect(save).toHaveBeenCalledWith('t2')
  expect(useAppUiStore.getState().currentTeamId).toBe('t2')
})

it('keeps the current team when saving a switch fails', async () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  vi.spyOn(authApi, 'selectTeam').mockRejectedValue(new Error('暂无团队访问权限'))
  renderSelector()
  fireEvent.click(screen.getByRole('button', { name: /当前团队 团队一/ }))
  fireEvent.click(await screen.findByRole('menuitem', { name: /团队二/ }))
  expect(await screen.findByText('暂无团队访问权限')).toBeInTheDocument()
  expect(useAppUiStore.getState().currentTeamId).toBe('t1')
})

it('offers create and join team entry points in the team menu', async () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  renderSelector()
  fireEvent.click(screen.getByRole('button', { name: /当前团队 团队一/ }))
  fireEvent.click(await screen.findByRole('menuitem', { name: /创建团队/ }))
  expect(await screen.findByText('创建团队页')).toBeInTheDocument()

  cleanup()
  renderSelector()
  fireEvent.click(screen.getByRole('button', { name: /当前团队 团队一/ }))
  fireEvent.click(await screen.findByRole('menuitem', { name: /加入团队/ }))
  expect(await screen.findByText('加入团队页')).toBeInTheDocument()
})

it('lets the user retry after the team list fails to load', async () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  vi.spyOn(teamApi, 'listMine')
    .mockRejectedValueOnce(new Error('网络错误'))
    .mockResolvedValue(teams)
  renderSelector(() => {})
  fireEvent.click(await screen.findByRole('button', { name: /切换团队/ }))
  fireEvent.click(await screen.findByRole('menuitem', { name: /团队加载失败，点击重试/ }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '当前团队 团队一，切换团队' })).toBeInTheDocument(),
  )
  expect(teamApi.listMine).toHaveBeenCalledTimes(2)
})
