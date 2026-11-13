import { Suspense } from 'react'
import { Tabs } from 'antd'
import { Outlet, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageLoader } from '@/components/PageLoader'
import { PATHS } from '@/routes/paths'
import { ProjectPage } from '../ProjectPage'

/** 项目设置只保留资料和成员；Agent、Skill、共享知识、仓库在项目一级导航。 */
export function ProjectSettingsLayout() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const activeKey = params.get('tab') === 'members' ? 'members' : 'basic'
  const tabs = [
    { key: 'basic', label: '基本信息' },
    { key: 'members', label: '成员管理' },
  ]

  return (
    <ProjectPage title="项目设置">
      <Tabs
        activeKey={activeKey}
        onChange={(key) => {
          const next = new URLSearchParams()
          const groupId = params.get('groupId')
          const messageId = params.get('messageId')
          if (groupId) next.set('groupId', groupId)
          if (messageId) next.set('messageId', messageId)
          next.set('tab', key)
          navigate(PATHS.projectSettings(projectId) + '?' + next.toString())
        }}
        items={tabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
          children: tab.key === activeKey && (
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          ),
        }))}
      />
    </ProjectPage>
  )
}
