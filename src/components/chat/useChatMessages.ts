import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import { chatApi } from '@/api/chat'
import { directMessageApi } from '@/api/directMessage'
import { subscribeRealtimeReconnect } from '@/realtime/realtimeClient'
import type { Page } from '@/types/api'
import type { ChatMessage, SendChatMessage } from '@/types/chat'

import { chatKeys } from '@/query/chatKeys'
export { chatKeys } from '@/query/chatKeys'
type MessagePages = InfiniteData<Page<ChatMessage>, string | undefined>

/** 增量消息并入最新页；按 ID 去重，历史游标保持原样。 */
export function mergeChatMessages(
  data: MessagePages | undefined,
  incoming: ChatMessage[],
): MessagePages | undefined {
  if (!data || !incoming.length) return data
  const replacements = new Map(incoming.map((item) => [item.id, item]))
  const known = new Set(data.pages.flatMap((page) => page.data.map((item) => item.id)))
  const added = [...replacements.values()].filter((item) => !known.has(item.id))
  return {
    ...data,
    pages: data.pages.map((page, index) => ({
      ...page,
      data: [
        ...(index === 0 ? added : []),
        ...page.data.map((item) => replacements.get(item.id) ?? item),
      ].sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0)),
    })),
  }
}

/**
 * 一个会话的消息来源：群聊和私聊只是路径不同，分页、增量补齐、已读与发送的处理一致。
 * 缓存键必须带上会话归属，切换会话时旧数据留在旧键里，不会串到新会话。
 */
export interface ChatMessageSource {
  key: readonly unknown[]
  /** 会话列表缓存：发送与已读后失效，让列表上的预览与未读跟上。 */
  listKey?: readonly unknown[]
  enabled: boolean
  fetchPage(cursor: string | undefined, signal?: AbortSignal): Promise<Page<ChatMessage>>
  fetchIncremental(afterSequence: number, signal?: AbortSignal): Promise<Page<ChatMessage>>
  send(body: SendChatMessage): Promise<ChatMessage>
  markRead(): Promise<unknown>
  /** 实时事件是否属于当前会话。 */
  matches(detail: Record<string, unknown>): boolean
}

function useConversationMessages(source: ChatMessageSource, readingLatest = true) {
  const client = useQueryClient()
  const [syncError, setSyncError] = useState<Error | null>(null)
  const { key } = source
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) => source.fetchPage(pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) =>
      page.page.hasMore ? (page.page.nextCursor ?? undefined) : undefined,
    enabled: source.enabled,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
  })
  const messages = useMemo(() => {
    const unique = new Map<string, ChatMessage>()
    for (const page of query.data?.pages ?? [])
      for (const item of page.data) unique.set(item.id, item)
    return [...unique.values()].sort(
      (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.createdAt.localeCompare(b.createdAt),
    )
  }, [query.data])
  const latestSequence = messages.at(-1)?.sequence ?? 0
  const sequenceRef = useRef<number | null>(null)
  useEffect(() => {
    sequenceRef.current = null
    setSyncError(null)
  }, [key])
  // 发送响应可能先于其他人的消息到达，不能拿它推进增量游标而跳过中间序号。
  useEffect(() => {
    if (sequenceRef.current === null && query.isSuccess) sequenceRef.current = latestSequence
  }, [key, latestSequence, query.isSuccess])

  useEffect(() => {
    if (!source.enabled || !query.isSuccess) return
    const controller = new AbortController()
    let syncing = false
    let repeat = false
    async function sync() {
      if (controller.signal.aborted) return
      if (syncing) {
        repeat = true
        return
      }
      syncing = true
      try {
        do {
          repeat = false
          let cursor = sequenceRef.current ?? 0
          let hasMore = true
          while (hasMore && !controller.signal.aborted) {
            const page = await source.fetchIncremental(cursor, controller.signal)
            if (controller.signal.aborted) return
            client.setQueryData<MessagePages>(key, (previous) =>
              mergeChatMessages(previous, page.data),
            )
            const next = Math.max(cursor, ...page.data.map((item) => item.sequence ?? 0))
            hasMore = page.page.hasMore && next > cursor
            cursor = next
            sequenceRef.current = Math.max(sequenceRef.current ?? 0, cursor)
          }
          setSyncError(null)
        } while (repeat && !controller.signal.aborted)
      } catch (error) {
        if (!controller.signal.aborted)
          setSyncError(error instanceof Error ? error : new Error('消息同步失败'))
      } finally {
        syncing = false
      }
    }
    function event(event: Event) {
      const detail: unknown = (event as CustomEvent<unknown>).detail
      if (typeof detail === 'object' && detail !== null && source.matches(detail as Record<string, unknown>))
        void sync()
    }
    function resume() {
      if (document.visibilityState === 'visible') void sync()
    }
    const stopReconnect = subscribeRealtimeReconnect(() => void sync())
    const poll = window.setInterval(resume, 15_000)
    window.addEventListener('qgents:message-event', event)
    document.addEventListener('visibilitychange', resume)
    void sync()
    return () => {
      controller.abort()
      window.clearInterval(poll)
      stopReconnect()
      window.removeEventListener('qgents:message-event', event)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [client, key, source, query.isSuccess])

  const send = useMutation({
    mutationFn: (body: SendChatMessage) => source.send(body),
    onSuccess: (result) => {
      client.setQueryData<MessagePages>(key, (data) => mergeChatMessages(data, [result]))
      if (source.listKey)
        void client.invalidateQueries({ queryKey: source.listKey, exact: true })
    },
  })
  const markRead = useCallback(async () => {
    await source.markRead()
    if (source.listKey)
      void client.invalidateQueries({ queryKey: source.listKey, exact: true })
  }, [client, source])
  useEffect(() => {
    if (!latestSequence || !readingLatest || !query.isSuccess) return
    let timer: number
    function scheduleRead() {
      window.clearTimeout(timer)
      if (document.visibilityState === 'visible')
        timer = window.setTimeout(() => {
          void markRead().catch(() => {})
        }, 500)
    }
    scheduleRead()
    document.addEventListener('visibilitychange', scheduleRead)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', scheduleRead)
    }
  }, [latestSequence, markRead, readingLatest, query.isSuccess])
  return { query, messages, send, syncError, markRead }
}

/** 群聊会话：事件按 groupId 归属。 */
export function useChatMessages(projectId: string, groupId: string, readingLatest = true) {
  const source = useMemo<ChatMessageSource>(
    () => ({
      key: chatKeys.messages(projectId, groupId),
      listKey: chatKeys.groups(projectId),
      enabled: Boolean(projectId && groupId),
      fetchPage: (cursor, signal) => chatApi.messages(projectId, groupId, cursor, signal),
      fetchIncremental: (after, signal) => chatApi.incremental(projectId, groupId, after, signal),
      send: (body) => chatApi.send(projectId, groupId, body),
      markRead: () => chatApi.read(projectId, groupId),
      matches: (detail) => detail.projectId === projectId && detail.groupId === groupId,
    }),
    [projectId, groupId],
  )
  return useConversationMessages(source, readingLatest)
}

/** 私聊会话：后端把会话 id 放在消息的 groupId 里，实时帧也用 groupId 归属。 */
export function useDirectMessages(
  projectId: string,
  conversationId: string,
  readingLatest = true,
) {
  const source = useMemo<ChatMessageSource>(
    () => ({
      key: chatKeys.conversationMessages(projectId, conversationId),
      listKey: chatKeys.conversations(projectId),
      enabled: Boolean(projectId && conversationId),
      fetchPage: (cursor, signal) =>
        directMessageApi.messages(projectId, conversationId, cursor, signal),
      fetchIncremental: (after, signal) =>
        directMessageApi.incremental(projectId, conversationId, after, signal),
      send: (body) => directMessageApi.send(projectId, conversationId, body),
      markRead: () => directMessageApi.read(projectId, conversationId),
      matches: (detail) =>
        detail.projectId === projectId && (detail.chatId ?? detail.groupId) === conversationId,
    }),
    [projectId, conversationId],
  )
  return useConversationMessages(source, readingLatest)
}
