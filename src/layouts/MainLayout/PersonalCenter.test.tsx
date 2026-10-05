import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { authApi } from '@/api/auth'
import { renderWorkspace } from '@/test/renderWorkspace'
import { PersonalCenter } from './PersonalCenter'

const { updateUser, logout, user } = vi.hoisted(() => ({
  updateUser: vi.fn(), logout: vi.fn(),
  user: { id: 'u1', displayName: '小林', email: 'lin@example.test' },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user, updateUser, logout }) }))
afterEach(() => { cleanup(); vi.restoreAllMocks(); updateUser.mockReset() })

function openMenu() {
  const view = renderWorkspace(<PersonalCenter />, '/app', '/app', () => {})
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

it('saves the nickname and uses the server profile response', async () => {
  const updated = { ...user, displayName: '新的昵称' }
  const update = vi.spyOn(authApi, 'updateMe').mockResolvedValue(updated)
  openMenu()
  fireEvent.click(await screen.findByRole('button', { name: '修改昵称' }))
  fireEvent.change(screen.getByRole('textbox', { name: '昵称' }), { target: { value: ' 新的昵称 ' } })
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
  fireEvent.change(input!, { target: { files: [new File(['image'], 'avatar.png', { type: 'image/png' })] } })
  expect(await screen.findByText('上传失败')).toBeInTheDocument()
  expect(updateUser).not.toHaveBeenCalled()
})
