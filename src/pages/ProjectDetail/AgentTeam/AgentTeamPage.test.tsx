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
    await user.type(screen.getByLabelText('昵称'), '代码助手')
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
    expect(screen.getByRole('button', { name: '编辑' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '归档' })).not.toBeInTheDocument()
    expect(screen.queryByText('任务运行')).not.toBeInTheDocument()
  })

  it('lets an owner upload and save the default Agent identity without behavior fields', async () => {
    const agent = { id: 'a1', name: '通用助手', avatar: 'https://example.com/old.png', role: 'GENERAL', description: null, prompt: null, status: 'ACTIVE' as const, visibility: 'TEAM' as const, createdBy: null, isDefault: true, githubEnabled: false }
    vi.spyOn(agentApi, 'get').mockResolvedValue(agent)
    const update = vi.spyOn(agentApi, 'update').mockResolvedValue(agent)
    const credential = vi.spyOn(agentApi, 'avatarCredential').mockResolvedValue({ objectKey: 'agents/t1/new.png', uploadUrl: 'https://example.com/upload', method: 'PUT', headers: {}, expiresAt: '' })
    const confirm = vi.spyOn(agentApi, 'avatarConfirm').mockResolvedValue({ avatarUrl: 'https://example.com/new.png' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
    const view = renderWorkspace(<AgentTeamPage />, '/app/projects/p1/agents', '/app/projects/:projectId/agents', client => {
      client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1' })
      client.setQueryData(['teams', 't1'], { id: 't1', role: 'TEAM_OWNER' })
      client.setQueryData(['teams', 't1', 'agents', 'list'], [agent])
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '编辑' }))
    const nickname = await screen.findByLabelText('昵称')
    expect(screen.queryByLabelText('协作说明')).not.toBeInTheDocument()
    await user.clear(nickname)
    await user.type(nickname, '小青')
    const file = new File(['image'], 'avatar.png', { type: 'image/png' })
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(5) })
    await user.upload(view.baseElement.querySelector('input[type="file"]') as HTMLInputElement, file)
    await waitFor(() => expect(confirm).toHaveBeenCalledWith('t1', 'agents/t1/new.png'))
    expect(credential).toHaveBeenCalledWith('t1', { mediaType: 'image/png', sizeBytes: 5 })
    await waitFor(() => expect(screen.getByRole('button', { name: '保 存' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '保 存' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith('t1', 'a1', { name: '小青', avatar: 'https://example.com/new.png' }))
  })

  it('keeps the default Agent immutable for ordinary team members', () => {
    renderWorkspace(<AgentTeamPage />, '/app/projects/p1/agents', '/app/projects/:projectId/agents', client => {
      client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1' })
      client.setQueryData(['teams', 't1'], { id: 't1', role: 'TEAM_MEMBER' })
      client.setQueryData(['teams', 't1', 'agents', 'list'], [{ id: 'a1', name: '通用助手', status: 'ACTIVE', visibility: 'TEAM', createdBy: 'u1', isDefault: true }])
    })
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument()
  })
})
