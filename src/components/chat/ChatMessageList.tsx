import { memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from 'antd'
import { ArrowDownOutlined } from '@ant-design/icons'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChatMessageRow } from './ChatMessageRow'
import type { ChatMember, ChatMessage } from '@/types/chat'

interface Props {
  messages: ChatMessage[]
  projectId?: string
  participants?: ChatMember[]
  loading: boolean
  hasMore: boolean
  loadingOlder: boolean
  currentUserId?: string
  targetId: string | null
  onLoadOlder: () => Promise<unknown>
  onReply: (item: ChatMessage) => void
  onPreview: (item: ChatMessage) => void
  onLocate: (id: string) => void
  onMention?: (member: ChatMember) => void
  onReadingLatestChange?: (reading: boolean) => void
  /** 在指定消息之后插入的临时内容（如 Agent 运行进度）：与消息一起参与虚拟化。 */
  afterMessage?: (item: ChatMessage) => ReactNode
}

/** 虚拟列表里的一行：真实消息，或挂在它后面的临时内容。 */
type Entry = {
  key: string
  message: ChatMessage
  showDate: boolean
  extra: ReactNode
  groupStart: boolean
  groupEnd: boolean
}

/** 同一发送者 5 分钟内的连续发言算一组；跨天不合并。 */
const GROUP_WINDOW_MS = 5 * 60 * 1000

function continuesGroup(previous: ChatMessage, next: ChatMessage) {
  if (previous.senderType === 'SYSTEM' || next.senderType === 'SYSTEM') return false
  if (previous.senderId !== next.senderId || previous.senderType !== next.senderType) return false
  const before = new Date(previous.createdAt)
  const after = new Date(next.createdAt)
  if (Number.isNaN(before.getTime()) || Number.isNaN(after.getTime())) return false
  if (before.toDateString() !== after.toDateString()) return false
  return after.getTime() - before.getTime() <= GROUP_WINDOW_MS
}

export const ChatMessageList = memo(function ChatMessageList(props: Props) {
  const { messages, targetId, onReadingLatestChange, afterMessage } = props
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const anchor = useRef<{ id: string; offset: number } | null>(null)
  const locatedId = useRef<string | null>(null)
  const [awayFromBottom, setAwayFromBottom] = useState(false)
  const [seenSequence, setSeenSequence] = useState(0)
  const byId = useMemo(() => new Map(messages.map((item) => [item.id, item])), [messages])
  const senders = useMemo(
    () =>
      new Map(props.participants?.map((member) => [`${member.memberType}:${member.id}`, member])),
    [props.participants],
  )
  // 临时运行进度作为单独一行插在触发消息后面，和消息一起参与虚拟化。
  const entries = useMemo<Entry[]>(() => {
    const rows: Entry[] = []
    messages.forEach((message, index) => {
      const previousDate = index > 0 ? new Date(messages[index - 1].createdAt) : null
      const date = new Date(message.createdAt)
      const showDate =
        !Number.isNaN(date.getTime()) && date.toDateString() !== previousDate?.toDateString()
      rows.push({
        key: message.id,
        message,
        showDate,
        extra: null,
        groupStart: index === 0 || !continuesGroup(messages[index - 1], message),
        groupEnd: index === messages.length - 1 || !continuesGroup(message, messages[index + 1]),
      })
      const extra = afterMessage?.(message)
      if (extra)
        rows.push({
          key: `${message.id}:runs`,
          message,
          showDate: false,
          extra,
          groupStart: false,
          groupEnd: false,
        })
    })
    return rows
  }, [messages, afterMessage])
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => entries[index].key,
    estimateSize: () => 132,
    overscan: 8,
    useFlushSync: false,
    initialRect: { width: 900, height: 600 },
  })
  const latestId = messages.at(-1)?.id
  const latestSequence = messages.at(-1)?.sequence ?? 0
  const newMessages = awayFromBottom
    ? messages.filter((item) => (item.sequence ?? 0) > seenSequence).length
    : 0
  const totalSize = virtualizer.getTotalSize()
  useLayoutEffect(() => {
    if (anchor.current) {
      const index = entries.findIndex((entry) => entry.key === anchor.current?.id)
      if (index >= 0) {
        const offset = anchor.current.offset
        virtualizer.scrollToIndex(index, { align: 'start' })
        if (scrollRef.current) scrollRef.current.scrollTop += offset
      }
      anchor.current = null
    } else if (stickToBottom.current && entries.length) {
      virtualizer.scrollToIndex(entries.length - 1, { align: 'end' })
    }
  }, [latestId, entries, virtualizer, totalSize])
  useLayoutEffect(() => {
    if (!targetId) {
      locatedId.current = null
      return
    }
    if (locatedId.current === targetId) return
    const index = entries.findIndex((entry) => entry.message.id === targetId)
    if (index >= 0) {
      stickToBottom.current = false
      setAwayFromBottom(true)
      setSeenSequence(latestSequence)
      onReadingLatestChange?.(false)
      locatedId.current = targetId
      virtualizer.scrollToIndex(index, { align: 'center' })
    }
  }, [targetId, onReadingLatestChange, entries, virtualizer, latestSequence])

  async function loadOlder() {
    if (props.loadingOlder) return
    const top = virtualizer
      .getVirtualItems()
      .find((item) => item.end >= (scrollRef.current?.scrollTop ?? 0))
    if (top)
      anchor.current = {
        id: entries[top.index].key,
        offset: (scrollRef.current?.scrollTop ?? 0) - top.start,
      }
    stickToBottom.current = false
    setAwayFromBottom(true)
    setSeenSequence(latestSequence)
    props.onReadingLatestChange?.(false)
    try {
      await props.onLoadOlder()
    } catch {
      anchor.current = null
    }
  }
  function jumpToBottom() {
    stickToBottom.current = true
    setAwayFromBottom(false)
    props.onReadingLatestChange?.(true)
    if (entries.length) virtualizer.scrollToIndex(entries.length - 1, { align: 'end' })
  }
  return (
    <div className="chat-timeline">
      {props.hasMore && (
        <div className="chat-timeline__history">
          <Button type="text" loading={props.loadingOlder} onClick={() => void loadOlder()}>
            加载更早消息
          </Button>
        </div>
      )}
      <div
        className="chat-timeline__scroll"
        ref={scrollRef}
        aria-label="聊天消息"
        role="log"
        aria-live="polite"
        onScroll={(event) => {
          const element = event.currentTarget
          const away = element.scrollHeight - element.scrollTop - element.clientHeight > 100
          stickToBottom.current = !away
          if (away !== awayFromBottom) {
            setAwayFromBottom(away)
            if (away) setSeenSequence(latestSequence)
            props.onReadingLatestChange?.(!away)
          }
        }}
      >
        {props.loading ? (
          <div className="chat-timeline__empty" role="status">
            <p className="chat-timeline__empty-text">正在加载消息…</p>
          </div>
        ) : !messages.length ? (
          <div className="chat-timeline__empty">
            <p className="chat-timeline__empty-title">还没有消息</p>
            <p className="chat-timeline__empty-text">
              在下面写下第一句，或者用 @ 提到 Agent
              让它开始干活。群聊内容会按天分组，长期有效的信息会自动进入群记忆。
            </p>
          </div>
        ) : (
          <div
            className="chat-timeline__virtual"
            style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((row) => {
              const entry = entries[row.index]
              const item = entry.message
              if (entry.extra)
                return (
                  <div
                    key={row.key}
                    data-index={row.index}
                    ref={virtualizer.measureElement}
                    className="chat-timeline__row chat-timeline__row--runs"
                    style={{
                      position: 'absolute',
                      width: '100%',
                      top: 0,
                      left: 0,
                      transform: `translateY(${row.start}px)`,
                    }}
                  >
                    {entry.extra}
                  </div>
                )
              const date = new Date(item.createdAt)
              return (
                <div
                  key={row.key}
                  data-index={row.index}
                  ref={virtualizer.measureElement}
                  className={
                    props.targetId === item.id
                      ? 'chat-timeline__row is-located'
                      : 'chat-timeline__row'
                  }
                  style={{
                    position: 'absolute',
                    width: '100%',
                    top: 0,
                    left: 0,
                    transform: `translateY(${row.start}px)`,
                  }}
                >
                  {entry.showDate && (
                    <div className="chat-timeline__date">
                      {date.toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </div>
                  )}
                  <ChatMessageRow
                    item={item}
                    projectId={props.projectId}
                    reply={item.replyToId ? byId.get(item.replyToId) : undefined}
                    sender={senders.get(`${item.senderType}:${item.senderId}`)}
                    currentUserId={props.currentUserId}
                    onReply={props.onReply}
                    onPreview={props.onPreview}
                    onLocate={props.onLocate}
                    onMention={props.onMention}
                    groupStart={entry.groupStart}
                    groupEnd={entry.groupEnd}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
      {awayFromBottom && (
        <Button
          className="chat-timeline__latest"
          icon={<ArrowDownOutlined />}
          onClick={jumpToBottom}
        >
          {newMessages ? `${newMessages} 条新消息` : '回到最新'}
        </Button>
      )}
    </div>
  )
})
