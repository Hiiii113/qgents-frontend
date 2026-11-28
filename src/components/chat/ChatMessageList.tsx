import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ChatMember, ChatMessage } from '@/types/chat'
import { rootRunIdFromReply, type AgentRun } from '@/features/agent-runs'
import { Button, Icon } from '@/components/ui'
import { AgentRunRow, ChatMessageRow } from './ChatMessageRow'
import { buildChatEntries, groupRunsByRoot } from './agentRunRows'

interface Props {
  messages: ChatMessage[]
  projectId?: string
  currentUserId?: string
  participants?: ChatMember[]
  /** 该群 root + child 运行；按 rootRunId 归组后交给 Agent 消息行。 */
  runs: AgentRun[]
  agentNames?: Map<string, string>
  loading: boolean
  hasMore: boolean
  loadingOlder: boolean
  targetId: string | null
  /** 正在停止的触发消息 ID：运行卡与进行中行都按触发消息判定。 */
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

/**
 * 虚拟列表：消息、进行中的 Agent 行与运行卡一起参与动态高度。
 * 运行卡属于 Agent 消息行；没有最终消息的根运行紧跟在自己的触发消息后面。
 */
export const ChatMessageList = memo(function ChatMessageList(props: Props) {
  const { messages, targetId, onReadingLatestChange } = props
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
  // 成员列表给了名字就用它，私聊里只有对端 Agent，也靠这里补上名字。
  const agentNames = useMemo(() => {
    const names = new Map<string, string>()
    for (const member of props.participants ?? [])
      if (member.memberType === 'AGENT') names.set(member.id, member.displayName)
    for (const [id, name] of props.agentNames ?? []) names.set(id, name)
    return names
  }, [props.participants, props.agentNames])
  const agents = useMemo(
    () => (props.participants ?? []).filter((member) => member.memberType === 'AGENT').slice(0, 3),
    [props.participants],
  )
  const groups = useMemo(() => groupRunsByRoot(props.runs), [props.runs])
  const entries = useMemo(() => buildChatEntries(messages, groups), [messages, groups])
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

  const stopOf = (trigger: ChatMessage | undefined) =>
    trigger ? (props.canStop?.(trigger) ?? false) : false
  const stoppingOf = (triggerId: string | undefined) =>
    Boolean(triggerId) && props.stoppingMessageId === triggerId

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
    const index = entries.findIndex(
      (entry) => entry.kind === 'message' && entry.message.id === targetId,
    )
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
              const date = entry.kind === 'message' ? new Date(entry.message.createdAt) : null
              // 最终消息只认自己的根运行：运行卡挂在它上方，停止按钮仍指向触发消息。
              const group =
                entry.kind === 'message'
                  ? groups.get(rootRunIdFromReply(entry.message.clientMessageId) ?? '')
                  : undefined
              const trigger = group ? byId.get(group.triggerMessageId) : undefined
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
                  {entry.showDate && date ? (
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
                  {entry.kind === 'run' ? (
                    <AgentRunRow
                      group={entry.group}
                      agentName={agentNames.get(entry.group.runs[0]?.agentId ?? '')}
                      agentNames={agentNames}
                      trigger={byId.get(entry.group.triggerMessageId)}
                      canStop={stopOf(byId.get(entry.group.triggerMessageId))}
                      stopping={stoppingOf(entry.group.triggerMessageId)}
                      onStop={props.onStop}
                    />
                  ) : (
                    <ChatMessageRow
                      item={entry.message}
                      projectId={props.projectId}
                      currentUserId={props.currentUserId}
                      reply={
                        entry.message.replyToId ? byId.get(entry.message.replyToId) : undefined
                      }
                      sender={senders.get(
                        `${entry.message.senderType}:${entry.message.senderId}`,
                      )}
                      runs={group?.runs}
                      agentNames={agentNames}
                      trigger={trigger}
                      onReply={props.onReply}
                      onPreview={props.onPreview}
                      onLocate={props.onLocate}
                      onStop={props.onStop}
                      canStop={stopOf(trigger)}
                      stopping={stoppingOf(group?.triggerMessageId)}
                      located={props.targetId === entry.message.id}
                    />
                  )}
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
