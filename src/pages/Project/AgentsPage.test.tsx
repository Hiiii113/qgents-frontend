import { cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { agentApi } from '@/api/agent'
import { chatApi } from '@/api/chat'
import { renderWorkspace } from '@/test/renderWorkspace'
import AgentsPage from './AgentsPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('separates the default agent from member applications and links pending approvals to the default group', async () => {
  vi.spyOn(agentApi, 'list').mockResolvedValue([
    {
      id: 'ag_1',
      name: 'Qgent',
      description: '项目默认 Agent',
      defaultAgent: true,
      status: 'ACTIVE',
    },
    {
      id: 'ag_2',
      name: '测试雷达',
      description: '盯住回归测试与失败用例',
      defaultAgent: false,
      status: 'PENDING',
    },
  ])
  vi.spyOn(chatApi, 'groups').mockResolvedValue([
    { id: 'g1', projectId: 'p1', title: '默认群', defaultGroup: true },
  ])
  renderWorkspace(
    <AgentsPage />,
    '/app/projects/p1/agents',
    '/app/projects/:projectId/agents',
    () => undefined,
  )

  expect(await screen.findByText('Qgent')).toBeInTheDocument()
  expect(screen.getByText('ag_1')).toBeInTheDocument()
  expect(screen.getByText('测试雷达')).toBeInTheDocument()
  expect(screen.getByText('待审批')).toBeInTheDocument()

  const heroLink = screen.getByRole('link', { name: '去默认群' })
  const approveLink = await screen.findByRole('link', { name: '去默认群审批 测试雷达' })
  await waitFor(() => {
    expect(heroLink).toHaveAttribute('href', '/app/projects/p1/chat?groupId=g1')
    expect(approveLink).toHaveAttribute('href', '/app/projects/p1/chat?groupId=g1')
  })
})
