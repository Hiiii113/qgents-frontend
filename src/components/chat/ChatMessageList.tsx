import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button, Empty, Spin } from 'antd'
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
  isAdmin: boolean
  stoppingId?: string
  stoppedIds: ReadonlySet<string>
  targetId: string | null
  onLoadOlder: () => Promise<unknown>
  onReply: (item: ChatMessage) => void
  onStop: (item: ChatMessage) => void
  onPreview: (item: ChatMessage) => void
  onLocate: (id: string) => void
  onReadingLatestChange?: (reading: boolean) => void
}

export const ChatMessageList = memo(function ChatMessageList(props: Props) {
  const { messages, targetId, onReadingLatestChange } = props
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
  const replies = useMemo(() => {
    const completed = new Map<string, Set<string>>()
    for (const item of messages) {
      if (item.senderType !== 'AGENT' || !item.replyToId || !item.senderId) continue
      const agents = completed.get(item.replyToId) ?? new Set<string>()
      agents.add(item.senderId)
      completed.set(item.replyToId, agents)
    }
    return completed
  }, [messages])
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => messages[index].id,
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
      const index = messages.findIndex((item) => item.id === anchor.current?.id)
      if (index >= 0) {
        const offset = anchor.current.offset
        virtualizer.scrollToIndex(index, { align: 'start' })
        if (scrollRef.current) scrollRef.current.scrollTop += offset
      }
      anchor.current = null
    } else if (stickToBottom.current && messages.length) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end' })
    }
  }, [latestId, messages, virtualizer, totalSize])
  useLayoutEffect(() => {
    if (!targetId) {
      locatedId.current = null
      return
    }
    if (locatedId.current === targetId) return
    const index = messages.findIndex((item) => item.id === targetId)
    if (index >= 0) {
      stickToBottom.current = false
      setAwayFromBottom(true)
      setSeenSequence(latestSequence)
      onReadingLatestChange?.(false)
      locatedId.current = targetId
      virtualizer.scrollToIndex(index, { align: 'center' })
    }
  }, [targetId, onReadingLatestChange, messages, virtualizer, latestSequence])

  async function loadOlder() {
    if (props.loadingOlder) return
    const top = virtualizer
      .getVirtualItems()
      .find((item) => item.end >= (scrollRef.current?.scrollTop ?? 0))
    if (top)
      anchor.current = {
        id: messages[top.index].id,
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
    if (messages.length) virtualizer.scrollToIndex(messages.length - 1, { align: 'end' })
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
          <div className="chat-timeline__empty">
            <Spin delay={180} />
          </div>
        ) : !messages.length ? (
          <div className="chat-timeline__empty">
            <Empty description="从一个想法开始讨论" />
          </div>
        ) : (
          <div
            className="chat-timeline__virtual"
            style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((row) => {
              const item = messages[row.index]
              const date = new Date(item.createdAt)
              const previousDate =
                row.index > 0 ? new Date(messages[row.index - 1].createdAt) : null
              const showDate =
                !Number.isNaN(date.getTime()) &&
                date.toDateString() !== previousDate?.toDateString()
              const canStop =
                item.senderType === 'USER' &&
                (item.senderId === props.currentUserId || props.isAdmin) &&
                Boolean(
                  item.mentions?.some(
                    (mention) => mention.type === 'AGENT' && !replies.get(item.id)?.has(mention.id),
                  ),
                ) &&
                !props.stoppedIds.has(item.id)
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
                  {showDate && (
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
                    canStop={canStop}
                    stopping={props.stoppingId === item.id}
                    onReply={props.onReply}
                    onStop={props.onStop}
                    onPreview={props.onPreview}
                    onLocate={props.onLocate}
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
          shape="round"
          icon={<ArrowDownOutlined />}
          onClick={jumpToBottom}
        >
          {newMessages ? `${newMessages} 条新消息` : '回到最新'}
        </Button>
      )}
    </div>
  )
})
