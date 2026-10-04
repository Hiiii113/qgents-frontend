import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './handlers'
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
const base = window.location.origin + '/api/projects/proj-001/groups/group-main-proj-001'
async function json(path: string, body?: unknown) {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  return await response.json() as { data: { id: string; cancelledRuns?: number }; page?: { hasMore: boolean } }
}
describe('current Mock chat protocol', () => {
  it('keeps newly created teams accessible and creates a default project group', async () => {
    const team = await json(window.location.origin + '/api/teams', { name: '入口验证团队' })
    const detail = await json(window.location.origin + `/api/teams/${team.data.id}`)
    expect(detail.data.id).toBe(team.data.id)
    const project = await json(window.location.origin + `/api/teams/${team.data.id}/projects`, { name: '聊天项目' })
    const groups = await fetch(window.location.origin + `/api/projects/${project.data.id}/groups`).then(response => response.json()) as { data: Array<{ defaultGroup: boolean }> }
    expect(groups.data).toHaveLength(1)
    expect(groups.data[0].defaultGroup).toBe(true)
  })
  it('provides one project group and returns a message directly without creating a task', async () => {
    const groups = await fetch(window.location.origin + '/api/projects/proj-001/groups').then(response => response.json()) as { data: Array<{ id: string }> }
    expect(groups.data).toHaveLength(1)
    const body = { type: 'TEXT', content: { text: '普通讨论' }, mentions: [], clientMessageId: 'ordinary-mock-contract' }
    const first = await json(`${base}/messages`, body)
    const retry = await json(`${base}/messages`, body)
    expect(first.data.id).toBe(retry.data.id)
    expect(first.data).not.toHaveProperty('task')
    expect(first.data).not.toHaveProperty('message')
    const response = await fetch(`${base}/messages/incremental?afterSequence=1`).then(response => response.json()) as { data: Array<{ id: string; senderType: string }> }
    expect(response.data.filter(item => item.id === first.data.id)).toHaveLength(1)
    expect(response.data.filter(item => item.senderType === 'AGENT')).toHaveLength(0)
  })
  it('creates a separate conversation, invites an Agent and keeps histories separate', async () => {
    const created = await json(window.location.origin + '/api/projects/proj-001/groups', { title: '方案讨论', userIds: [], agentIds: ['agent-general'] })
    const groupBase = window.location.origin + `/api/projects/proj-001/groups/${created.data.id}`
    const members = await fetch(`${groupBase}/members`).then(response => response.json()) as { data: Array<{ id: string }> }
    expect(members.data.some(member => member.id === 'agent-general')).toBe(true)
    const message = await json(`${groupBase}/messages`, { type: 'TEXT', content: { text: '新群讨论' }, mentions: [], clientMessageId: 'new-group-contract' })
    const defaultMessages = await fetch(`${base}/messages`).then(response => response.json()) as { data: Array<{ id: string }> }
    expect(defaultMessages.data.some(item => item.id === message.data.id)).toBe(false)
    await json(`${groupBase}/members`, { userIds: [], agentIds: ['agent-general'] })
    const after = await fetch(`${groupBase}/members`).then(response => response.json()) as { data: Array<{ id: string }> }
    expect(after.data.filter(member => member.id === 'agent-general')).toHaveLength(1)
  })
  it('cancels only execution triggered by an explicit Agent mention', async () => {
    const trigger = await json(`${base}/messages`, { type: 'TEXT', content: { text: '@助手 分析一下' }, mentions: [{ type: 'AGENT', id: 'agent-general' }], clientMessageId: 'agent-mock-contract' })
    const stopped = await json(`${base}/messages/${trigger.data.id}/cancel-agent`, {})
    expect(stopped.data.cancelledRuns).toBe(1)
    const repeated = await json(`${base}/messages/${trigger.data.id}/cancel-agent`, {})
    expect(repeated.data.cancelledRuns).toBe(0)
  })
})
