import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachmentApi, resolvePreviewUrl, uploadAttachment } from './attachment'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('attachmentApi.info', () => {
  it('requests attachment metadata with the attachment id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            attachmentId: 'att-1',
            fileName: '登录页设计.png',
            mediaType: 'image/png',
            sizeBytes: 102400,
            previewable: true,
            previewType: 'IMAGE',
            contentUrl: '/api/v1/projects/project-1/attachments/att-1/content?token=abc',
            expiresAt: '2026-08-18T12:15:00Z',
          },
          requestId: 'request-1',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const result = await attachmentApi.info('1', 'att-1')
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/1/attachments/att-1', expect.any(Object))
    expect(result).toMatchObject({
      attachmentId: 'att-1',
      previewable: true,
      previewType: 'IMAGE',
      contentUrl: '/api/v1/projects/project-1/attachments/att-1/content?token=abc',
    })
  })
})

describe('resolvePreviewUrl', () => {
  it('keeps absolute URLs unchanged', () => {
    expect(resolvePreviewUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
  })

  it('maps backend paths through the configured API base', () => {
    expect(resolvePreviewUrl('/api/v1/projects/p/attachments/a/content?token=x')).toBe(
      `${window.location.origin}/api/projects/p/attachments/a/content?token=x`,
    )
  })
})

describe('uploadAttachment', () => {
  it.each([
    [
      '/api/v1/projects/p/attachments/a/content',
      `${window.location.origin}/api/projects/p/attachments/a/content`,
      true,
    ],
    [
      `${window.location.origin}/api/projects/p/attachments/a`,
      `${window.location.origin}/api/projects/p/attachments/a`,
      true,
    ],
    ['https://oss.example.com/a?Signature=x', 'https://oss.example.com/a?Signature=x', false],
    [
      `${window.location.origin}/oss/a?Signature=x`,
      `${window.location.origin}/oss/a?Signature=x`,
      false,
    ],
  ])(
    'uploads to %s then confirms the attachment',
    async (uploadUrl, expectedUrl, authenticated) => {
      localStorage.setItem('qgents_access_token', 'test-token')
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                attachmentId: 'a',
                uploadUrl,
                method: 'PUT',
                headers: { 'Content-Type': 'image/png' },
              },
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: { attachmentId: 'a', status: 'READY' } }), {
            status: 200,
          }),
        )
      const file = new File(['image'], 'image.png', { type: 'image/png' })
      Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(5) })

      expect(await uploadAttachment('p', file)).toBe('a')
      expect(fetchMock.mock.calls[1]?.[0]).toBe(expectedUrl)
      const upload = fetchMock.mock.calls[1]?.[1]
      const headers = upload?.headers as Record<string, string>
      expect(upload?.method).toBe('PUT')
      expect(headers['Content-Type']).toBe('image/png')
      expect(headers['Authorization']).toBe(authenticated ? 'Bearer test-token' : undefined)
      expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/projects/p/attachments/a/confirm')
    },
  )

  it('does not confirm after the file upload fails', async () => {
    const create = vi.spyOn(attachmentApi, 'createCredential').mockResolvedValue({
      attachmentId: 'a',
      uploadUrl: 'https://oss.example.com/a',
      method: 'PUT',
      headers: {},
      expiresAt: '',
    })
    const confirm = vi.spyOn(attachmentApi, 'confirm')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 403 }))
    const file = new File(['x'], 'x.txt')
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(1) })
    await expect(uploadAttachment('p', file)).rejects.toThrow('附件上传失败（403）')
    expect(create).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('propagates confirmation failures instead of returning a usable attachment id', async () => {
    vi.spyOn(attachmentApi, 'createCredential').mockResolvedValue({
      attachmentId: 'a',
      uploadUrl: 'https://oss.example.com/a',
      method: 'PUT',
      headers: {},
      expiresAt: '',
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
    vi.spyOn(attachmentApi, 'confirm').mockRejectedValue(new Error('附件大小不匹配'))
    const file = new File(['x'], 'x.txt')
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(1) })
    await expect(uploadAttachment('p', file)).rejects.toThrow('附件大小不匹配')
  })
})
