import { useEffect, useRef, useState } from 'react'
import { Alert, App, Avatar, Button, Mentions, Tag, Upload } from 'antd'
import { CloseOutlined, PaperClipOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons'
import type { MentionsRef } from 'antd/es/mentions'
import { attachmentApi, uploadAttachment } from '@/api/attachment'
import { formatApiError } from '@/utils/formatApiError'
import {
  chatMessageText,
  type ChatMember,
  type ChatMention,
  type ChatMessage,
  type SendChatMessage,
} from '@/types/chat'

type Attachment = { id: string; file: File; attachmentId?: string }
function containsMention(text: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[\\s，。！？、,!?;；:：])@${escaped}(?=$|[\\s，。！？、,!?;；:：])`).test(
    text,
  )
}
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
    return {
      text: typeof text === 'string' ? text : '',
      selected: Array.isArray(selected)
        ? selected.filter((id): id is string => typeof id === 'string')
        : [],
    }
  } catch {
    return empty
  }
}

/** 输入状态留在编辑器，打字不会重新渲染历史消息列表。 */
export function ChatComposer({
  projectId,
  reply,
  recipients,
  onSend,
  onClearReply,
  disabled = false,
  draftKey,
}: Props) {
  const { message } = App.useApp()
  const [savedDraft] = useState(() => readDraft(draftKey))
  const [draft, setDraft] = useState(savedDraft.text)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>(savedDraft.selected)
  const messageId = useRef(crypto.randomUUID())
  const inputRef = useRef<MentionsRef>(null)
  const sending = useRef(false)
  const previousReplyId = useRef(reply?.id)
  useEffect(() => {
    if (previousReplyId.current !== reply?.id) {
      messageId.current = crypto.randomUUID()
      previousReplyId.current = reply?.id
    }
    if (reply && !busy)
      inputRef.current?.nativeElement.querySelector('textarea')?.focus({ preventScroll: true })
  }, [reply, busy])
  // 按用户和群聊保存文字与提及，切换会话后继续编辑；附件需重新选择。
  useEffect(() => {
    if (!draftKey) return
    try {
      if (draft || selected.length)
        sessionStorage.setItem(draftKey, JSON.stringify({ text: draft, selected }))
      else sessionStorage.removeItem(draftKey)
    } catch {
      /* 存储不可用时仍可正常聊天。 */
    }
  }, [draftKey, draft, selected])
  useEffect(() => {
    if (!busy && !disabled)
      inputRef.current?.nativeElement.querySelector('textarea')?.focus({ preventScroll: true })
  }, [busy, disabled])

  function edit(value: string) {
    setDraft(value)
    setSelected((current) =>
      current.filter((key) =>
        recipients.some(
          (item) =>
            `${item.memberType}:${item.id}` === key && containsMention(value, item.displayName),
        ),
      ),
    )
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
        const attachmentId = item.attachmentId ?? (await uploadAttachment(projectId, item.file))
        setAttachments((current) =>
          current.map((file) => (file.id === item.id ? { ...file, attachmentId } : file)),
        )
        await onSend({
          type: item.file.type.startsWith('image/') ? 'IMAGE' : 'FILE',
          content: {
            attachmentId,
            url: attachmentApi.contentUrl(projectId, attachmentId),
            name: item.file.name,
            size: item.file.size,
            mediaType: item.file.type,
          },
          clientMessageId: item.id,
          replyToId: reply?.id,
        })
        setAttachments((current) => current.filter((file) => file.id !== item.id))
      }
      if (draft.trim()) {
        const mentions: ChatMention[] = recipients
          .filter(
            (item) =>
              selected.includes(`${item.memberType}:${item.id}`) &&
              containsMention(draft, item.displayName),
          )
          .map((item) => ({ type: item.memberType, id: item.id }))
        await onSend({
          type: 'TEXT',
          content: { text: draft.trim() },
          mentions,
          replyToId: reply?.id,
          clientMessageId: messageId.current,
        })
      }
      edit('')
      setSelected([])
      onClearReply()
    } catch (failure) {
      setError(formatApiError(failure))
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  return (
    <div className="chat-composer">
      {reply && (
        <div className="chat-composer__reply">
          <div>
            <strong>回复 {reply.senderName || '成员'}</strong>
            <span>{chatMessageText(reply).slice(0, 140)}</span>
          </div>
          <Button
            type="text"
            size="small"
            aria-label="取消回复"
            disabled={busy}
            icon={<CloseOutlined />}
            onClick={onClearReply}
          />
        </div>
      )}
      {error && (
        <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} />
      )}
      {attachments.length > 0 && (
        <div className="chat-composer__files">
          {attachments.map((item) => (
            <Tag
              key={item.id}
              closable={!busy}
              onClose={() =>
                setAttachments((current) => current.filter((file) => file.id !== item.id))
              }
            >
              {item.file.name}
            </Tag>
          ))}
        </div>
      )}
      <Mentions
        ref={inputRef}
        aria-label="消息内容"
        placeholder="写下想法，输入 @ 选择 Agent 或成员…"
        value={draft}
        onChange={edit}
        autoSize={{ minRows: 2, maxRows: 7 }}
        placement="top"
        notFoundContent="没有匹配的 Agent 或成员"
        validateSearch={(text) => !/\s/.test(text)}
        options={recipients.map((item) => ({
          key: `${item.memberType}:${item.id}`,
          memberKey: `${item.memberType}:${item.id}`,
          value: item.displayName,
          label: (
            <span className="chat-mention-option">
              <Avatar
                size={28}
                src={item.avatarUrl}
                icon={item.memberType === 'AGENT' ? <RobotOutlined /> : undefined}
              >
                {item.memberType === 'USER' ? item.displayName.slice(0, 1) : undefined}
              </Avatar>
              <span>
                {item.displayName}
                <small>{item.memberType === 'AGENT' ? 'Agent' : item.email || '成员'}</small>
              </span>
            </span>
          ),
        }))}
        onSelect={(option) => {
          // 昵称可重复，选项单独携带成员 ID，发送时不靠昵称推断对象。
          const memberKey: unknown = Reflect.get(option, 'memberKey')
          if (typeof memberKey === 'string')
            setSelected((current) => [...new Set([...current, memberKey])])
        }}
        onKeyDownCapture={(event) => {
          // 换行与输入法确认交给浏览器，避免被候选菜单当成选择操作。
          if (event.key === 'Enter' && (event.shiftKey || event.nativeEvent.isComposing))
            event.stopPropagation()
        }}
        disabled={busy || disabled}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData.files)
          if (!files.length || busy || disabled) return
          event.preventDefault()
          if (attachments.length + files.length > 10) {
            void message.info('每次最多添加 10 个附件')
            return
          }
          setAttachments((current) => [
            ...current,
            ...files.map((file) => ({ id: crypto.randomUUID(), file })),
          ])
        }}
        onPressEnter={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            void send()
          }
        }}
      />
      <div className="chat-composer__toolbar">
        <div className="chat-composer__tools">
          <Upload
            showUploadList={false}
            multiple
            disabled={busy || disabled}
            beforeUpload={(file, files) => {
              if (attachments.length + files.length > 10) {
                void message.info('每次最多添加 10 个附件')
                return Upload.LIST_IGNORE
              }
              setAttachments((current) => [...current, { id: crypto.randomUUID(), file }])
              return false
            }}
          >
            <Button
              type="text"
              aria-label="添加附件"
              icon={<PaperClipOutlined />}
              disabled={busy || disabled}
            />
          </Upload>
        </div>
        <div className="chat-composer__send">
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={busy}
            disabled={disabled || (!draft.trim() && !attachments.length)}
            onClick={() => void send()}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  )
}
