import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { App } from 'antd'
import { attachmentApi, uploadAttachment } from '@/api/attachment'
import { formatApiError } from '@/utils/formatApiError'
import {
  chatMessageText,
  type ChatMember,
  type ChatMention,
  type ChatMessage,
  type SendChatMessage,
} from '@/types/chat'
import { Avatar, Button, Icon, IconButton, Tag } from '@/components/ui'

type Attachment = { id: string; file: File }

const memberKey = (member: ChatMember) => `${member.memberType}:${member.id}`

/** 昵称可重复：只有草稿里仍按独立词出现 @昵称，才把它算作这次提及。 */
function containsMention(text: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[\\s，。！？、,!?;；:：])@${escaped}(?=$|[\\s，。！？、,!?;；:：])`).test(
    text,
  )
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

interface MentionQuery {
  start: number
  term: string
  index: number
}

export interface ChatComposerHandle {
  /** 从成员列表等处把某人 @ 进草稿。 */
  mention: (member: ChatMember) => void
}

interface Props {
  projectId: string
  reply: ChatMessage | null
  recipients: ChatMember[]
  onSend: (body: SendChatMessage) => Promise<unknown>
  onClearReply: () => void
  disabled?: boolean
  disabledHint?: string
  draftKey?: string
}

/** 输入器：草稿、提及、附件都在这里自持，打字不重渲染历史消息。 */
export const ChatComposer = forwardRef<ChatComposerHandle, Props>(function ChatComposer(
  {
    projectId,
    reply,
    recipients,
    onSend,
    onClearReply,
    disabled = false,
    disabledHint,
    draftKey,
  }: Props,
  ref,
) {
  const { message } = App.useApp()
  const [savedDraft] = useState(() => readDraft(draftKey))
  const [draft, setDraft] = useState(savedDraft.text)
  const [selected, setSelected] = useState<string[]>(savedDraft.selected)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mention, setMention] = useState<MentionQuery | null>(null)
  const suppressed = useRef(false)
  const caret = useRef(0)
  const messageId = useRef(crypto.randomUUID())
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const locked = busy || disabled

  // 草稿与提及按用户+群保存，切换会话后继续编辑；附件需要重新选择。
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

  // 多行输入随内容长高，最多 168px。
  useEffect(() => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 168)}px`
  }, [draft])

  useEffect(() => {
    if (!busy && !disabled) textareaRef.current?.focus({ preventScroll: true })
  }, [busy, disabled])

  const previousReplyId = useRef(reply?.id)
  useEffect(() => {
    if (previousReplyId.current !== reply?.id) {
      messageId.current = crypto.randomUUID()
      previousReplyId.current = reply?.id
    }
    if (reply && !busy) textareaRef.current?.focus({ preventScroll: true })
  }, [reply, busy])

  const matches = useMemo(() => {
    if (!mention) return []
    const keyword = mention.term.trim().toLowerCase()
    return recipients
      .filter((member) => member.displayName.toLowerCase().includes(keyword))
      .slice(0, 8)
  }, [mention, recipients])

  function findMention(text: string, at: number): MentionQuery | null {
    const before = text.slice(0, at)
    const match = /@([^\s@]*)$/.exec(before)
    if (!match) return null
    return { start: at - match[0].length, term: match[1], index: 0 }
  }

  function resetId() {
    messageId.current = crypto.randomUUID()
  }

  function edit(value: string, at: number) {
    setDraft(value)
    setSelected((current) =>
      current.filter((key) =>
        recipients.some(
          (member) => memberKey(member) === key && containsMention(value, member.displayName),
        ),
      ),
    )
    if (suppressed.current) {
      suppressed.current = false
      setMention(null)
    } else {
      setMention(findMention(value, at))
    }
    caret.current = at
    setError(null)
  }

  const insertMention = useCallback(
    (member: ChatMember, query?: MentionQuery) => {
      const at = caret.current
      const start = query?.start ?? at
      const token = `@${member.displayName} `
      setDraft((previous) => previous.slice(0, start) + token + previous.slice(at))
      setSelected((previous) =>
        previous.includes(memberKey(member)) ? previous : [...previous, memberKey(member)],
      )
      setMention(null)
      resetId()
      setError(null)
      const nextCaret = start + token.length
      caret.current = nextCaret
      requestAnimationFrame(() => {
        const node = textareaRef.current
        node?.focus({ preventScroll: true })
        node?.setSelectionRange(nextCaret, nextCaret)
      })
    },
    [],
  )

  useImperativeHandle(
    ref,
    () => ({ mention: (member: ChatMember) => insertMention(member) }),
    [insertMention],
  )

  function addFiles(files: File[]) {
    if (!files.length || locked) return
    if (attachments.length + files.length > 10) {
      void message.info('每次最多添加 10 个附件')
      return
    }
    setAttachments((current) => [
      ...current,
      ...files.map((file) => ({ id: crypto.randomUUID(), file })),
    ])
  }

  const sending = useRef(false)
  async function send() {
    if (locked || sending.current || (!draft.trim() && !attachments.length)) return
    sending.current = true
    setBusy(true)
    setError(null)
    try {
      for (const item of attachments) {
        const attachmentId = await uploadAttachment(projectId, item.file)
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
              selected.includes(memberKey(item)) &&
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
      setDraft('')
      setSelected([])
      setMention(null)
      onClearReply()
      resetId()
    } catch (failure) {
      setError(formatApiError(failure))
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return
    if (mention) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (!matches.length) return
        const delta = event.key === 'ArrowDown' ? 1 : -1
        setMention({
          ...mention,
          index: (mention.index + delta + matches.length) % matches.length,
        })
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const target = matches[mention.index]
        if (target) insertMention(target, mention)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        suppressed.current = true
        setMention(null)
        return
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  return (
    <div className="composer" aria-busy={busy || undefined}>
      {reply ? (
        <div className="composer__reply">
          <div>
            <strong>回复 {reply.senderName || '成员'}</strong>
            <span>{chatMessageText(reply).slice(0, 140) || '点击查看原消息'}</span>
          </div>
          <IconButton label="取消回复" square disabled={busy} onClick={onClearReply}>
            <Icon name="close" size={14} />
          </IconButton>
        </div>
      ) : null}

      {attachments.length ? (
        <div className="composer__files">
          {attachments.map((item) => (
            <Tag key={item.id}>
              {item.file.name}
              {busy ? null : (
                <button
                  type="button"
                  className="tag__close"
                  aria-label={`移除 ${item.file.name}`}
                  onClick={() =>
                    setAttachments((current) => current.filter((file) => file.id !== item.id))
                  }
                >
                  <Icon name="close" size={11} />
                </button>
              )}
            </Tag>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}

      <div className="composer__box">
        <label className="sr" htmlFor="composer-input">
          消息内容
        </label>
        <textarea
          id="composer-input"
          ref={textareaRef}
          rows={1}
          value={draft}
          disabled={locked}
          placeholder={
            disabled ? '暂时不能发送消息' : '写下想法，输入 @ 选择 Agent 或成员…'
          }
          onChange={(event) => {
            const node = event.currentTarget
            edit(node.value, node.selectionStart ?? node.value.length)
          }}
          onSelect={(event) => {
            const node = event.currentTarget
            caret.current = node.selectionStart ?? 0
          }}
          onKeyDown={onKeyDown}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files)
            if (!files.length || locked) return
            event.preventDefault()
            addFiles(files)
          }}
        />
        <div className="composer__foot">
          <div className="composer__tools">
            <IconButton
              label="添加附件"
              square
              disabled={locked}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="paperclip" size={15} />
            </IconButton>
            <span className="meta">
              {disabled && disabledHint ? (
                disabledHint
              ) : (
                <>
                  <span className="composer__hint">Enter 发送 · Shift + Enter 换行</span>
                  <span className="composer__hint--touch">点按发送</span>
                </>
              )}
            </span>
          </div>
          <Button
            variant="primary"
            icon={<Icon name="send" size={15} aria-hidden />}
            disabled={locked || (!draft.trim() && !attachments.length)}
            onClick={() => void send()}
          >
            {busy ? '发送中…' : '发送'}
          </Button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />

      {mention && !locked ? (
        <div className="mention" role="listbox" aria-label="群成员">
          <p className="mention__title">群成员</p>
          {matches.length === 0 ? (
            <p className="mention__empty">没有匹配的成员。</p>
          ) : (
            <ul>
              {matches.map((member, index) => (
                <li key={memberKey(member)}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === mention.index}
                    className={`mention__item${index === mention.index ? ' is-active' : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertMention(member, mention)}
                  >
                    <Avatar
                      name={member.displayName}
                      src={member.avatarUrl}
                      type={member.memberType === 'AGENT' ? 'agent' : 'user'}
                      size="sm"
                    />
                    <span>{member.displayName}</span>
                    <span className="mention__kind">
                      {member.memberType === 'AGENT' ? 'Agent' : (member.email || '成员')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
})
