import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChatComposer } from './ChatComposer'
import type { ChatMessage, SendChatMessage } from '@/types/chat'
afterEach(() => { cleanup(); sessionStorage.clear(); vi.restoreAllMocks() })
const agent = { id: 'a1', displayName: '助手', memberType: 'AGENT' as const }
function show(send = vi.fn<(body: SendChatMessage) => Promise<unknown>>().mockResolvedValue({}), reply: ChatMessage | null = null) {
  render(<App><ChatComposer projectId="p1" recipients={[agent]} reply={reply} onSend={send} onClearReply={vi.fn()} /></App>)
  return send
}
describe('chat composition', () => {
  it('sends ordinary messages without Agent mentions', async () => {
    const send = show()
    fireEvent.change(screen.getByLabelText('消息内容'), { target: { value: '一起讨论方案' } })
    fireEvent.click(screen.getByRole('button', { name: /发送/ }))
    await waitFor(() => expect(send).toHaveBeenCalledOnce())
    expect(send.mock.calls[0][0]).toMatchObject({ type: 'TEXT', content: { text: '一起讨论方案' }, mentions: [] })
    expect(send.mock.calls[0][0]).not.toHaveProperty('taskConfig')
  })
  it('replies as TEXT with replyToId and preserves the idempotency key on retry', async () => {
    const send = vi.fn<(body: SendChatMessage) => Promise<unknown>>().mockRejectedValueOnce(new Error('网络中断')).mockResolvedValue({})
    show(send, { id: 'm1', groupId: 'g1', type: 'TEXT', content: { text: '原消息' }, senderType: 'USER', senderName: '张工', createdAt: '2026-10-01T00:00:00Z' })
    fireEvent.change(screen.getByLabelText('消息内容'), { target: { value: '继续这个想法' } })
    fireEvent.click(screen.getByRole('button', { name: /发送/ }))
    await screen.findByText('网络中断')
    fireEvent.click(screen.getByRole('button', { name: /发送/ }))
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2))
    expect(send.mock.calls[0][0]).toMatchObject({ type: 'TEXT', replyToId: 'm1', content: { text: '继续这个想法' } })
    expect(send.mock.calls[1][0].clientMessageId).toBe(send.mock.calls[0][0].clientMessageId)
  })
  it('does not send during IME composition or on Shift + Enter', () => {
    const send = show()
    const input = screen.getByLabelText('消息内容')
    fireEvent.change(input, { target: { value: '中文输入' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(send).not.toHaveBeenCalled()
  })
  it('restores a draft after switching chats and focuses the editor after sending', async () => {
    const send = vi.fn().mockResolvedValue({})
    const composer = () => <App><ChatComposer projectId="p1" draftKey="draft:g1" recipients={[agent]} reply={null} onSend={send} onClearReply={vi.fn()} /></App>
    const view = render(composer())
    fireEvent.change(screen.getByLabelText('消息内容'), { target: { value: '还没写完的想法' } })
    view.unmount()
    render(composer())
    expect(screen.getByLabelText('消息内容')).toHaveValue('还没写完的想法')
    fireEvent.click(screen.getByRole('button', { name: /发送/ }))
    await waitFor(() => expect(screen.getByLabelText('消息内容')).toHaveValue(''))
    expect(sessionStorage.getItem('draft:g1')).toBeNull()
    await waitFor(() => expect(screen.getByLabelText('消息内容')).toHaveFocus())
  })
  it('accepts a pasted image as an attachment without sending an empty text message', () => {
    const send = show()
    fireEvent.paste(screen.getByLabelText('消息内容'), { clipboardData: { files: [new File(['image'], 'clipboard.png', { type: 'image/png' })] } })
    expect(screen.getByText('clipboard.png')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /发送/ })).toBeEnabled()
    expect(send).not.toHaveBeenCalled()
  })
})
