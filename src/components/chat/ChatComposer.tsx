import { useEffect, useRef, useState } from 'react'
import { Alert, App, Button, Input, Select, Tag, Upload } from 'antd'
import { CloseOutlined, PaperClipOutlined, SendOutlined } from '@ant-design/icons'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import { attachmentApi, uploadAttachment } from '@/api/attachment'
import { formatApiError } from '@/utils/formatApiError'
import { chatMessageText, type ChatMember, type ChatMention, type ChatMessage, type SendChatMessage } from '@/types/chat'

type Attachment = { id: string; file: File; attachmentId?: string }
interface Props {
  projectId: string
  reply: ChatMessage | null
  recipients: ChatMember[]
  onSend: (body: SendChatMessage) => Promise<unknown>
  onClearReply: () => void
  disabled?: boolean
  draftKey?: string
}

function readDraft(key?: string): { text: string; selected: string[] } {
  const empty = { text: '', selected: [] as string[] }
  if (!key) return empty
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(key) || 'null')
    if (!saved || typeof saved !== 'object') return empty
    const text: unknown = Reflect.get(saved, 'text')
    const selected: unknown = Reflect.get(saved, 'selected')
    return { text: typeof text === 'string' ? text : '',
      selected: Array.isArray(selected) ? selected.filter((id): id is string => typeof id === 'string') : [] }
  } catch { return empty }
}

/** 输入状态留在编辑器，打字不会重新渲染历史消息列表。 */
export function ChatComposer({ projectId, reply, recipients, onSend, onClearReply, disabled = false, draftKey }: Props) {
  const { message } = App.useApp()
  const [savedDraft] = useState(() => readDraft(draftKey))
  const [draft, setDraft] = useState(savedDraft.text)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>(savedDraft.selected)
  const messageId = useRef(crypto.randomUUID())
  const inputRef = useRef<TextAreaRef>(null)
  const sending = useRef(false)
  const previousReplyId = useRef(reply?.id)
  useEffect(() => {
    if (previousReplyId.current !== reply?.id) {
      messageId.current = crypto.randomUUID()
      previousReplyId.current = reply?.id
    }
    if (reply && !busy) inputRef.current?.focus({ preventScroll: true })
  }, [reply, busy])
  // 按用户和群聊保存文字与提及，切换会话后继续编辑；附件需重新选择。
  useEffect(() => {
    if (!draftKey) return
    try {
      if (draft || selected.length) sessionStorage.setItem(draftKey, JSON.stringify({ text: draft, selected }))
      else sessionStorage.removeItem(draftKey)
    } catch { /* 存储不可用时仍可正常聊天。 */ }
  }, [draftKey, draft, selected])
  useEffect(() => {
    if (!busy && !disabled) inputRef.current?.focus({ preventScroll: true })
  }, [busy, disabled])

  function edit(value: string) {
    setDraft(value)
    messageId.current = crypto.randomUUID()
    setError(null)
  }
  async function send() {
    if (disabled || sending.current || (!draft.trim() && !attachments.length)) return
    sending.current = true
    setBusy(true)
    setError(null)
    try {
      for (const item of attachments) {
        const attachmentId = item.attachmentId ?? await uploadAttachment(projectId, item.file)
        setAttachments(current => current.map(file => file.id === item.id ? { ...file, attachmentId } : file))
        await onSend({
          type: item.file.type.startsWith('image/') ? 'IMAGE' : 'FILE',
          content: { attachmentId, url: attachmentApi.contentUrl(projectId, attachmentId), name: item.file.name, size: item.file.size, mediaType: item.file.type },
          clientMessageId: item.id,
          replyToId: reply?.id,
        })
        setAttachments(current => current.filter(file => file.id !== item.id))
      }
      if (draft.trim()) {
        const mentions: ChatMention[] = recipients
          .filter(item => selected.includes(`${item.memberType}:${item.id}`) && draft.includes(`@${item.displayName}`))
          .map(item => ({ type: item.memberType, id: item.id }))
        await onSend({ type: 'TEXT', content: { text: draft.trim() }, mentions, replyToId: reply?.id, clientMessageId: messageId.current })
      }
      edit('')
      setSelected([])
      onClearReply()
    } catch (failure) { setError(formatApiError(failure)) }
    finally { sending.current = false; setBusy(false) }
  }

  return <div className="chat-composer">
    {reply && <div className="chat-composer__reply">
      <div><strong>回复 {reply.senderName || '成员'}</strong><span>{chatMessageText(reply).slice(0, 140)}</span></div>
      <Button type="text" size="small" aria-label="取消回复" disabled={busy} icon={<CloseOutlined />} onClick={onClearReply} />
    </div>}
    {error && <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} />}
    {attachments.length > 0 && <div className="chat-composer__files">{attachments.map(item =>
      <Tag key={item.id} closable={!busy} onClose={() => setAttachments(current => current.filter(file => file.id !== item.id))}>{item.file.name}</Tag>
    )}</div>}
    <Input.TextArea
      ref={inputRef}
      aria-label="消息内容" placeholder="写下想法，或选择 @Agent 一起完成工作…"
      value={draft} onChange={event => edit(event.target.value)} autoSize={{ minRows: 2, maxRows: 7 }}
      disabled={busy || disabled} onPaste={event => {
        const files = Array.from(event.clipboardData.files)
        if (!files.length || busy || disabled) return
        event.preventDefault()
        if (attachments.length + files.length > 10) { void message.info('每次最多添加 10 个附件'); return }
        setAttachments(current => [...current, ...files.map(file => ({ id: crypto.randomUUID(), file }))])
      }} onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault(); void send()
        }
      }}
    />
    <div className="chat-composer__toolbar">
      <div className="chat-composer__tools">
        <Upload showUploadList={false} multiple disabled={busy || disabled} beforeUpload={(file, files) => {
          if (attachments.length + files.length > 10) { void message.info('每次最多添加 10 个附件'); return Upload.LIST_IGNORE }
          setAttachments(current => [...current, { id: crypto.randomUUID(), file }])
          return false
        }}><Button type="text" aria-label="添加附件" icon={<PaperClipOutlined />} disabled={busy || disabled} /></Upload>
        <Select
          mode="multiple" aria-label="提及 Agent 或成员" placeholder="@ Agent / 成员" variant="borderless"
          value={selected} disabled={busy || disabled} maxTagCount={1} optionFilterProp="label"
          options={recipients.map(item => ({ value: `${item.memberType}:${item.id}`, label: `${item.displayName}${item.memberType === 'AGENT' ? ' · Agent' : ''}` }))}
          onChange={values => {
            setSelected(values)
            const added = values.filter(value => !selected.includes(value))
            const names = recipients.filter(item => added.includes(`${item.memberType}:${item.id}`)).map(item => `@${item.displayName} `)
            edit(draft + names.join(''))
          }}
        />
      </div>
      <div className="chat-composer__send"><span>Enter 发送 · Shift + Enter 换行</span>
        <Button type="primary" icon={<SendOutlined />} loading={busy} disabled={disabled || (!draft.trim() && !attachments.length)} onClick={() => void send()}>发送</Button>
      </div>
    </div>
    <p className="chat-composer__hint">普通消息只参与讨论；选择 @Agent 后，它会根据你的要求回答或开展工作。</p>
  </div>
}
