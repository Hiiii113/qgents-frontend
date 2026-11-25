import { afterEach, describe, expect, it, vi } from 'vitest'
import { mcpApi } from './mcp'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const noContent = () => new Response(null, { status: 204 })

afterEach(() => vi.restoreAllMocks())

const server = {
  id: 'm1',
  name: 'Notion 项目库',
  url: 'https://mcp.notion.com/mcp',
  scope: 'SHARED' as const,
  authMode: 'OAUTH' as const,
  enabled: true,
  credentialStatus: 'CONNECTED' as const,
  agentIds: ['a1'],
}

describe('project MCP contracts', () => {
  it('reads the project servers as a plain array', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json([server]))
    expect(await mcpApi.list('p1')).toEqual([server])
    expect(spy).toHaveBeenCalledWith('/api/projects/p1/mcp', expect.anything())
  })

  it('creates with fixed scope and auth mode, then saves only name and enabled', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(server, 201))
    const payload = {
      name: server.name,
      url: server.url,
      scope: server.scope,
      authMode: server.authMode,
    }
    expect(await mcpApi.create('p1', payload)).toEqual(server)
    expect(spy).toHaveBeenCalledWith(
      '/api/projects/p1/mcp',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }),
    )

    spy.mockResolvedValue(noContent())
    await mcpApi.update('p1', 'm1', { name: 'Notion 项目库（停用）', enabled: false })
    expect(spy).toHaveBeenLastCalledWith(
      '/api/projects/p1/mcp/m1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'Notion 项目库（停用）', enabled: false }),
      }),
    )
    await mcpApi.remove('p1', 'm1')
    expect(spy).toHaveBeenLastCalledWith(
      '/api/projects/p1/mcp/m1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('saves a credential in the request body and can disconnect it', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(noContent())
    await mcpApi.saveCredential('p1', 'm1', 'secret-token')
    expect(spy).toHaveBeenLastCalledWith(
      '/api/projects/p1/mcp/m1/credential',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ token: 'secret-token' }) }),
    )
    expect(spy.mock.calls.at(-1)?.[0]).not.toContain('secret-token')

    await mcpApi.disconnectCredential('p1', 'm1')
    expect(spy).toHaveBeenLastCalledWith(
      '/api/projects/p1/mcp/m1/credential',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('assigns agents, starts OAuth, completes the callback and lists tools', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(noContent())
    await mcpApi.assignAgents('p1', 'm1', ['a1', 'a2'])
    expect(spy).toHaveBeenLastCalledWith(
      '/api/projects/p1/mcp/m1/agents',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ agentIds: ['a1', 'a2'] }) }),
    )

    spy.mockResolvedValue(json({ tools: ['search', 'create_page'] }))
    expect(await mcpApi.test('p1', 'm1')).toEqual({ tools: ['search', 'create_page'] })
    expect(spy).toHaveBeenLastCalledWith(
      '/api/projects/p1/mcp/m1/test',
      expect.objectContaining({ method: 'POST' }),
    )

    const oauth = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json({ authorizationUrl: 'https://provider.test/authorize' }))
    expect(await mcpApi.startOAuth('p1', 'm1')).toEqual({
      authorizationUrl: 'https://provider.test/authorize',
    })
    expect(oauth).toHaveBeenLastCalledWith(
      '/api/projects/p1/mcp/m1/oauth',
      expect.objectContaining({ method: 'POST' }),
    )

    oauth.mockResolvedValue(noContent())
    await mcpApi.completeOAuth('p1', { state: 'st-1', code: 'code-1' })
    expect(oauth).toHaveBeenLastCalledWith(
      '/api/projects/p1/mcp/oauth/complete',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ state: 'st-1', code: 'code-1' }),
      }),
    )
    await mcpApi.completeOAuth('p1', { state: 'st-2' })
    expect(oauth).toHaveBeenLastCalledWith(
      '/api/projects/p1/mcp/oauth/complete',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ state: 'st-2' }) }),
    )
  })
})
