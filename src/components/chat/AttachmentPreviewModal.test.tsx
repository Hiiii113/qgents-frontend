import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachmentApi, type AttachmentPreview } from '@/api/attachment'
import { AttachmentPreviewModal } from './AttachmentPreviewModal'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
const preview: AttachmentPreview = { attachmentId: 'a1', fileName: 'image.png', mediaType: 'image/png', sizeBytes: 20,
  previewable: true, previewType: 'IMAGE', previewUrl: '/image?token=first', downloadUrl: null, expiresAt: '2026-10-02T00:00:00Z' }

describe('chat attachment preview', () => {
  it('gets a new preview link after closing and reopening the attachment', async () => {
    const api = vi.spyOn(attachmentApi, 'previewUrl').mockResolvedValueOnce(preview)
      .mockResolvedValue({ ...preview, previewUrl: '/image?token=second' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const show = () => render(<QueryClientProvider client={client}><AttachmentPreviewModal open projectId="p1" attachmentId="a1" onClose={vi.fn()} /></QueryClientProvider>)
    const view = show()
    await waitFor(() => expect(screen.getByRole('img', { name: 'image.png' })).toHaveAttribute('src', expect.stringContaining('token=first')))
    view.unmount()
    show()
    await waitFor(() => expect(screen.getByRole('img', { name: 'image.png' })).toHaveAttribute('src', expect.stringContaining('token=second')))
    expect(api).toHaveBeenCalledTimes(2)
    cleanup(); client.clear()
  })
  it('allows retrying failed preview metadata requests', async () => {
    vi.spyOn(attachmentApi, 'previewUrl').mockRejectedValueOnce(new Error('网络中断')).mockResolvedValue(preview)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><AttachmentPreviewModal open projectId="p1" attachmentId="a1" onClose={vi.fn()} /></QueryClientProvider>)
    await screen.findByText('预览信息加载失败')
    fireEvent.click(screen.getByRole('button', { name: /^重\s*试$/ }))
    await screen.findByRole('img', { name: 'image.png' })
    cleanup(); client.clear()
  })
})
