import { afterEach, describe, expect, it, vi } from 'vitest'
import { agentApi } from './agent'
import { chatApi } from './chat'
import { repositoriesApi } from './repositories'
const response = (data: unknown) => new Response(JSON.stringify({ data }), { headers: { 'Content-Type': 'application/json' } })
afterEach(() => vi.restoreAllMocks())
describe('current backend contracts', () => {
  it('sends TEXT replies without Task configuration and unwraps the message directly', async () => {
    const message = { id: 'm2', type: 'TEXT', sequence: 2 }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(message))
    const payload = { type: 'TEXT' as const, content: { text: '普通讨论' }, replyToId: 'm1', mentions: [], clientMessageId: 'send-1' }
    expect(await chatApi.send('p1', 'g1', payload)).toEqual(message)
    expect(fetch).toHaveBeenCalledWith('/api/projects/p1/groups/g1/messages', expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }))
  })
  it('lists project agents and submits custom agent applications', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response([{ id: '11', status: 'ACTIVE' }]))
    await agentApi.list('p1')
    expect(spy.mock.calls.at(-1)?.[0]).toBe('/api/projects/p1/agents')
    const application = { name: '助手', systemPrompt: '你是助手' }
    await agentApi.apply('p1', application)
    expect(spy).toHaveBeenLastCalledWith('/api/projects/p1/agents/applications', expect.objectContaining({ method: 'POST', body: JSON.stringify(application) }))
  })
  it('stops Agent execution by trigger message and imports by numeric provider ID', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response({ cancelledRuns: 2 }))
    expect(await chatApi.cancel('p1', 'g1', 'm1')).toEqual({ cancelledRuns: 2 })
    expect(spy).toHaveBeenLastCalledWith('/api/projects/p1/groups/g1/messages/m1/cancel-agent', expect.objectContaining({ method: 'POST' }))
    await repositoriesApi.import('p1', { installationId: 'i1', repositoryId: 123 })
    expect(spy).toHaveBeenLastCalledWith('/api/projects/p1/repositories', expect.objectContaining({ body: JSON.stringify({ installationId: 'i1', repositoryId: 123 }) }))
  })
})
