import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi, notificationApi } from '@/api'
import { useAuth } from '@/context/AuthContext'
import { useAppUiStore } from '@/store/appUiStore'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { useNotificationEvents } from '@/realtime/useNotificationEvents'
import { useRealtimeConnectionStatus } from '@/realtime/realtimeClient'
import type { Notification, Project, Team } from '@/types'
import { Avatar, Button, Icon, IconButton, Popover } from '@/components/ui'

type Panel = 'project' | 'search' | 'bell' | 'me'

interface AppBarProps {
  mode: 'project' | 'team' | 'settings'
  team: Team | undefined
  projects: Project[] | undefined
  projectsPending: boolean
  project: Project | undefined
  projectId: string | null
  chatEnabled: boolean
}

/** 56px 顶栏：项目切换器（带搜索）、通知、群聊开关。团队切换只在产品设置里。 */
export function AppBar({
  mode,
  team,
  projects,
  projectsPending,
  project,
  projectId,
  chatEnabled,
}: AppBarProps) {
  const [panel, setPanel] = useState<Panel | null>(null)
  const close = () => setPanel(null)
  const chatOpen = useAppUiStore((state) => state.chatContextOpen)
  const setChatOpen = useAppUiStore((state) => state.setChatContextOpen)

  // ⌘K / Ctrl+K 在任何页面都打开项目搜索，不依赖浮层先挂载。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPanel('search')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const crumbLabel = mode === 'project' ? '项目' : mode === 'team' ? '团队' : '设置'
  const crumbValue =
    mode === 'project' ? (project?.name ?? '…') : mode === 'team' ? (team?.name ?? '…') : '账户与团队'

  return (
    <header className="appbar">
      {mode === 'project' ? (
        <div className="anchored">
          <button
            type="button"
            className="crumb crumb--project"
            aria-haspopup="dialog"
            aria-expanded={panel === 'project'}
            onClick={() => setPanel(panel === 'project' ? null : 'project')}
          >
            <span className="crumb__label">{crumbLabel}</span>
            <span className="crumb__value">{crumbValue}</span>
            <Icon name="chevron" size={14} />
          </button>
          <Popover
            open={panel === 'project'}
            onClose={close}
            label="切换项目"
            align="start"
            className="popover--wide"
          >
            <ProjectMenu
              projects={projects}
              projectsPending={projectsPending}
              currentId={projectId}
              onNavigate={close}
            />
          </Popover>
        </div>
      ) : (
        <span className="crumb">
          <span className="crumb__label">{crumbLabel}</span>
          <span className="crumb__value">{crumbValue}</span>
        </span>
      )}

      <div className="appbar__right">
        <div className="anchored">
          <button
            type="button"
            className="searchbtn"
            aria-haspopup="dialog"
            aria-expanded={panel === 'search'}
            onClick={() => setPanel(panel === 'search' ? null : 'search')}
          >
            <Icon name="search" size={16} />
            <span>搜索项目</span>
            <kbd>⌘K</kbd>
          </button>
          <Popover
            open={panel === 'search'}
            onClose={close}
            label="搜索项目"
            align="end"
            className="popover--search"
          >
            <ProjectSearch
              projects={projects}
              pending={projectsPending}
              onNavigate={close}
              onClose={close}
            />
          </Popover>
        </div>

        <div className="anchored">
          <NotificationBell open={panel === 'bell'} onToggle={() => setPanel(panel === 'bell' ? null : 'bell')} onClose={close} />
        </div>

        {chatEnabled ? (
          <button
            type="button"
            className="iconbtn ctx-toggle"
            aria-expanded={chatOpen}
            onClick={() => setChatOpen(!chatOpen)}
          >
            {chatOpen ? '收起群聊' : '群聊'}
          </button>
        ) : null}
      </div>
    </header>
  )
}

function ProjectMenu({
  projects,
  projectsPending,
  currentId,
  onNavigate,
}: {
  projects: Project[] | undefined
  projectsPending: boolean
  currentId: string | null
  onNavigate: () => void
}) {
  const navigate = useNavigate()
  return (
    <>
      <p className="popover__label">切换项目</p>
      {projectsPending ? (
        <p className="popover__empty">正在加载项目…</p>
      ) : !projects?.length ? (
        <p className="popover__empty">当前团队还没有项目。</p>
      ) : (
        <ul className="menu">
          {projects.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="menu__item"
                aria-current={item.id === currentId}
                onClick={() => {
                  onNavigate()
                  navigate(PATHS.projectChat(item.id))
                }}
              >
                <span>{item.name}</span>
                {item.status === 'ARCHIVED' ? <span className="meta">已归档</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function ProjectSearch({
  projects,
  pending,
  onNavigate,
  onClose,
}: {
  projects: Project[] | undefined
  pending: boolean
  onNavigate: () => void
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const matches = useMemo(() => {
    const keyword = term.trim().toLowerCase()
    if (!keyword) return projects ?? []
    return (projects ?? []).filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        (item.description ?? '').toLowerCase().includes(keyword),
    )
  }, [projects, term])

  // 输入即筛，回车进第一项；Esc 由 Popover 统一处理。
  const open = (project: Project) => {
    onNavigate()
    navigate(PATHS.projectChat(project.id))
  }

  return (
    <>
      <label className="sr" htmlFor="project-search">
        搜索项目
      </label>
      <input
        id="project-search"
        type="search"
        autoFocus
        placeholder="输入项目名或仓库名"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && matches[0]) open(matches[0])
          if (event.key === 'Escape') onClose()
        }}
      />
      {pending ? (
        <p className="popover__empty">正在加载项目…</p>
      ) : matches.length === 0 ? (
        <p className="popover__empty">没有匹配的项目。</p>
      ) : (
        <ul className="menu">
          {matches.map((item) => (
            <li key={item.id}>
              <button type="button" className="menu__item" onClick={() => open(item)}>
                <span>{item.name}</span>
                {item.status === 'ARCHIVED' ? <span className="meta">已归档</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function NotificationBell({
  open,
  onToggle,
  onClose,
}: {
  open: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const realtimeStatus = useRealtimeConnectionStatus()
  useNotificationEvents(realtimeStatus !== 'connected')
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.list(),
  })
  const unread = notifications.filter((item) => !item.isRead).length
  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const markAll = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const openNotification = (item: Notification) => {
    if (!item.isRead) markRead.mutate(item.id)
    onClose()
    const target = targetPath(item)
    if (target) navigate(target)
  }

  return (
    <>
      <IconButton
        label="通知"
        square
        className="bellbtn"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onToggle}
      >
        <Icon name="bell" size={16} />
        {unread > 0 ? <span className="dot dot--mark bellbtn__dot" aria-hidden /> : null}
      </IconButton>
      <Popover open={open} onClose={onClose} label="通知" align="end" className="popover--bell">
        <div className="row" style={{ justifyContent: 'space-between', padding: '0 4px 6px' }}>
          <p className="popover__label">通知</p>
          {notifications.length > 0 ? (
            <Button
              variant="link"
              size="sm"
              disabled={unread === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              全部已读
            </Button>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <p className="popover__empty">还没有通知。有人提到你或邀请你时会出现在这里。</p>
        ) : (
          <ul className="menu">
            {notifications.map((item) => (
              <li key={item.id}>
                <button type="button" className="menu__item" onClick={() => openNotification(item)}>
                  <span>
                    <span className="notif__title">
                      {!item.isRead ? <span className="dot dot--mark" aria-hidden /> : null}
                      {item.title}
                    </span>
                    <span className="notif__meta">
                      {item.description ? `${item.description} · ` : ''}
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Popover>
    </>
  )
}

/** 通知 → 目标路由；没有对应项目时留在原页。 */
function targetPath(item: Notification): string | null {
  if (item.kind === 'INVITED') return PATHS.JOIN_TEAM
  if (!item.projectId) return null
  return PATHS.projectChat(
    item.projectId,
    item.kind === 'MESSAGE_MENTION' ? item.resourceId : undefined,
    item.groupId,
  )
}

/** 头像菜单：昵称默认是文本，点旁边的编辑图标才进入输入；底部只保留退出登录。 */
export function MeMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { user, logout, updateUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.displayName ?? '')
  const dirty = name.trim() !== (user?.displayName ?? '')
  const save = useMutation({
    mutationFn: (displayName: string) => authApi.updateMe({ displayName }),
    onSuccess: (updated) => {
      updateUser(updated)
      setName(updated.displayName)
      setEditing(false)
      void message.success('昵称已更新')
    },
    onError: (error) => void message.error(formatApiError(error)),
  })

  useEffect(() => {
    if (!open) return
    setEditing(false)
    setName(user?.displayName ?? '')
  }, [open, user?.displayName])

  function cancelEditing() {
    setName(user?.displayName ?? '')
    setEditing(false)
  }

  function submitName() {
    const next = name.trim()
    if (!next || save.isPending) return
    if (!dirty) {
      setEditing(false)
      return
    }
    save.mutate(next)
  }

  return (
    <Popover open={open} onClose={onClose} label="账户菜单" align="end" className="popover--me">
      <div className="popover__me">
        <Avatar name={user?.displayName ?? '我'} src={user?.avatarUrl} size="lg" />
        <div className="od-fill">
          {editing ? (
            <div className="me-editor">
              <label className="sr" htmlFor="me-name">
                昵称
              </label>
              <input
                id="me-name"
                className="inline-edit"
                value={name}
                maxLength={120}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitName()
                  if (event.key === 'Escape') cancelEditing()
                }}
              />
              <IconButton
                label="保存昵称"
                square
                disabled={!dirty || !name.trim() || save.isPending}
                onClick={submitName}
              >
                <Icon name="check" size={14} />
              </IconButton>
            </div>
          ) : (
            <div className="me-name-row">
              <span className="me-name">{user?.displayName ?? '用户'}</span>
              <button
                type="button"
                className="me-edit"
                aria-label="修改昵称"
                title="修改昵称"
                onClick={() => setEditing(true)}
              >
                <Icon name="edit" size={13} />
              </button>
            </div>
          )}
          <p className="meta mono">{user?.email}</p>
        </div>
      </div>
      <div className="popover__foot">
        <button
          type="button"
          className="menu__item menu__item--quiet"
          onClick={async () => {
            await logout()
            onClose()
            navigate(PATHS.LOGIN, { replace: true })
          }}
        >
          退出登录
        </button>
      </div>
    </Popover>
  )
}
