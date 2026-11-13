import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { skillApi } from '@/api'
import { renderWorkspace } from '@/test/renderWorkspace'
import type { Skill } from '@/types'
import { SkillPage } from './SkillPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const skill: Skill = {
  id: 's1',
  projectId: 'p1',
  name: '前端助手',
  description: '前端实现约定',
  content: '# 前端助手',
  tags: [],
  visibility: 'PROJECT_SHARED',
  status: 'PUBLISHED',
  creator: { id: 'u1', displayName: '创建者' },
  reviewer: null,
  reviewedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function open() {
  renderWorkspace(
    <SkillPage />,
    '/app/projects/p1/skills',
    '/app/projects/:projectId/skills',
    () => undefined,
  )
}

it('offers an import action in the empty state when the project has no Skill', async () => {
  vi.spyOn(skillApi, 'list').mockResolvedValue([])
  open()

  expect(await screen.findByText('还没有 Skill')).toBeInTheDocument()
  const empty = document.querySelector('.skill-empty') as HTMLElement
  fireEvent.click(within(empty).getByRole('button', { name: '导入 Skill' }))
  expect(await screen.findByRole('button', { name: /选择文件/ })).toBeInTheDocument()
})

it('keeps the one-line hint when the filter excludes every Skill', async () => {
  vi.spyOn(skillApi, 'list').mockResolvedValue([skill])
  open()

  expect(await screen.findByText('前端助手')).toBeInTheDocument()
  fireEvent.change(screen.getByPlaceholderText('搜索名称、内容或标签'), {
    target: { value: '不存在' },
  })
  expect(screen.getByText('没有匹配的 Skill。')).toBeInTheDocument()
  expect(document.querySelector('.skill-empty')).not.toBeInTheDocument()
})
