import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './handlers'
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
type Agent = { id: string; name: string; defaultAgent: boolean; status: string }
type Member = { id: string; displayName: string; memberType: string }
type Message = { id: string; senderId: string; senderName: string; senderType: string; replyToId?: string; cancelledRuns?: number }
const origin = window.location.origin
async function read<T>(path: string): Promise<T> {
  return (await fetch(origin + path).then(response => response.json()) as { data: T }).data
}
function send(path: string, body?: unknown) {
  return fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })
}
async function post<T>(path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const response = await send(path, body)
  return { status: response.status, data: (await response.json() as { data: T }).data }
}
const projectAgents = (projectId: string) => read<Agent[]>(`/api/projects/${projectId}/agents`)
const defaultGroupOf = async (projectId: string) => {
  const groups = await read<Array<{ id: string; defaultGroup: boolean }>>(`/api/projects/${projectId}/groups`)
  return groups.find(group => group.defaultGroup)?.id ?? ''
}
const membersOf = (projectId: string, groupId: string) => read<Member[]>(`/api/projects/${projectId}/groups/${groupId}/members`)
describe('current Mock agent and chat protocol', () => {
  it('creates a default group holding the project default agent and keeps agent ids per project', async () => {
    const team = await post<{ id: string }>('/api/teams', { name: '入口验证团队' })
    expect((await read<{ id: string }>(`/api/teams/${team.data.id}`)).id).toBe(team.data.id)
    const project = await post<{ id: string; name: string }>(`/api/teams/${team.data.id}/projects`, { name: '聊天项目' })
    expect((await read<{ name: string }>(`/api/projects/${project.data.id}`)).name).toBe('聊天项目')
    const groups = await read<Array<{ id: string; defaultGroup: boolean }>>(`/api/projects/${project.data.id}/groups`)
    expect(groups).toHaveLength(1)
    expect(groups[0].defaultGroup).toBe(true)
    const [own] = await projectAgents(project.data.id)
    expect(own.defaultAgent).toBe(true)
    expect(own.status).toBe('ACTIVE')
    expect((await membersOf(project.data.id, groups[0].id)).some(member => member.id === own.id && member.memberType === 'AGENT')).toBe(true)
    const other = await projectAgents('2')
    expect(other[0].id).not.toBe(own.id)
  })
  it('provides one project group and returns a message directly without creating a task', async () => {
    const groupId = await defaultGroupOf('2')
    const body = { type: 'TEXT', content: { text: '普通讨论' }, mentions: [], clientMessageId: 'ordinary-mock-contract' }
    const first = await post<Message>(`/api/projects/2/groups/${groupId}/messages`, body)
    const retry = await post<Message>(`/api/projects/2/groups/${groupId}/messages`, body)
    expect(first.data.id).toBe(retry.data.id)
    expect(first.data).not.toHaveProperty('task')
    expect(first.data).not.toHaveProperty('message')
    const incremental = await read<Message[]>(`/api/projects/2/groups/${groupId}/messages/incremental?afterSequence=1`)
    expect(incremental.filter(item => item.id === first.data.id)).toHaveLength(1)
    expect(incremental.filter(item => item.senderType === 'AGENT')).toHaveLength(0)
  })
  it('creates a separate conversation that invites project agents by their own ids', async () => {
    const [agent] = await projectAgents('2')
    const created = await post<{ id: string }>('/api/projects/2/groups', { title: '方案讨论', userIds: [], agentIds: [agent.id] })
    const members = await membersOf('2', created.data.id)
    expect(members.some(member => member.id === agent.id)).toBe(true)
    const message = await post<Message>(`/api/projects/2/groups/${created.data.id}/messages`, { type: 'TEXT', content: { text: '新群讨论' }, mentions: [], clientMessageId: 'new-group-contract' })
    const defaultMessages = await read<Message[]>(`/api/projects/2/groups/${await defaultGroupOf('2')}/messages`)
    expect(defaultMessages.some(item => item.id === message.data.id)).toBe(false)
    await post(`/api/projects/2/groups/${created.data.id}/members`, { userIds: [], agentIds: [agent.id] })
    const after = await membersOf('2', created.data.id)
    expect(after.filter(member => member.id === agent.id)).toHaveLength(1)
  })
  it('rejects agents that are not invited, not enabled or belong to another project', async () => {
    const [agent] = await projectAgents('2')
    const created = await post<{ id: string }>('/api/projects/2/groups', { title: '普通讨论', userIds: [], agentIds: [] })
    const uninvited = await send(`/api/projects/2/groups/${created.data.id}/messages`, { type: 'TEXT', content: { text: '@Qgent' }, mentions: [{ type: 'AGENT', id: agent.id }], clientMessageId: 'agent-not-invited' })
    expect(uninvited.status).toBe(422)
    expect(await uninvited.json()).toMatchObject({ error: { code: 'AGENT_NOT_IN_GROUP' } })
    const unknown = await send(`/api/projects/2/groups/${await defaultGroupOf('2')}/messages`, { type: 'TEXT', content: { text: '@未知' }, mentions: [{ type: 'AGENT', id: '999999' }], clientMessageId: 'unknown-agent-id' })
    expect(unknown.status).toBe(422)
    const foreign = await send(`/api/projects/2/groups/${await defaultGroupOf('2')}/messages`, { type: 'TEXT', content: { text: '@别的项目' }, mentions: [{ type: 'AGENT', id: (await projectAgents('3'))[0].id }], clientMessageId: 'foreign-agent-id' })
    expect(foreign.status).toBe(422)
    const application = await post<Agent>('/api/projects/2/agents/applications', { name: '待审批助手', systemPrompt: '你是待审批助手' })
    expect(application.data.status).toBe('PENDING')
    const pending = await send(`/api/projects/2/groups/${await defaultGroupOf('2')}/members`, { userIds: [], agentIds: [application.data.id] })
    expect(pending.status).toBe(422)
    expect((await projectAgents('2')).some(item => item.id === application.data.id)).toBe(false)
  })
  it('replies from each mentioned agent identity and cancels only that execution', async () => {
    const [agent] = await projectAgents('2')
    const groupId = await defaultGroupOf('2')
    const trigger = await post<Message>(`/api/projects/2/groups/${groupId}/messages`, { type: 'TEXT', content: { text: '@Qgent 分析一下' }, mentions: [{ type: 'AGENT', id: agent.id }], clientMessageId: 'agent-mock-contract' })
    const stopped = await post<Message>(`/api/projects/2/groups/${groupId}/messages/${trigger.data.id}/cancel-agent`)
    expect(stopped.data.cancelledRuns).toBe(1)
    const repeated = await post<Message>(`/api/projects/2/groups/${groupId}/messages/${trigger.data.id}/cancel-agent`)
    expect(repeated.data.cancelledRuns).toBe(0)
    const reply = await post<Message>(`/api/projects/2/groups/${groupId}/messages`, { type: 'TEXT', content: { text: '@Qgent 继续' }, mentions: [{ type: 'AGENT', id: agent.id }], clientMessageId: 'agent-reply-contract' })
    await vi.waitFor(async () => {
      const history = await read<Message[]>(`/api/projects/2/groups/${groupId}/messages`)
      expect(history.some(item => item.replyToId === reply.data.id && item.senderId === agent.id && item.senderName === agent.name && item.senderType === 'AGENT')).toBe(true)
    })
  })
})
