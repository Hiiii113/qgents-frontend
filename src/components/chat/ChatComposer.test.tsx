import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChatComposer } from './ChatComposer'
import type { ChatMember, ChatMessage, SendChatMessage } from '@/types/chat'
afterEach(() => { cleanup(); sessionStorage.clear(); vi.restoreAllMocks() })
const agent = { id: 'a1', displayName: '助手', memberType: 'AGENT' as const }
function show(send = vi.fn<(body: SendChatMessage) => Promise<unknown>>().mockResolvedValue({}), reply: ChatMessage | null = null, recipients: ChatMember[] = [agent]) {
  render(<App><ChatComposer projectId="p1" recipients={recipients} reply={reply} onSend={send} onClearReply={vi.fn()} /></App>)
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

  it('searches recipients after typing @ and sends the selected Agent id', async () => {
    const send = show(undefined, null, [agent, { id: 'u2', displayName: '张工', memberType: 'USER' }])
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('消息内容'), '@助')
    await user.click(await screen.findByRole('menuitem', { name: /助手/ }))
    expect(screen.getByLabelText('消息内容')).toHaveValue('@助手 ')
    await user.type(screen.getByLabelText('消息内容'), '分析一下')
    await user.click(screen.getByRole('button', { name: /发送/ }))
    await waitFor(() => expect(send).toHaveBeenCalledOnce())
    expect(send.mock.calls[0][0]).toMatchObject({ content: { text: '@助手 分析一下' }, mentions: [{ type: 'AGENT', id: 'a1' }] })
  })

  it('uses arrows and Enter to choose a mention without sending the message', async () => {
    const send = show(undefined, null, [{ id: 'u2', displayName: '张工', memberType: 'USER' }, agent])
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('消息内容'), '@')
    await screen.findByRole('menuitem', { name: /助手/ })
    const input = screen.getByLabelText('消息内容')
    // Mentions 使用浏览器 KeyboardEvent.which；jsdom 的 userEvent 默认不填该值。
    fireEvent.keyDown(input, { key: 'ArrowDown', which: 40, keyCode: 40 })
    fireEvent.keyDown(input, { key: 'Enter', which: 13, keyCode: 13 })
    expect(send).not.toHaveBeenCalled()
    expect(screen.getByLabelText('消息内容')).toHaveValue('@助手 ')
    fireEvent.keyDown(input, { key: 'Enter', which: 13, keyCode: 13 })
    await waitFor(() => expect(send).toHaveBeenCalledOnce())
    expect(send.mock.calls[0][0].mentions).toEqual([{ type: 'AGENT', id: 'a1' }])
  })

  it('does not select a candidate on Shift Enter or IME confirmation', async () => {
    const send = show()
    const user = userEvent.setup()
    const input = screen.getByLabelText('消息内容')
    await user.type(input, '@')
    await screen.findByRole('menuitem', { name: /助手/ })
    fireEvent.keyDown(input, { key: 'Enter', which: 13, keyCode: 13, shiftKey: true })
    fireEvent.keyDown(input, { key: 'Enter', which: 13, keyCode: 13, isComposing: true })
    expect(input).toHaveValue('@')
    expect(send).not.toHaveBeenCalled()
  })

  it('distinguishes a member from an Agent with the same nickname', async () => {
    const send = show(undefined, null, [agent, { id: 'u2', displayName: '助手', memberType: 'USER' }])
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('消息内容'), '@')
    await user.click(await screen.findByRole('menuitem', { name: /成员/ }))
    await user.click(screen.getByRole('button', { name: /发送/ }))
    await waitFor(() => expect(send).toHaveBeenCalledOnce())
    expect(send.mock.calls[0][0].mentions).toEqual([{ type: 'USER', id: 'u2' }])
  })

  it('does not trigger an Agent from typed or removed mention text', async () => {
    const send = show()
    const user = userEvent.setup()
    const input = screen.getByLabelText('消息内容')
    await user.type(input, '@')
    await user.click(await screen.findByRole('menuitem', { name: /助手/ }))
    fireEvent.change(input, { target: { value: '@助手2 普通讨论' } })
    await user.click(screen.getByRole('button', { name: /发送/ }))
    await waitFor(() => expect(send).toHaveBeenCalledOnce())
    expect(send.mock.calls[0][0].mentions).toEqual([])
    fireEvent.change(input, { target: { value: '@助手 直接打字' } })
    await user.click(screen.getByRole('button', { name: /发送/ }))
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2))
    expect(send.mock.calls[1][0].mentions).toEqual([])
  })
})
