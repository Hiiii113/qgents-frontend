import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './handlers'
import { QGENT_ID } from '@/types/chat'
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
const base = async () => {
  const groups = await fetch(window.location.origin + '/api/projects/2/groups').then(response => response.json()) as { data: Array<{ id: string }> }
  return window.location.origin + `/api/projects/2/groups/${groups.data[0].id}`
}
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
    const projectDetail = await fetch(window.location.origin + `/api/projects/${project.data.id}`).then(response => response.json()) as { data: { githubEnabled: boolean } }
    expect(projectDetail.data.githubEnabled).toBe(true)
    const groups = await fetch(window.location.origin + `/api/projects/${project.data.id}/groups`).then(response => response.json()) as { data: Array<{ id: string; defaultGroup: boolean }> }
    expect(groups.data).toHaveLength(1)
    expect(groups.data[0].defaultGroup).toBe(true)
    const members = await fetch(window.location.origin + `/api/projects/${project.data.id}/groups/${groups.data[0].id}/members`).then(response => response.json()) as { data: Array<{ id: string }> }
    expect(members.data.some(member => member.id === QGENT_ID)).toBe(true)
  })
  it('provides one project group and returns a message directly without creating a task', async () => {
    const groups = await fetch(window.location.origin + '/api/projects/2/groups').then(response => response.json()) as { data: Array<{ id: string }> }
    expect(groups.data).toHaveLength(1)
    const body = { type: 'TEXT', content: { text: '普通讨论' }, mentions: [], clientMessageId: 'ordinary-mock-contract' }
    const first = await json(`${await base()}/messages`, body)
    const retry = await json(`${await base()}/messages`, body)
    expect(first.data.id).toBe(retry.data.id)
    expect(first.data).not.toHaveProperty('task')
    expect(first.data).not.toHaveProperty('message')
    const response = await fetch(`${await base()}/messages/incremental?afterSequence=1`).then(response => response.json()) as { data: Array<{ id: string; senderType: string }> }
    expect(response.data.filter(item => item.id === first.data.id)).toHaveLength(1)
    expect(response.data.filter(item => item.senderType === 'AGENT')).toHaveLength(0)
  })
  it('creates a separate conversation, optionally invites Qgent and keeps histories separate', async () => {
    const created = await json(window.location.origin + '/api/projects/2/groups', { title: '方案讨论', userIds: [], agentIds: [QGENT_ID] })
    const groupBase = window.location.origin + `/api/projects/2/groups/${created.data.id}`
    const members = await fetch(`${groupBase}/members`).then(response => response.json()) as { data: Array<{ id: string }> }
    expect(members.data.some(member => member.id === QGENT_ID)).toBe(true)
    const message = await json(`${groupBase}/messages`, { type: 'TEXT', content: { text: '新群讨论' }, mentions: [], clientMessageId: 'new-group-contract' })
    const defaultMessages = await fetch(`${await base()}/messages`).then(response => response.json()) as { data: Array<{ id: string }> }
    expect(defaultMessages.data.some(item => item.id === message.data.id)).toBe(false)
    await json(`${groupBase}/members`, { userIds: [], agentIds: [QGENT_ID] })
    const after = await fetch(`${groupBase}/members`).then(response => response.json()) as { data: Array<{ id: string }> }
    expect(after.data.filter(member => member.id === QGENT_ID)).toHaveLength(1)
  })
  it('rejects Qgent mentions in uninvited groups and mentions to another identity', async () => {
    const created = await json(window.location.origin + '/api/projects/2/groups', { title: '普通讨论', userIds: [], agentIds: [] })
    const groupPath = window.location.origin + `/api/projects/2/groups/${created.data.id}/messages`
    const uninvited = await fetch(groupPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'TEXT', content: { text: '@Qgent' }, mentions: [{ type: 'AGENT', id: QGENT_ID }], clientMessageId: 'qgent-not-invited' }) })
    expect(uninvited.status).toBe(422)
    expect(await uninvited.json()).toMatchObject({ error: { code: 'INVALID_QGENT_MENTION' } })
    const wrongIdentity = await fetch(`${await base()}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'TEXT', content: { text: '@Old agent' }, mentions: [{ type: 'AGENT', id: '999' }], clientMessageId: 'wrong-agent-id' }) })
    expect(wrongIdentity.status).toBe(422)
    expect(await wrongIdentity.json()).toMatchObject({ error: { code: 'INVALID_QGENT_MENTION' } })
  })
  it('cancels only execution triggered by an explicit Qgent mention', async () => {
    const trigger = await json(`${await base()}/messages`, { type: 'TEXT', content: { text: '@Qgent 分析一下' }, mentions: [{ type: 'AGENT', id: QGENT_ID }], clientMessageId: 'qgent-mock-contract' })
    const stopped = await json(`${await base()}/messages/${trigger.data.id}/cancel-agent`, {})
    expect(stopped.data.cancelledRuns).toBe(1)
    const repeated = await json(`${await base()}/messages/${trigger.data.id}/cancel-agent`, {})
    expect(repeated.data.cancelledRuns).toBe(0)
  })
})
