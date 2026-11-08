import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachmentApi, type AttachmentInfo } from '@/api/attachment'
import { AttachmentPreviewModal } from './AttachmentPreviewModal'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const image: AttachmentInfo = {
  attachmentId: 'a1',
  fileName: 'image.png',
  mediaType: 'image/png',
  sizeBytes: 20,
  previewable: true,
  previewType: 'IMAGE',
  contentUrl: '/api/v1/projects/p1/attachments/a1/content?token=first',
  expiresAt: '2026-10-02T00:00:00Z',
}

function renderModal(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <AttachmentPreviewModal open projectId="p1" attachmentId="a1" onClose={vi.fn()} />
    </QueryClientProvider>,
  )
}

describe('chat attachment preview', () => {
  it('gets a new content URL after closing and reopening the attachment', async () => {
    const api = vi.spyOn(attachmentApi, 'info').mockResolvedValueOnce(image)
      .mockResolvedValue({ ...image, contentUrl: '/api/v1/projects/p1/attachments/a1/content?token=second' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const view = renderModal(client)
    await waitFor(() => expect(screen.getByRole('img', { name: 'image.png' })).toHaveAttribute('src', expect.stringContaining('token=first')))
    view.unmount()
    renderModal(client)
    await waitFor(() => expect(screen.getByRole('img', { name: 'image.png' })).toHaveAttribute('src', expect.stringContaining('token=second')))
    expect(api).toHaveBeenCalledTimes(2)
    client.clear()
  })

  it('allows retrying failed attachment info requests', async () => {
    vi.spyOn(attachmentApi, 'info').mockRejectedValueOnce(new Error('网络中断')).mockResolvedValue(image)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderModal(client)
    await screen.findByText('预览信息加载失败')
    fireEvent.click(screen.getByRole('button', { name: /^重\s*试$/ }))
    await screen.findByRole('img', { name: 'image.png' })
    client.clear()
  })

  it('renders PDF previews through an iframe with the content URL', async () => {
    vi.spyOn(attachmentApi, 'info').mockResolvedValue({
      ...image,
      fileName: 'doc.pdf',
      mediaType: 'application/pdf',
      previewType: 'PDF',
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderModal(client)
    const frame = await screen.findByTitle('doc.pdf')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute('src', expect.stringContaining('/content?token=first'))
    client.clear()
  })

  it('downloads through the content URL with download=1', async () => {
    vi.spyOn(attachmentApi, 'info').mockResolvedValue(image)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderModal(client)
    const download = await screen.findByRole('link', { name: /下载文件/ })
    expect(download.getAttribute('href')).toContain('token=first')
    expect(download.getAttribute('href')).toContain('download=1')
    client.clear()
  })

  it('loads text from the unified content URL without a raw parameter', async () => {
    vi.spyOn(attachmentApi, 'info').mockResolvedValue({
      ...image,
      fileName: 'notes.txt',
      mediaType: 'text/plain',
      previewType: 'TEXT',
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('hello qwen', { status: 200 }))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderModal(client)
    expect(await screen.findByText('hello qwen')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      `${window.location.origin}/api/projects/p1/attachments/a1/content?token=first`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('raw=1')
    client.clear()
  })
})
