import { Suspense, useRef, useState } from 'react'
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { Alert, Avatar, Button, Drawer, Input } from 'antd'
import { MenuOutlined, PlusOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { projectApi } from '@/api/project'
import { chatApi } from '@/api/chat'
import { chatKeys } from '@/components/chat/useChatMessages'
import { GroupMembersModal } from '@/components/chat/GroupMembersModal'
import { PATHS } from '@/routes/paths'
import { chatPreview } from '@/types/chat'
import { formatApiError } from '@/utils/formatApiError'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { useRememberTeam } from '@/hooks/useRememberTeam'
import { PageLoader } from '@/components/PageLoader'
import './ProjectDetailLayout.scss'

/**
 * 项目外壳：项目顶栏承载一级导航，聊天页左侧承载群聊二级列表。
 * 设置、Agent、Skill、共享知识、仓库共用同一组直达路由，URL 不被导航改写。
 */
export default function ProjectDetailLayout() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const menuRef = useRef<HTMLButtonElement>(null)
  const inChat = location.pathname.endsWith('/chat')
  const project = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: Boolean(projectId),
  })
  const groups = useQuery({
    queryKey: chatKeys.groups(projectId),
    queryFn: () => chatApi.groups(projectId),
    enabled: Boolean(projectId) && inChat,
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

  const groupParam = params.get('groupId')
  const messageParam = params.get('messageId')
  const defaultGroup = groups.data?.find((group) => group.defaultGroup)
  const sortedGroups = [...(groups.data ?? [])].sort(
    (a, b) =>
      Number(Boolean(b.defaultGroup)) - Number(Boolean(a.defaultGroup)) ||
      Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)),
  )
  const selectedId = groupParam || defaultGroup?.id || groups.data?.[0]?.id
  const keepGroupId = groupParam || (inChat ? selectedId : undefined)
  const preserved = new URLSearchParams()
  if (keepGroupId) preserved.set('groupId', keepGroupId)
  if (messageParam) preserved.set('messageId', messageParam)
  const suffix = preserved.size ? `?${preserved.toString()}` : ''
  const visible = sortedGroups.filter((group) =>
    group.title.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const links = [
    { label: '聊天', to: PATHS.projectChat(projectId) + suffix },
    { label: 'Agent', to: PATHS.projectAgents(projectId) + suffix },
    { label: '共享知识', to: PATHS.projectMemory(projectId) + suffix },
    { label: 'Skill', to: PATHS.projectSkills(projectId) + suffix },
    { label: '仓库', to: PATHS.projectCode(projectId) + suffix },
  ]
  const settingsLink = PATHS.projectSettings(projectId) + suffix
  const openCreate = () => {
    setNavOpen(false)
    setCreateOpen(true)
  }

  const groupLinks = (onNavigate?: () => void) =>
    visible.map((group) => (
      <Link
        key={group.id}
        to={PATHS.projectChat(projectId) + '?groupId=' + encodeURIComponent(group.id)}
        className={`project-group${selectedId === group.id ? ' is-active' : ''}`}
        aria-label={group.title}
        aria-current={selectedId === group.id ? 'page' : undefined}
        onClick={onNavigate}
      >
        <span className="project-group__body">
          <span className="project-group__title">
            {group.title}
            {group.memberCount ? <em>{group.memberCount}</em> : null}
          </span>
          <span className="project-group__meta">
            {group.defaultGroup
              ? '默认群 · 全体项目成员'
              : group.latestMessage?.text
                ? chatPreview(group.latestMessage.text)
                : '开始新的讨论'}
          </span>
        </span>
        <span className="project-group__side">
          <span className="project-group__time">
            {formatRelativeTime(group.latestActivityAt ?? group.lastMessageAt ?? '')}
          </span>
          {group.unreadCount ? (
            <span className="project-group__unread">
              {group.unreadCount > 99 ? '99+' : group.unreadCount}
            </span>
          ) : null}
        </span>
      </Link>
    ))

  return (
    <div className="project-workspace">
      <header className="project-header">
        <Link
          className="project-header__identity"
          to={PATHS.teamDetail(project.data.teamId)}
          aria-label="返回团队项目"
        >
          <Avatar size={28} shape="square" src={project.data.avatarUrl}>
            {project.data.name.slice(0, 1)}
          </Avatar>
          <span className="project-header__name">
            <strong>{project.data.name}</strong>
            <span>{project.data.status === 'ARCHIVED' ? '已归档' : '项目'}</span>
          </span>
        </Link>
        <nav className="project-nav" aria-label="项目导航">
          {links.map((link) => (
            <NavLink key={link.label} className="project-nav__link" to={link.to}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="project-header__actions">
          <NavLink className="project-header__settings" to={settingsLink} aria-label="项目设置">
            <SettingOutlined aria-hidden />
            <span>项目设置</span>
          </NavLink>
          <Button
            ref={menuRef}
            className="project-header__menu"
            type="text"
            icon={<MenuOutlined />}
            aria-label="打开项目导航"
            onClick={() => setNavOpen(true)}
          />
        </div>
      </header>
      <div className="project-body">
        {inChat && (
          <aside className="project-groups" aria-label="群聊导航">
            <Input
              className="project-groups__search"
              prefix={<SearchOutlined />}
              placeholder="搜索群聊"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              allowClear
              aria-label="搜索群聊"
            />
            <div className="project-groups__head">
              <span>群聊 · {groups.data?.length ?? 0}</span>
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                aria-label="创建新群聊"
                disabled={project.data.status === 'ARCHIVED'}
                onClick={openCreate}
              />
            </div>
            <nav className="project-groups__list" aria-label="群聊列表">
              {groups.isPending ? (
                <p className="project-groups__hint">正在加载群聊…</p>
              ) : groups.isError ? (
                <Button size="small" onClick={() => void groups.refetch()}>
                  重新加载群聊
                </Button>
              ) : visible.length === 0 ? (
                <p className="project-groups__hint">没有匹配的群聊</p>
              ) : (
                groupLinks()
              )}
            </nav>
          </aside>
        )}
        <main className="project-content">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <Drawer
        title={project.data.name}
        placement="left"
        width={300}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        afterOpenChange={(open) => {
          if (!open) menuRef.current?.focus()
        }}
      >
        <div className="project-drawer">
          <nav className="project-drawer__nav" aria-label="项目菜单">
            {links.map((link) => (
              <NavLink
                key={link.label}
                className="project-drawer__link"
                to={link.to}
                onClick={() => setNavOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
            <NavLink
              className="project-drawer__link"
              to={settingsLink}
              onClick={() => setNavOpen(false)}
            >
              项目设置
            </NavLink>
          </nav>
          {inChat && (
            <section className="project-drawer__groups" aria-label="群聊">
              <div className="project-groups__head">
                <span>群聊 · {groups.data?.length ?? 0}</span>
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  aria-label="创建新群聊"
                  disabled={project.data.status === 'ARCHIVED'}
                  onClick={openCreate}
                >
                  新建群聊
                </Button>
              </div>
              <Input
                prefix={<SearchOutlined />}
                placeholder="搜索群聊"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                allowClear
                aria-label="搜索群聊"
              />
              <nav className="project-groups__list" aria-label="群聊列表">
                {visible.length === 0 ? (
                  <p className="project-groups__hint">没有匹配的群聊</p>
                ) : (
                  groupLinks(() => setNavOpen(false))
                )}
              </nav>
            </section>
          )}
        </div>
      </Drawer>
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
