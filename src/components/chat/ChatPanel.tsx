import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, App, Avatar, Button, Drawer, List, Tag, Tooltip } from 'antd'
import { PushpinOutlined, RobotOutlined, TeamOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { chatApi } from '@/api/chat'
import { projectApi } from '@/api/project'
import { useAuth } from '@/context/AuthContext'
import { useAgents } from '@/hooks/agents'
import { formatApiError } from '@/utils/formatApiError'
import type { Page } from '@/types/api'
import { messageField, type ChatMember, type ChatMessage, type SendChatMessage } from '@/types/chat'
import { PATHS } from '@/routes/paths'
import { GroupMembersModal } from './GroupMembersModal'
import { AttachmentPreviewModal } from './AttachmentPreviewModal'
import { ChatComposer } from './ChatComposer'
import { ChatMessageList } from './ChatMessageList'
import { chatKeys, mergeChatMessages, useChatMessages } from './useChatMessages'
import './ChatPanel.css'

/** 项目聊天的组合入口；输入、消息列表和数据同步分别维护。 */
export function ChatPanel({ projectId, groupId }: { projectId: string; groupId: string }) {
  const { message } = App.useApp()
  const { user } = useAuth()
  const client = useQueryClient()
  const [params] = useSearchParams()
  const [reply, setReply] = useState<ChatMessage | null>(null)
  const [preview, setPreview] = useState<ChatMessage | null>(null)
  const [membersOpen, setMembersOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [readingLatest, setReadingLatest] = useState(true)
  const [targetId, setTargetId] = useState<string | null>(params.get('messageId'))
  const [stoppedIds, setStoppedIds] = useState<ReadonlySet<string>>(new Set())
  const project = useQuery({ queryKey: ['projects', projectId], queryFn: () => projectApi.getById(projectId), enabled: Boolean(projectId) })
  const groups = useQuery({ queryKey: chatKeys.groups(projectId), queryFn: () => chatApi.groups(projectId), enabled: Boolean(projectId) })
  const members = useQuery({ queryKey: chatKeys.members(projectId, groupId), queryFn: () => chatApi.members(projectId, groupId), enabled: Boolean(groupId) })
  const agents = useAgents(project.data?.teamId)
  const group = groups.data?.find(item => item.id === groupId)
  const pin = useMutation({
    mutationFn: () => chatApi.pin(projectId, groupId, !group?.pinned),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: chatKeys.groups(projectId), exact: true })
      void client.invalidateQueries({ queryKey: chatKeys.allGroups })
    },
    onError: error => void message.error(formatApiError(error)),
  })
  const chat = useChatMessages(projectId, groupId, readingLatest)
  const sendAsync = chat.send.mutateAsync
  const isAdmin = project.data?.role === 'PROJECT_ADMIN'
  const recipients = useMemo<ChatMember[]>(() => {
    const all = new Map<string, ChatMember>()
    for (const member of members.data ?? []) if (member.id !== user?.id) all.set(`${member.memberType}:${member.id}`, member)
    for (const agent of agents.data ?? []) if (group?.defaultGroup && agent.status === 'ACTIVE') all.set(`AGENT:${agent.id}`, { id: agent.id, displayName: agent.name, memberType: 'AGENT', avatarUrl: agent.avatar })
    return [...all.values()]
  }, [members.data, agents.data, user?.id, group?.defaultGroup])
  const stop = useMutation({
    mutationFn: (item: ChatMessage) => chatApi.cancel(projectId, groupId, item.id),
    onSuccess: (result, item) => {
      setStoppedIds(current => new Set([...current, item.id]))
      void message.success(result.cancelledRuns ? '已请求停止执行' : '这条消息的执行已结束')
    },
    onError: error => void message.error(formatApiError(error)),
  })
  const stopMessage = stop.mutate
  const handleStop = useCallback((item: ChatMessage) => stopMessage(item), [stopMessage])
  const handleReply = useCallback((item: ChatMessage) => setReply(item), [])
  const clearReply = useCallback(() => setReply(null), [])
  const handlePreview = useCallback((item: ChatMessage) => {
    if (!messageField(item, 'attachmentId')) { void message.info('附件暂时无法预览'); return }
    setPreview(item)
  }, [message])
  const locate = useCallback(async (id: string) => {
    if (!id) return
    setTargetId(null)
    try {
      const item = await chatApi.message(projectId, groupId, id)
      client.setQueryData<InfiniteData<Page<ChatMessage>, string | undefined>>(chatKeys.messages(projectId, groupId), current => mergeChatMessages(current, [item]))
      setTargetId(id)
    } catch (error) { void message.error(formatApiError(error)) }
  }, [client, projectId, groupId, message])
  const onLocate = useCallback((id: string) => { void locate(id) }, [locate])
  const handleSend = useCallback((body: SendChatMessage) => sendAsync(body), [sendAsync])
  const loadOlder = chat.query.fetchNextPage
  const linkedMessageId = params.get('messageId')
  const ready = chat.query.isSuccess
  useEffect(() => {
    if (linkedMessageId && ready) void locate(linkedMessageId)
  }, [linkedMessageId, ready, locate])

  return <section className="chat-panel">
    <header className="chat-panel__header">
      <div className="chat-panel__identity"><span className="chat-panel__project-icon"><TeamOutlined /></span><div>
        <h1>{group?.title || project.data?.name || '项目聊天'}</h1><p>{group?.description || (group?.defaultGroup ? '默认群 · 全体项目成员' : '一起讨论，与 Agent 协作')}</p>
      </div></div>
      <div className="chat-panel__header-actions">
        <Tooltip title={group?.pinned ? '取消置顶' : '置顶聊天'}><Button type="text" icon={<PushpinOutlined />} aria-label={group?.pinned ? '取消置顶' : '置顶聊天'} loading={pin.isPending} onClick={() => pin.mutate()} /></Tooltip>
        <Button type="text" icon={<TeamOutlined />} onClick={() => setMembersOpen(true)}>{group?.memberCount ?? members.data?.length ?? 0} 位成员</Button>
      </div>
    </header>
    {chat.query.isError && <Alert showIcon type="error" message={formatApiError(chat.query.error)} action={<Button onClick={() => void chat.query.refetch()}>重试</Button>} />}
    {chat.syncError && <Alert type="warning" showIcon message="消息同步暂时中断，恢复连接后会自动补齐" />}
    <ChatMessageList messages={chat.messages} loading={chat.query.isPending} hasMore={chat.query.hasNextPage} loadingOlder={chat.query.isFetchingNextPage}
      currentUserId={user?.id} isAdmin={isAdmin} stoppedIds={stoppedIds} stoppingId={stop.isPending ? stop.variables?.id : undefined}
      targetId={targetId} onReadingLatestChange={setReadingLatest} onLoadOlder={loadOlder} onReply={handleReply} onStop={handleStop} onPreview={handlePreview} onLocate={onLocate} />
    {project.data?.status === 'ARCHIVED' && <Alert type="info" showIcon message="项目已归档，可以查看历史消息，恢复项目后可继续聊天。" />}
    <ChatComposer key={groupId} draftKey={`qgents:chat-draft:${user?.id}:${projectId}:${groupId}`} projectId={projectId} reply={reply} recipients={recipients} onSend={handleSend} onClearReply={clearReply} disabled={!ready || project.data?.status === 'ARCHIVED'} />
    <Drawer title="群聊成员" open={membersOpen} onClose={() => setMembersOpen(false)}>
      <p className="chat-members__hint">{group?.defaultGroup ? '默认群的用户与项目成员同步。' : '这个群聊中的伙伴与 Agent。'}</p>
      <Button type="primary" block onClick={() => setInviteOpen(true)} disabled={project.data?.status === 'ARCHIVED'}>邀请成员 / Agent</Button>
      <List dataSource={members.data ?? []} renderItem={member => <List.Item><List.Item.Meta
        avatar={<Avatar src={member.avatarUrl} icon={member.memberType === 'AGENT' ? <RobotOutlined /> : undefined}>{member.displayName.slice(0, 1)}</Avatar>}
        title={<>{member.displayName} {member.memberType === 'AGENT' && <Tag>Agent</Tag>}</>} description={member.email || undefined} /></List.Item>} />
      <Link to={PATHS.projectMembers(projectId)}><Button block>查看项目成员</Button></Link>
    </Drawer>
    {inviteOpen && group && project.data && <GroupMembersModal projectId={projectId} teamId={project.data.teamId} group={group} onClose={() => setInviteOpen(false)} />}
    {preview && <AttachmentPreviewModal open projectId={projectId} attachmentId={messageField(preview, 'attachmentId')} fileName={messageField(preview, 'name') || undefined} onClose={() => setPreview(null)} />}
  </section>
}
