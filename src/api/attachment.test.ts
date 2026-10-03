import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachmentApi, resolvePreviewUrl, uploadAttachment } from './attachment'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('attachmentApi.previewUrl', () => {
  it('requests the preview metadata endpoint with the attachment id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: {
        attachmentId: 'att-1',
        fileName: '登录页设计.png',
        mediaType: 'image/png',
        sizeBytes: 102400,
        previewable: true,
        previewType: 'IMAGE',
        previewUrl: '/api/v1/projects/project-1/attachments/att-1/preview?token=abc',
        downloadUrl: 'https://oss.example.com/x?Expires=1&Signature=s',
        expiresAt: '2026-08-18T12:15:00Z',
      },
      requestId: 'request-1',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const result = await attachmentApi.previewUrl('project-1', 'att-1')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/project-1/attachments/att-1/preview-url',
      expect.any(Object),
    )
    expect(result).toMatchObject({
      attachmentId: 'att-1',
      previewable: true,
      previewType: 'IMAGE',
    })
  })
})

describe('resolvePreviewUrl', () => {
  it('keeps absolute URLs unchanged', () => {
    expect(resolvePreviewUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
  })

  it('maps backend paths through the configured API base', () => {
    expect(resolvePreviewUrl('/api/v1/projects/p/attachments/a/preview?token=x')).toBe(
      `${window.location.origin}/api/projects/p/attachments/a/preview?token=x`,
    )
  })
})

describe('uploadAttachment', () => {
  it.each([
    ['/api/v1/projects/p/attachments/a/content', `${window.location.origin}/api/projects/p/attachments/a/content`, true],
    ['https://oss.example.com/a?Signature=x', 'https://oss.example.com/a?Signature=x', false],
  ])('uploads to %s then confirms the attachment', async (uploadUrl, expectedUrl, authenticated) => {
    localStorage.setItem('qgents_access_token', 'test-token')
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        attachmentId: 'a', uploadUrl, method: 'PUT', headers: { 'Content-Type': 'image/png' },
      } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { attachmentId: 'a', status: 'READY' } }), { status: 200 }))
    const file = new File(['image'], 'image.png', { type: 'image/png' })
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(5) })

    expect(await uploadAttachment('p', file)).toBe('a')
    expect(fetchMock.mock.calls[1]?.[0]).toBe(expectedUrl)
    const upload = fetchMock.mock.calls[1]?.[1]
    const headers = upload?.headers as Record<string, string>
    expect(upload?.method).toBe('PUT')
    expect(headers['Content-Type']).toBe('image/png')
    expect(headers['Authorization']).toBe(authenticated ? 'Bearer test-token' : undefined)
    expect(Boolean(headers['Idempotency-Key'])).toBe(authenticated)
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/projects/p/attachments/a/confirm')
  })
})
