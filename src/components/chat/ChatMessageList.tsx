import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ChatMember, ChatMessage } from '@/types/chat'
import type { AgentRun } from '@/features/agent-runs/types'
import { Button, Icon } from '@/components/ui'
import { ChatMessageRow } from './ChatMessageRow'

interface Props {
  messages: ChatMessage[]
  projectId?: string
  participants?: ChatMember[]
  runsByMessage: Map<string, AgentRun[]>
  agentNames?: Map<string, string>
  loading: boolean
  hasMore: boolean
  loadingOlder: boolean
  targetId: string | null
  stoppingMessageId?: string
  canStop?: (item: ChatMessage) => boolean
  onLoadOlder: () => Promise<unknown>
  onReply: (item: ChatMessage) => void
  onPreview: (item: ChatMessage) => void
  onLocate: (id: string) => void
  onStop: (item: ChatMessage) => void
  onMention?: (member: ChatMember) => void
  onReadingLatestChange?: (reading: boolean) => void
  /** 私聊与群聊的空态说明不同，默认按群聊写。 */
  emptyTitle?: string
  emptyDescription?: string
}

interface Entry {
  key: string
  message: ChatMessage
  showDate: boolean
}

/** 虚拟列表：消息与挂在它下面的运行卡一起参与动态高度。 */
export const ChatMessageList = memo(function ChatMessageList(props: Props) {
  const { messages, targetId, runsByMessage, onReadingLatestChange } = props
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const anchor = useRef<{ id: string; offset: number } | null>(null)
  const locatedId = useRef<string | null>(null)
  const [awayFromBottom, setAwayFromBottom] = useState(false)
  const [seenSequence, setSeenSequence] = useState(0)
  const loadingOlderRef = useRef(false)
  const byId = useMemo(() => new Map(messages.map((item) => [item.id, item])), [messages])
  const senders = useMemo(
    () =>
      new Map(
        (props.participants ?? []).map((member) => [`${member.memberType}:${member.id}`, member]),
      ),
    [props.participants],
  )
  const agents = useMemo(
    () => (props.participants ?? []).filter((member) => member.memberType === 'AGENT').slice(0, 3),
    [props.participants],
  )
  const entries = useMemo<Entry[]>(() => {
    return messages.map((message, index) => {
      const previous = index > 0 ? new Date(messages[index - 1].createdAt) : null
      const date = new Date(message.createdAt)
      return {
        key: message.id,
        message,
        showDate:
          !Number.isNaN(date.getTime()) && date.toDateString() !== previous?.toDateString(),
      }
    })
  }, [messages])
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => entries[index].key,
    estimateSize: () => 120,
    overscan: 8,
    useFlushSync: false,
    initialRect: { width: 900, height: 600 },
  })
  const latestId = messages.at(-1)?.id
  const latestSequence = messages.at(-1)?.sequence ?? 0
  const totalSize = virtualizer.getTotalSize()
  const newMessages = awayFromBottom
    ? messages.filter((item) => (item.sequence ?? 0) > seenSequence).length
    : 0

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
    <div className="chatlog-wrap" role="log" aria-label="聊天消息" aria-live="polite">
      <div
        className="chatlog"
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget
          const away = element.scrollHeight - element.scrollTop - element.clientHeight > 100
          stickToBottom.current = !away
          if (away !== awayFromBottom) {
            setAwayFromBottom(away)
            if (away) setSeenSequence(latestSequence)
            props.onReadingLatestChange?.(!away)
          }
          if (
            element.scrollTop <= 32 &&
            props.hasMore &&
            !loadingOlderRef.current &&
            element.scrollHeight > element.clientHeight
          ) {
            loadingOlderRef.current = true
            void loadOlder().finally(() => {
              loadingOlderRef.current = false
            })
          }
        }}
      >
        {props.loadingOlder ? (
          <div className="chatlog__history" role="status">
            正在加载更早消息…
          </div>
        ) : null}
        {props.loading ? (
          <div className="chatlog__history">正在加载消息…</div>
        ) : !messages.length ? (
          <div className="chatlog__empty">
            <p className="chatlog__empty-title">{props.emptyTitle ?? '还没有消息'}</p>
            <p className="chatlog__empty-desc">
              {props.emptyDescription ??
                '在下面写下第一句，或者 @ 一个 Agent 让它开始干活。普通消息不会唤起 Agent，只有明确提到才触发。'}
            </p>
            {agents.length && props.onMention ? (
              <div className="row row--tight">
                {agents.map((agent) => (
                  <Button
                    key={agent.id}
                    variant="quiet"
                    size="sm"
                    onClick={() => props.onMention?.(agent)}
                  >
                    @ {agent.displayName}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ height: totalSize, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((row) => {
              const entry = entries[row.index]
              const item = entry.message
              const date = new Date(item.createdAt)
              return (
                <div
                  key={row.key}
                  data-index={row.index}
                  ref={virtualizer.measureElement}
                  className="chatlog__row"
                  style={{
                    position: 'absolute',
                    width: '100%',
                    top: 0,
                    left: 0,
                    transform: `translateY(${row.start}px)`,
                  }}
                >
                  {entry.showDate ? (
                    <p className="daybreak">
                      <span>
                        {date.toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          weekday: 'short',
                        })}
                      </span>
                    </p>
                  ) : null}
                  <ChatMessageRow
                    item={item}
                    projectId={props.projectId}
                    reply={item.replyToId ? byId.get(item.replyToId) : undefined}
                    sender={senders.get(`${item.senderType}:${item.senderId}`)}
                    runs={runsByMessage.get(item.id)}
                    agentNames={props.agentNames}
                    onReply={props.onReply}
                    onPreview={props.onPreview}
                    onLocate={props.onLocate}
                    onStop={props.onStop}
                    canStop={props.canStop?.(item) ?? false}
                    stopping={props.stoppingMessageId === item.id}
                    located={props.targetId === item.id}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
      {awayFromBottom ? (
        <div className="chatlog__jump">
          <button type="button" className="jump-latest" onClick={jumpToBottom}>
            <Icon name="chevron" size={14} aria-hidden />
            回到最新
            {newMessages > 0 ? <span className="tag">{newMessages}</span> : null}
          </button>
        </div>
      ) : null}
    </div>
  )
})
