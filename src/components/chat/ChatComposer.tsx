import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Alert, App, Avatar, Button, Dropdown, Mentions, Tag, Upload } from 'antd'
import type { MenuProps } from 'antd'
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
const memberKey = (member: ChatMember) => `${member.memberType}:${member.id}`
interface Props {
  projectId: string
  reply: ChatMessage | null
  recipients: ChatMember[]
  onSend: (body: SendChatMessage) => Promise<unknown>
  onClearReply: () => void
  disabled?: boolean
  /** 输入被禁用时的原因，例如项目已归档、聊天还在加载。 */
  disabledHint?: string
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

export interface ChatComposerHandle {
  /** 从消息头像等处把某人 @ 进草稿：追加 @名字 并把它记入提及列表。 */
  mention: (member: ChatMember) => void
}

/** 输入状态留在编辑器，打字不会重新渲染历史消息列表。 */
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
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>(savedDraft.selected)
  const messageId = useRef(crypto.randomUUID())
  const inputRef = useRef<MentionsRef>(null)
  const locked = busy || disabled

  const insertMention = useCallback((member: ChatMember) => {
    const token = `@${member.displayName} `
    setDraft((prev) => (!prev ? token : /[ \n]$/.test(prev) ? prev + token : `${prev} ${token}`))
    setSelected((prev) => (prev.includes(memberKey(member)) ? prev : [...prev, memberKey(member)]))
    // 草稿变了就是新内容：换 clientMessageId，否则后端会按旧 ID 去重丢掉这条。
    messageId.current = crypto.randomUUID()
    setError(null)
    // 等受控文本更新后再定位光标，避免覆盖用户后续输入。
    requestAnimationFrame(() => {
      const textarea = inputRef.current?.nativeElement.querySelector('textarea')
      textarea?.focus({ preventScroll: true })
      const end = textarea?.value.length ?? 0
      textarea?.setSelectionRange(end, end)
    })
  }, [])
  useImperativeHandle(ref, () => ({ mention: insertMention }), [insertMention])

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

  const edit = useCallback(
    (value: string) => {
      setDraft(value)
      setSelected((current) =>
        current.filter((key) =>
          recipients.some(
            (item) => memberKey(item) === key && containsMention(value, item.displayName),
          ),
        ),
      )
      messageId.current = crypto.randomUUID()
      setError(null)
    },
    [recipients],
  )
  async function send() {
    if (locked || sending.current || (!draft.trim() && !attachments.length)) return
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
              selected.includes(memberKey(item)) && containsMention(draft, item.displayName),
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

  const mentionItems: MenuProps['items'] = recipients.map((item) => ({
    key: memberKey(item),
    label: (
      <span className="chat-composer__mention-target">
        <Avatar
          size={24}
          src={item.avatarUrl}
          icon={item.memberType === 'AGENT' ? <RobotOutlined /> : undefined}
        >
          {item.memberType === 'USER' ? item.displayName.slice(0, 1) : undefined}
        </Avatar>
        <span>{item.displayName}</span>
        <small>{item.memberType === 'AGENT' ? 'Agent' : '成员'}</small>
      </span>
    ),
  }))

  return (
    <div className="chat-composer" aria-busy={busy || undefined}>
      {reply && (
        <div className="chat-composer__reply">
          <div>
            <strong>回复 {reply.senderName || '成员'}</strong>
            <span>{chatMessageText(reply).slice(0, 140) || '点击查看原消息'}</span>
          </div>
          <Button
            type="text"
            aria-label="取消回复"
            disabled={busy}
            icon={<CloseOutlined />}
            onClick={onClearReply}
          />
        </div>
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
      {error && (
        <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} />
      )}
      <Mentions
        ref={inputRef}
        aria-label="消息内容"
        placeholder={disabled ? '暂时不能发送消息' : '写下想法，输入 @ 选择 Agent 或成员…'}
        value={draft}
        onChange={edit}
        autoSize={{ minRows: 1, maxRows: 7 }}
        placement="top"
        notFoundContent="没有匹配的 Agent 或成员"
        validateSearch={(text) => !/\s/.test(text)}
        options={recipients.map((item) => ({
          key: memberKey(item),
          memberKey: memberKey(item),
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
          const key: unknown = Reflect.get(option, 'memberKey')
          if (typeof key === 'string') setSelected((current) => [...new Set([...current, key])])
        }}
        onKeyDownCapture={(event) => {
          // 换行与输入法确认交给浏览器，避免被候选菜单当成选择操作。
          if (event.key === 'Enter' && (event.shiftKey || event.nativeEvent.isComposing))
            event.stopPropagation()
        }}
        disabled={locked}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData.files)
          if (!files.length || locked) return
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
      {disabled && disabledHint && (
        <p className="chat-composer__note" role="status">
          {disabledHint}
        </p>
      )}
      <div className="chat-composer__toolbar">
        <div className="chat-composer__tools">
          <Upload
            showUploadList={false}
            multiple
            disabled={locked}
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
              disabled={locked}
            >
              附件
            </Button>
          </Upload>
          <Dropdown
            trigger={['click']}
            rootClassName="chat-mention-menu"
            disabled={locked || !recipients.length}
            menu={{
              items: mentionItems,
              onClick: ({ key }) => {
                const member = recipients.find((item) => memberKey(item) === key)
                if (member) insertMention(member)
              },
            }}
          >
            <Button
              type="text"
              aria-label="提及成员"
              disabled={locked || !recipients.length}
              title="把成员 @ 进输入框"
            >
              <span aria-hidden="true">@</span> 提及
            </Button>
          </Dropdown>
        </div>
        <div className="chat-composer__send">
          <span className="chat-composer__hint" aria-hidden="true">
            Enter 发送 · Shift + Enter 换行
          </span>
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={busy}
            disabled={locked || (!draft.trim() && !attachments.length)}
            onClick={() => void send()}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  )
})
