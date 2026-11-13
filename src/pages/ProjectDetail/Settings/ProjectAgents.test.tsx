import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { agentApi } from '@/api/agent'
import { chatKeys } from '@/query/chatKeys'
import { renderWorkspace } from '@/test/renderWorkspace'
import { ProjectAgents } from './ProjectAgents'
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function open() {
  return renderWorkspace(
    <ProjectAgents />,
    '/app/projects/p1/agents',
    '/app/projects/:projectId/agents',
    (client) => {
      client.setQueryData(['projects', 'p1'], {
        id: 'p1',
        teamId: 't1',
        name: '项目',
        role: 'PROJECT_MEMBER',
      })
      client.setQueryData(chatKeys.groups('p1'), [
        { id: 'g1', projectId: 'p1', title: '默认聊天', defaultGroup: true },
      ])
    },
  )
}

it('lists the enabled agents of the project and marks the default one', async () => {
  vi.spyOn(agentApi, 'list').mockResolvedValue([
    {
      id: '11',
      name: 'Qgent',
      description: '项目默认 Agent',
      defaultAgent: true,
      status: 'ACTIVE',
    },
    {
      id: '12',
      name: '前端助手',
      description: '负责前端实现',
      defaultAgent: false,
      status: 'ACTIVE',
    },
  ])
  open()
  expect(await screen.findByText('Qgent')).toBeInTheDocument()
  expect(screen.getByText('前端助手')).toBeInTheDocument()
  expect(screen.getByText('默认 Agent')).toBeInTheDocument()
  expect(screen.queryByText('已启用')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /申请新 Agent/ })).toBeInTheDocument()
})

it('submits a custom agent application and shows it waits for admin approval', async () => {
  vi.spyOn(agentApi, 'list').mockResolvedValue([])
  const apply = vi
    .spyOn(agentApi, 'apply')
    .mockResolvedValue({ id: '13', name: '测试助手', defaultAgent: false, status: 'PENDING' })
  open()
  fireEvent.click(await screen.findByRole('button', { name: /申请新 Agent/ }))
  fireEvent.change(await screen.findByLabelText('Agent 名称'), { target: { value: '测试助手' } })
  fireEvent.change(screen.getByLabelText('职责描述'), { target: { value: '负责接口联调' } })
  fireEvent.change(screen.getByLabelText('系统提示词'), { target: { value: '你是测试助手' } })
  fireEvent.change(screen.getByLabelText('头像地址'), {
    target: { value: 'https://example.com/a.png' },
  })
  fireEvent.click(screen.getByRole('button', { name: '提交申请' }))
  await waitFor(() =>
    expect(apply).toHaveBeenCalledWith('p1', {
      name: '测试助手',
      description: '负责接口联调',
      systemPrompt: '你是测试助手',
      avatarUrl: 'https://example.com/a.png',
    }),
  )
  expect(await screen.findByText('「测试助手」已提交，待审批')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '去默认群跟进' })).toHaveAttribute(
    'href',
    '/app/projects/p1/chat?groupId=g1',
  )
})
