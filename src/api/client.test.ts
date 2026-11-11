import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTH_EXPIRED_EVENT,
  beginLogout,
  endLogout,
  getLogoutRefreshToken,
  refreshAccessToken,
  request,
} from './client'
import { skillApi } from './skill'

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('API client authentication recovery', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('refreshes and retries on a documented 401 even without an internal error code', async () => {
    localStorage.setItem('qgents_access_token', 'expired-access-token')
    localStorage.setItem('qgents_refresh_token', 'refresh-token')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response(401, { error: { message: 'Token expired' } }))
      .mockResolvedValueOnce(
        response(200, {
          data: { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' },
        }),
      )
      .mockResolvedValueOnce(response(200, { data: { id: '1' } }))

    await expect(request<{ id: string }>('/projects/project-1/groups')).resolves.toEqual({
      id: '1',
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refreshToken: 'refresh-token' }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/projects/project-1/groups',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer new-access-token' }),
      }),
    )
    expect(localStorage.getItem('qgents_access_token')).toBe('new-access-token')
  })

  it('sends Skill preview and creation as multipart and edits as JSON', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => response(200, { data: {} }))
    const file = new File(
      [
        `---
name: Test
description: Demo
---
Body`,
      ],
      'SKILL.md',
    )
    await skillApi.preview('p1', file)
    await skillApi.create('p1', { file, visibility: 'PRIVATE', tags: ['demo'] })
    await skillApi.patch('p1', 's1', { content: 'new content', tags: ['updated'] })
    const preview = fetchMock.mock.calls[0][1]!
    const create = fetchMock.mock.calls[1][1]!
    const patch = fetchMock.mock.calls[2][1]!
    expect((preview.body as FormData).get('file')).toBe(file)
    expect((create.body as FormData).get('file')).toBe(file)
    expect((create.body as FormData).get('visibility')).toBe('PRIVATE')
    expect((create.body as FormData).get('tags')).toBe('["demo"]')
    expect(preview.headers).not.toHaveProperty('Content-Type')
    expect(create.headers).not.toHaveProperty('Content-Type')
    expect(patch.body).toBe(JSON.stringify({ content: 'new content', tags: ['updated'] }))
  })

  it('keeps the rotated refresh token for logout instead of restoring the session', async () => {
    localStorage.setItem('qgents_access_token', 'old-access-token')
    localStorage.setItem('qgents_refresh_token', 'old-refresh-token')
    let respond: (value: Response) => void = () => {}
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve
        }),
    )

    const refreshing = refreshAccessToken()
    beginLogout()
    respond(
      response(200, {
        data: { accessToken: 'new-access-token', refreshToken: 'rotated-refresh-token' },
      }),
    )

    await expect(refreshing).resolves.toBeNull()
    // 登出后不写回登录态，但轮换出的新令牌要留给服务端撤销
    expect(localStorage.getItem('qgents_access_token')).toBe('old-access-token')
    expect(getLogoutRefreshToken()).toBe('rotated-refresh-token')
    // 登出期间不再启动新的刷新
    expect(await refreshAccessToken()).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    endLogout()
  })

  it('clears the session only after refresh fails', async () => {
    localStorage.setItem('qgents_access_token', 'expired-access-token')
    localStorage.setItem('qgents_refresh_token', 'refresh-token')
    const onExpired = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response(401, { error: { message: 'Unauthorized' } }))
      .mockResolvedValueOnce(response(401, { error: { message: 'Refresh token expired' } }))

    await expect(request('/projects/project-1/groups')).rejects.toMatchObject({ status: 401 })

    expect(localStorage.getItem('qgents_access_token')).toBeNull()
    expect(localStorage.getItem('qgents_refresh_token')).toBeNull()
    expect(onExpired).toHaveBeenCalledTimes(1)
    window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  })
})
