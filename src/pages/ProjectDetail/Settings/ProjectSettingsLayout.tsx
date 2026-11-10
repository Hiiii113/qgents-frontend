import { Suspense } from 'react'
import { Tabs } from 'antd'
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageLoader } from '@/components/PageLoader'
import { WorkspacePage } from '@/components/WorkspacePage'
import { PATHS } from '@/routes/paths'

/** 项目管理能力共用横向导航，切换子页时保留标题和标签栏。 */
export function ProjectSettingsLayout() {
  const { projectId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tabs = [
    { key: 'basic', label: '基本信息', path: PATHS.projectSettings(projectId) },
    { key: 'members', label: '成员管理', path: PATHS.projectSettings(projectId) },
    { key: 'agents', label: 'Agent', path: PATHS.projectAgents(projectId) },
    { key: 'skills', label: 'Skill', path: PATHS.projectSkills(projectId) },
    { key: 'memory', label: '共享知识', path: PATHS.projectMemory(projectId) },
    { key: 'code', label: '项目仓库', path: PATHS.projectCode(projectId) },
  ]
  const activeKey = location.pathname.endsWith('/settings')
    ? params.get('tab') === 'members' ? 'members' : 'basic'
    : tabs.find(tab => tab.path === location.pathname)?.key ?? 'basic'

  return <WorkspacePage title="项目设置" description="维护项目资料、成员和协作能力。">
    <Tabs activeKey={activeKey} onChange={key => {
      const tab = tabs.find(item => item.key === key)
      if (!tab) return
      const next = new URLSearchParams()
      const groupId = params.get('groupId')
      if (groupId) next.set('groupId', groupId)
      if (key === 'basic' || key === 'members') next.set('tab', key)
      navigate(tab.path + (next.size ? '?' + next.toString() : ''))
    }} items={tabs.map(tab => ({
      key: tab.key,
      label: tab.label,
      children: tab.key === activeKey && <div className="workspace-page__content">
        <Suspense fallback={<PageLoader />}><Outlet /></Suspense>
      </div>,
    }))} />
  </WorkspacePage>
}
