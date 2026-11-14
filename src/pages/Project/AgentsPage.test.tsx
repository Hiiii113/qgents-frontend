import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { agentApi } from '@/api/agent'
import { renderWorkspace } from '@/test/renderWorkspace'
import AgentsPage from './AgentsPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('separates the default agent from member applications and states the approval rule', async () => {
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
  expect(screen.getByText(/待审批的 Agent 不能邀请入群/)).toBeInTheDocument()
})
