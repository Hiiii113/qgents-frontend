import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Avatar, Badge, Button, Empty, Input, Select, Spin, Tag } from 'antd'
import { PushpinOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { chatApi } from '@/api/chat'
import { projectApi } from '@/api/project'
import { teamApi } from '@/api/team'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { chatKeys } from '@/components/chat/useChatMessages'
import { useAppUiStore, useCurrentTeamId } from '@/store/appUiStore'
import { formatApiError } from '@/utils/formatApiError'
import './ChatWorkspacePage.css'

export default function ChatWorkspacePage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const currentTeam = useCurrentTeamId()
  const setTeam = useAppUiStore(state => state.setCurrentTeam)
  const teams = useQuery({ queryKey: ['teams', 'mine'], queryFn: teamApi.listMine })
  const teamId = params.get('teamId') || currentTeam || teams.data?.[0]?.id || ''
  const projects = useQuery({ queryKey: ['teams', teamId, 'projects'], queryFn: () => projectApi.listByTeam(teamId), enabled: Boolean(teamId) })
  const groups = useQuery({ queryKey: chatKeys.allGroups, queryFn: chatApi.allGroups, enabled: Boolean(teamId) })
  const projectById = useMemo(() => new Map((projects.data ?? []).map(project => [project.id, project])), [projects.data])
  const sessions = useMemo(() => (groups.data ?? []).filter(group => projectById.has(group.projectId))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || (b.latestActivityAt || '').localeCompare(a.latestActivityAt || '')), [groups.data, projectById])
  const selected = sessions.find(group => group.projectId === params.get('projectId')) ?? sessions[0]
  const visibleSessions = sessions.filter(group => (projectById.get(group.projectId)?.name || group.title).toLowerCase().includes(search.trim().toLowerCase()))
  useEffect(() => {
    if (!teamId) return
    setTeam(teamId)
    const next = new URLSearchParams(params)
    next.set('teamId', teamId)
    // 固定当前会话，避免新消息改变列表排序后自动切到另一个项目。
    if (selected && !params.get('projectId')) next.set('projectId', selected.projectId)
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [teamId, selected, setTeam, params, setParams])
  const loading = teams.isPending || (Boolean(teamId) && (projects.isPending || groups.isPending))
  const error = teams.error || projects.error || groups.error
  return <div className="chat-workspace">
    <aside className="chat-workspace__sidebar">
      <div className="chat-workspace__heading"><span>CONVERSATIONS</span><h1>项目聊天</h1></div>
      <Select aria-label="当前团队" value={teamId || undefined} options={(teams.data ?? []).map(team => ({ value: team.id, label: team.name }))}
        onChange={id => { setParams({ teamId: id }); setTeam(id) }} />
      <Input aria-label="搜索项目聊天" prefix={<SearchOutlined />} placeholder="搜索项目…" value={search} onChange={event => setSearch(event.target.value)} allowClear />
      <div className="chat-workspace__sessions">{visibleSessions.map(group => {
        const project = projectById.get(group.projectId)
        const preview = group.latestMessage?.text || (group.latestMessage?.type === 'IMAGE' ? '[图片]' : group.latestMessage?.type === 'FILE' ? '[附件]' : group.latestMessage?.type === 'CODE' ? '[代码]' : group.latestMessage ? '新消息' : '开始项目里的第一段讨论')
        return <button key={group.id} aria-current={selected?.id === group.id ? 'page' : undefined} className={`chat-workspace__session${selected?.id === group.id ? ' is-active' : ''}`} onClick={() => setParams({ teamId, projectId: group.projectId })}>
          <Badge count={group.unreadCount || 0} size="small"><Avatar shape="square" src={project?.avatarUrl}>{(project?.name || group.title).slice(0, 1)}</Avatar></Badge>
          <div><strong>{project?.name || group.title} {group.pinned && <PushpinOutlined aria-label="已置顶" />}</strong><span>{group.mentionedUnread ? <Tag color="green">有人 @你</Tag> : null}{preview}</span></div>
        </button>
      })}{!loading && !error && !visibleSessions.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? '没有匹配的项目聊天' : '暂无项目聊天'} />}</div>
      <p className="chat-workspace__note">一个项目，一段持续的对话。</p>
    </aside>
    <main className="chat-workspace__main">{error ? <Alert type="error" showIcon message={formatApiError(error)} action={<Button onClick={() => {
      if (teams.isError) void teams.refetch()
      if (projects.isError) void projects.refetch()
      if (groups.isError) void groups.refetch()
    }}>重试</Button>} /> : loading
      ? <div className="project-loading"><Spin /></div> : selected
        ? <ChatPanel key={selected.id} projectId={selected.projectId} groupId={selected.id} />
        : <div className="project-loading"><Empty description={search ? '没有匹配的项目' : '创建或加入项目后，在这里开始聊天'} /></div>}</main>
  </div>
}
