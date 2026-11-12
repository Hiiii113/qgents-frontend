import { Suspense, useState } from 'react'
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { Alert, Avatar, Button, Input } from 'antd'
import { ArrowLeftOutlined, PlusOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { projectApi } from '@/api/project'
import { chatApi } from '@/api/chat'
import { chatKeys } from '@/components/chat/useChatMessages'
import { GroupMembersModal } from '@/components/chat/GroupMembersModal'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import { useRememberTeam } from '@/hooks/useRememberTeam'
import { PageLoader } from '@/components/PageLoader'
import './ProjectDetailLayout.scss'

/** 项目以群聊为主界面，配置能力从项目设置进入。 */
export default function ProjectDetailLayout() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const project = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: Boolean(projectId),
  })
  const groups = useQuery({
    queryKey: chatKeys.groups(projectId),
    queryFn: () => chatApi.groups(projectId),
    enabled: Boolean(projectId),
  })
  useRememberTeam(project.data?.teamId)
  if (project.isPending)
    return (
      <div className="project-workspace__status">
        <PageLoader />
      </div>
    )
  if (project.isError)
    return (
      <div className="project-workspace__status">
        <Alert
          type="error"
          showIcon
          message={formatApiError(project.error)}
          action={<Button onClick={() => void project.refetch()}>重试</Button>}
        />
      </div>
    )
  const selectedId =
    params.get('groupId') ||
    groups.data?.find((group) => group.defaultGroup)?.id ||
    groups.data?.[0]?.id
  const inChat = location.pathname.endsWith('/chat')
  const visible = [...(groups.data ?? [])]
    .sort(
      (a, b) =>
        Number(Boolean(b.defaultGroup)) - Number(Boolean(a.defaultGroup)) ||
        Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)),
    )
    .filter((group) => group.title.toLowerCase().includes(search.trim().toLowerCase()))
  return (
    <div className="project-workspace">
      <aside className="project-sidebar" aria-label="群聊导航">
        <div className="project-sidebar__identity">
          <Avatar size={32} src={project.data.avatarUrl}>
            {project.data.name.slice(0, 1)}
          </Avatar>
          <div>
            <strong>{project.data.name}</strong>
            <span>项目空间</span>
          </div>
        </div>
        <Input
          className="project-sidebar__search"
          prefix={<SearchOutlined />}
          placeholder="搜索群聊"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          allowClear
          aria-label="搜索群聊"
        />
        <div className="project-sidebar__section">
          <span>群聊 · {groups.data?.length ?? 0}</span>
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            aria-label="创建新群聊"
            disabled={project.data.status === 'ARCHIVED'}
            onClick={() => setCreateOpen(true)}
          />
        </div>
        <nav className="project-sidebar__groups">
          {groups.isPending ? (
            <p className="project-sidebar__hint">正在加载群聊…</p>
          ) : groups.isError ? (
            <Button size="small" onClick={() => void groups.refetch()}>
              重新加载群聊
            </Button>
          ) : visible.length === 0 ? (
            <p className="project-sidebar__hint">没有匹配的群聊</p>
          ) : (
            visible.map((group) => (
              <NavLink
                key={group.id}
                to={PATHS.projectChat(projectId) + '?groupId=' + encodeURIComponent(group.id)}
                className={`project-sidebar__group${inChat && selectedId === group.id ? ' is-active' : ''}`}
                aria-label={group.title}
              >
                <div>
                  <strong>{group.title}</strong>
                  <span>
                    {group.defaultGroup
                      ? '默认群 · 全体项目成员'
                      : group.latestMessage?.text || '开始新的讨论'}
                  </span>
                </div>
                {group.unreadCount ? (
                  <span className="project-sidebar__unread">
                    {group.unreadCount > 99 ? '99+' : group.unreadCount}
                  </span>
                ) : null}
              </NavLink>
            ))
          )}
        </nav>
        <Button
          className="project-sidebar__create"
          block
          icon={<PlusOutlined aria-hidden />}
          disabled={project.data.status === 'ARCHIVED'}
          onClick={() => setCreateOpen(true)}
        >
          <span className="project-sidebar__label">创建新群聊</span>
        </Button>
        <NavLink
          className="project-sidebar__settings"
          to={PATHS.projectSettings(projectId)}
          aria-label="项目设置"
        >
          <SettingOutlined aria-hidden />
          <span className="project-sidebar__label">项目设置</span>
        </NavLink>
      </aside>
      <main className="project-workspace__main">
        {!inChat && (
          <nav className="project-tools__nav" aria-label="项目导航">
            <NavLink
              to={
                PATHS.projectChat(projectId) +
                (selectedId ? '?groupId=' + encodeURIComponent(selectedId) : '')
              }
            >
              <ArrowLeftOutlined /> 返回聊天
            </NavLink>
          </nav>
        )}
        <div className="project-workspace__content">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      {createOpen && (
        <GroupMembersModal
          projectId={projectId}
          teamId={project.data.teamId}
          onClose={() => setCreateOpen(false)}
          onCreated={(group) =>
            navigate(PATHS.projectChat(projectId) + '?groupId=' + encodeURIComponent(group.id))
          }
        />
      )}
    </div>
  )
}
