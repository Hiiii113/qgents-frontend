import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWorkspace } from '@/test/renderWorkspace'
import { agentApi } from '@/api/agent'
import AgentTeamPage from './AgentTeamPage'
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe('Agent partners', () => {
  it('lets the team owner enable GitHub on a default Agent', async () => {
    const agent = { id: 'a1', name: '通用助手', avatar: null, role: 'GENERAL', description: null, status: 'ACTIVE' as const, visibility: 'TEAM' as const, createdBy: 'u1', isDefault: true, githubEnabled: false }
    const save = vi.spyOn(agentApi, 'configureGithub').mockResolvedValue({ ...agent, githubEnabled: true })
    renderWorkspace(<AgentTeamPage />, '/app/projects/p1/agents', '/app/projects/:projectId/agents', client => {
      client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1' })
      client.setQueryData(['teams', 't1'], { id: 't1', role: 'TEAM_OWNER' })
      client.setQueryData(['teams', 't1', 'agents', 'list'], [agent])
    })
    await userEvent.click(screen.getByRole('switch', { name: '通用助手的 GitHub 能力' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith('t1', 'a1', true))
  })

  it('creates an Agent with a GitHub switch instead of a credential reference', async () => {
    const save = vi.spyOn(agentApi, 'create').mockResolvedValue({ id: 'a2', name: '代码助手', avatar: null, role: 'GENERAL', description: null, status: 'ACTIVE', visibility: 'PRIVATE', createdBy: 'u1', githubEnabled: true })
    renderWorkspace(<AgentTeamPage />, '/app/projects/p1/agents', '/app/projects/:projectId/agents', client => {
      client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1' })
      client.setQueryData(['teams', 't1'], { id: 't1', role: 'TEAM_OWNER' })
      client.setQueryData(['teams', 't1', 'agents', 'list'], [])
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /创建 Agent/ }))
    await user.type(screen.getByLabelText('名称'), '代码助手')
    await user.type(screen.getByLabelText('协作说明'), '根据用户需求修改代码')
    const toggle = screen.getByRole('switch', { name: '开启 GitHub 能力' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: '保 存' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith('t1', expect.objectContaining({ githubEnabled: true })))
  })

  it('uses chat collaboration and protects the default Agent', () => {
    renderWorkspace(<AgentTeamPage />, '/app/projects/p1/agents', '/app/projects/:projectId/agents', client => {
      client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1', role: 'PROJECT_ADMIN' })
      client.setQueryData(['teams', 't1'], { id: 't1', role: 'TEAM_OWNER' })
      client.setQueryData(['teams', 't1', 'agents', 'list'], [{ id: 'a1', name: '通用助手', status: 'ACTIVE', visibility: 'TEAM', createdBy: 'u1', isDefault: true }])
    })
    expect(screen.getByText('通用助手')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '回到聊天' })).toHaveAttribute('href', '/app/projects/p1/chat')
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '归档' })).not.toBeInTheDocument()
    expect(screen.queryByText('任务运行')).not.toBeInTheDocument()
  })
})
