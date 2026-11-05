import { request, requestPage } from './client'
import type { QgentId } from '@/types/chat'
import type { ChatGroup, ChatMember, ChatMessage, SendChatMessage } from '@/types/chat'

const groupPath = (projectId: string, groupId: string) =>
  `/projects/${encodeURIComponent(projectId)}/groups/${encodeURIComponent(groupId)}`

export const chatApi = {
  groups: (projectId: string) => request<ChatGroup[]>(`/projects/${encodeURIComponent(projectId)}/groups`),
  createGroup: (projectId: string, body: { title: string; userIds: string[]; agentIds: QgentId[] }) =>
    request<ChatGroup>(`/projects/${encodeURIComponent(projectId)}/groups`, { method: 'POST', body }),
  invite: (projectId: string, groupId: string, body: { userIds: string[]; agentIds: QgentId[] }) =>
    request<ChatMember[]>(`${groupPath(projectId, groupId)}/members`, { method: 'POST', body }),
  members: (projectId: string, groupId: string) => request<ChatMember[]>(`${groupPath(projectId, groupId)}/members`),
  messages(projectId: string, groupId: string, cursor?: string, signal?: AbortSignal) {
    const params = new URLSearchParams({ limit: '30' })
    if (cursor) params.set('cursor', cursor)
    return requestPage<ChatMessage>(`${groupPath(projectId, groupId)}/messages?${params}`, { signal })
  },
  incremental(projectId: string, groupId: string, afterSequence: number, signal?: AbortSignal) {
    return requestPage<ChatMessage>(`${groupPath(projectId, groupId)}/messages/incremental?afterSequence=${afterSequence}&limit=100`, { signal })
  },
  message: (projectId: string, groupId: string, messageId: string) =>
    request<ChatMessage>(`${groupPath(projectId, groupId)}/messages/${encodeURIComponent(messageId)}`),
  send: (projectId: string, groupId: string, body: SendChatMessage) =>
    request<ChatMessage>(`${groupPath(projectId, groupId)}/messages`, { method: 'POST', body }),
  cancel: (projectId: string, groupId: string, messageId: string) =>
    request<{ cancelledRuns: number }>(`${groupPath(projectId, groupId)}/messages/${encodeURIComponent(messageId)}/cancel-agent`, { method: 'POST' }),
  read: (projectId: string, groupId: string) =>
    request<{ lastReadSequenceNo: number }>(`${groupPath(projectId, groupId)}/read`, { method: 'POST' }),
  pin: (projectId: string, groupId: string, pinned: boolean) =>
    request(`${groupPath(projectId, groupId)}/pin`, { method: 'PUT', body: { pinned } }),
}
