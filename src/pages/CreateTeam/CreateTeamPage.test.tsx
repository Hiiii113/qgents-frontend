import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { teamApi } from '@/api/team'
import { renderWorkspace } from '@/test/renderWorkspace'
import CreateTeamPage from './CreateTeamPage'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ setHasTeam: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('keeps the avatar failure visible after navigating to the newly created team', async () => {
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = () => 'blob:avatar-preview'
    },
  )
  vi.spyOn(teamApi, 'create').mockResolvedValue({ id: 't1', name: '测试团队' })
  vi.spyOn(teamApi, 'avatarCredential').mockRejectedValue(new Error('未配置头像公共访问地址'))
  renderWorkspace(
    <Routes>
      <Route path="create" element={<CreateTeamPage />} />
      <Route path="t1" element={<div>新团队页面</div>} />
    </Routes>,
    '/app/teams/create',
    '/app/teams/*',
    () => {},
  )
  fireEvent.change(screen.getByLabelText('上传团队头像'), {
    target: { files: [new File(['image'], 'avatar.png', { type: 'image/png' })] },
  })
  fireEvent.change(screen.getByPlaceholderText('例如：前端攻坚小组'), {
    target: { value: '测试团队' },
  })
  fireEvent.click(screen.getByRole('button', { name: '创建团队' }))
  expect(await screen.findByText('新团队页面')).toBeInTheDocument()
  expect(
    await screen.findByText('团队已创建，但头像未能上传。请在团队设置中重新上传。'),
  ).toBeInTheDocument()
})
