import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import { chatApi } from '@/api/chat'
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

export function useChatMessages(projectId: string, groupId: string, readingLatest = true) {
  const client = useQueryClient()
  const [syncError, setSyncError] = useState<Error | null>(null)
  const key = useMemo(() => chatKeys.messages(projectId, groupId), [projectId, groupId])
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) => chatApi.messages(projectId, groupId, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) =>
      page.page.hasMore ? (page.page.nextCursor ?? undefined) : undefined,
    enabled: Boolean(projectId && groupId),
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
    if (!groupId || !projectId || !query.isSuccess) return
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
            const page = await chatApi.incremental(projectId, groupId, cursor, controller.signal)
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
      if (
        typeof detail === 'object' &&
        detail !== null &&
        Reflect.get(detail, 'projectId') === projectId &&
        Reflect.get(detail, 'groupId') === groupId
      )
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
  }, [client, projectId, groupId, key, query.isSuccess])

  const send = useMutation({
    mutationFn: (body: SendChatMessage) => chatApi.send(projectId, groupId, body),
    onSuccess: (result) => {
      client.setQueryData<MessagePages>(key, (data) => mergeChatMessages(data, [result]))
      void client.invalidateQueries({ queryKey: chatKeys.groups(projectId), exact: true })
    },
  })
  const markRead = useCallback(async () => {
    await chatApi.read(projectId, groupId)
    void client.invalidateQueries({ queryKey: chatKeys.groups(projectId), exact: true })
  }, [client, projectId, groupId])
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
