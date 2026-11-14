import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { skillApi } from '@/api/skill'
import { renderWorkspace } from '@/test/renderWorkspace'
import type { Skill } from '@/types'
import SkillsPage from './SkillsPage'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const pending: Skill = {
  id: 's1',
  projectId: 'p1',
  name: '提交信息规范',
  description: 'Conventional Commits',
  content: '# 提交信息规范\n\n正文',
  tags: [],
  visibility: 'PROJECT_SHARED',
  status: 'PENDING_REVIEW',
  creator: { id: 'u1', displayName: '徐亦然' },
  reviewer: null,
  reviewedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function show(role: string) {
  vi.spyOn(skillApi, 'list').mockResolvedValue([pending])
  renderWorkspace(
    <SkillsPage />,
    '/app/projects/p1/skills',
    '/app/projects/:projectId/skills',
    (client) => {
      client.setQueryData(['projects', 'p1'], {
        id: 'p1',
        teamId: 't1',
        name: '项目',
        role,
      })
    },
  )
}

it('lets project admins approve or return a pending Skill', async () => {
  show('PROJECT_ADMIN')
  expect(await screen.findByRole('button', { name: '通过' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '退回' })).toBeInTheDocument()
})

it('keeps review actions away from members', async () => {
  show('PROJECT_MEMBER')
  expect(await screen.findAllByText('提交信息规范')).not.toHaveLength(0)
  expect(screen.queryByRole('button', { name: '通过' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '退回' })).not.toBeInTheDocument()
})
