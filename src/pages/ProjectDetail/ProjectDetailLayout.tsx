import { useEffect, useState } from 'react'
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { Alert, Avatar, Badge, Button, Dropdown, Empty, Input, Spin } from 'antd'
import {
  ArrowLeftOutlined,
  BookOutlined,
  CodeOutlined,
  MessageOutlined,
  PlusOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { projectApi } from '@/api/project'
import { chatApi } from '@/api/chat'
import { chatKeys } from '@/components/chat/useChatMessages'
import { GroupMembersModal } from '@/components/chat/GroupMembersModal'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import { useAppUiStore } from '@/store/appUiStore'
import './ProjectDetailLayout.scss'

const TOOLS = [
  { key: 'agents', label: 'Agent', icon: <RobotOutlined /> },
  { key: 'skills', label: 'Skill', icon: <ThunderboltOutlined /> },
  { key: 'memory', label: '共享知识', icon: <BookOutlined /> },
  { key: 'code', label: '项目仓库', icon: <CodeOutlined /> },
  { key: 'settings', label: '项目设置', icon: <SettingOutlined /> },
]

/** 项目以群聊为主界面，配置能力收在辅助菜单中。 */
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
  const setCurrentTeam = useAppUiStore((state) => state.setCurrentTeam)
  useEffect(() => {
    if (project.data?.teamId) setCurrentTeam(project.data.teamId)
  }, [project.data?.teamId, setCurrentTeam])
  if (project.isPending)
    return (
      <div className="project-loading">
        <Spin />
      </div>
    )
  if (project.isError)
    return (
      <Alert
        type="error"
        showIcon
        message={formatApiError(project.error)}
        action={<Button onClick={() => void project.refetch()}>重试</Button>}
      />
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
        <NavLink className="project-sidebar__back" to={PATHS.teamDetail(project.data.teamId)}>
          <ArrowLeftOutlined /> 返回项目列表
        </NavLink>
        <div className="project-sidebar__identity">
          <Avatar size={42} src={project.data.avatarUrl}>
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
            <Spin />
          ) : groups.isError ? (
            <Button onClick={() => void groups.refetch()}>重新加载群聊</Button>
          ) : visible.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的群聊" />
          ) : (
            visible.map((group) => (
              <NavLink
                key={group.id}
                to={PATHS.projectChat(projectId) + '?groupId=' + encodeURIComponent(group.id)}
                className={`project-sidebar__group${inChat && selectedId === group.id ? ' is-active' : ''}`}
                aria-label={group.title}
              >
                <span className="project-sidebar__group-icon">
                  <MessageOutlined />
                </span>
                <div>
                  <strong>{group.title}</strong>
                  <span>
                    {group.defaultGroup
                      ? '默认群 · 全体项目成员'
                      : group.latestMessage?.text || group.description || '开始新的讨论'}
                  </span>
                </div>
                <Badge count={group.unreadCount} size="small" overflowCount={99} />
              </NavLink>
            ))
          )}
        </nav>
        <Button
          className="project-sidebar__create"
          icon={<PlusOutlined />}
          disabled={project.data.status === 'ARCHIVED'}
          onClick={() => setCreateOpen(true)}
        >
          创建新群聊
        </Button>
        <div className="project-sidebar__footer">
          <Dropdown
            trigger={['click']}
            menu={{
              items: TOOLS,
              onClick: ({ key }) => navigate(`/app/projects/${projectId}/${key}`),
            }}
          >
            <Button block type="text" icon={<SettingOutlined />}>
              项目工具
            </Button>
          </Dropdown>
        </div>
      </aside>
      <main className="project-workspace__main">
        {!inChat && (
          <div className="project-tools__back">
            <NavLink
              to={
                PATHS.projectChat(projectId) +
                (selectedId ? '?groupId=' + encodeURIComponent(selectedId) : '')
              }
            >
              <ArrowLeftOutlined /> 返回聊天
            </NavLink>
          </div>
        )}
        <Outlet />
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
