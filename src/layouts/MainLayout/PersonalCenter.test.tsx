import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { authApi } from '@/api/auth'
import { teamApi } from '@/api/team'
import { useAppUiStore } from '@/store/appUiStore'
import { Route, Routes } from 'react-router-dom'
import { renderWorkspace } from '@/test/renderWorkspace'
import { PersonalCenter } from './PersonalCenter'

const { updateUser, logout, user } = vi.hoisted(() => ({
  updateUser: vi.fn(),
  logout: vi.fn(),
  user: { id: 'u1', displayName: '小林', email: 'lin@example.test' },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user, updateUser, logout }) }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  updateUser.mockReset()
  useAppUiStore.getState().clearContext()
})

function openMenu() {
  const view = renderWorkspace(<PersonalCenter />, '/app', '/app', (client) => {
    client.setQueryData(
      ['teams', 'mine'],
      [
        { id: 't1', name: '团队一' },
        { id: 't2', name: '团队二', avatarUrl: 'https://example.test/team.png' },
      ],
    )
  })
  fireEvent.click(screen.getByRole('button', { name: '打开个人中心' }))
  return view
}

it('opens a profile popover with inline avatar and nickname controls', async () => {
  openMenu()
  expect(await screen.findByRole('region', { name: '个人中心' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '更换个人头像' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '修改昵称' })).toBeInTheDocument()
  expect(document.querySelector('.ant-drawer')).toBeNull()
})

it('shows team avatars on hover and saves the selected team before navigating', async () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  vi.spyOn(teamApi, 'listMine').mockResolvedValue([
    { id: 't1', name: '团队一' },
    { id: 't2', name: '团队二', avatarUrl: 'https://example.test/team.png' },
  ])
  const save = vi.spyOn(authApi, 'selectTeam').mockResolvedValue(undefined)
  renderWorkspace(
    <Routes>
      <Route index element={<PersonalCenter />} />
      <Route path="teams/:teamId" element={<div>团队项目首页</div>} />
    </Routes>,
    '/app',
    '/app/*',
    () => {},
  )
  fireEvent.click(screen.getByRole('button', { name: '打开个人中心' }))
  fireEvent.mouseEnter(await screen.findByRole('button', { name: '切换团队' }))
  const team = await screen.findByRole('button', { name: '进入团队 团队二' })
  expect(team.querySelector('img')).toHaveAttribute('src', 'https://example.test/team.png')
  fireEvent.click(team)
  expect(await screen.findByText('团队项目首页')).toBeInTheDocument()
  expect(save).toHaveBeenCalledWith('t2')
  expect(useAppUiStore.getState().currentTeamId).toBe('t2')
})

it('keeps the current team when saving a switch fails', async () => {
  useAppUiStore.getState().setCurrentTeam('t1')
  vi.spyOn(authApi, 'selectTeam').mockRejectedValue(new Error('暂无团队访问权限'))
  openMenu()
  fireEvent.mouseEnter(await screen.findByRole('button', { name: '切换团队' }))
  fireEvent.click(await screen.findByRole('button', { name: '进入团队 团队二' }))
  expect(await screen.findByText('暂无团队访问权限')).toBeInTheDocument()
  expect(useAppUiStore.getState().currentTeamId).toBe('t1')
})

it('saves the nickname and uses the server profile response', async () => {
  const updated = { ...user, displayName: '新的昵称' }
  const update = vi.spyOn(authApi, 'updateMe').mockResolvedValue(updated)
  openMenu()
  fireEvent.click(await screen.findByRole('button', { name: '修改昵称' }))
  fireEvent.change(screen.getByRole('textbox', { name: '昵称' }), {
    target: { value: ' 新的昵称 ' },
  })
  fireEvent.click(screen.getByRole('button', { name: '保存昵称' }))
  await waitFor(() => expect(updateUser).toHaveBeenCalledWith(updated))
  expect(update).toHaveBeenCalledWith({ displayName: '新的昵称' })
})

it('leaves the previous avatar intact if upload credentials fail', async () => {
  vi.spyOn(authApi, 'createAvatarCredential').mockRejectedValue(new Error('上传失败'))
  openMenu()
  await screen.findByRole('button', { name: '更换个人头像' })
  const input = document.querySelector('input[type="file"]')
  expect(input).not.toBeNull()
  fireEvent.change(input!, {
    target: { files: [new File(['image'], 'avatar.png', { type: 'image/png' })] },
  })
  expect(await screen.findByText('上传失败')).toBeInTheDocument()
  expect(updateUser).not.toHaveBeenCalled()
})

it('opens settings for the current team from the personal menu', async () => {
  useAppUiStore.getState().setCurrentTeam('t2')
  renderWorkspace(
    <Routes>
      <Route index element={<PersonalCenter />} />
      <Route path="teams/:teamId/settings" element={<div>当前团队设置页</div>} />
    </Routes>,
    '/app',
    '/app/*',
    (client) => {
      client.setQueryData(['teams', 'mine'], [{ id: 't2', name: '团队二' }])
    },
  )
  fireEvent.click(screen.getByRole('button', { name: '打开个人中心' }))
  fireEvent.click(await screen.findByRole('button', { name: /团队设置/ }))
  expect(await screen.findByText('当前团队设置页')).toBeInTheDocument()
})

it('hides team settings when no team is selected', async () => {
  openMenu()
  await screen.findByRole('region', { name: '个人中心' })
  expect(screen.queryByRole('button', { name: /团队设置/ })).not.toBeInTheDocument()
})
