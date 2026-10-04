import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Route, Routes, useLocation } from 'react-router-dom'
import { renderWorkspace } from '@/test/renderWorkspace'
import AgentTeamPage from '../AgentTeam/AgentTeamPage'
import { CodePage } from '../Code/CodePage'
import { MemoryPage } from '../Memory/MemoryPage'
import { SkillPage } from '../Skill/SkillPage'
import { SettingsPage } from './SettingsPage'
import { ProjectSettingsLayout } from './ProjectSettingsLayout'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
afterEach(cleanup)

function Address() {
  const location = useLocation()
  return <output>{location.pathname + location.search}</output>
}

function openSettings(path: string) {
  return renderWorkspace(<><Routes><Route element={<ProjectSettingsLayout />}>
    <Route path="settings" element={<SettingsPage />} />
    <Route path="agents" element={<AgentTeamPage />} />
    <Route path="skills" element={<SkillPage />} />
    <Route path="memory" element={<MemoryPage />} />
    <Route path="code" element={<CodePage />} />
  </Route></Routes><Address /></>, path, '/app/projects/:projectId/*', client => {
    client.setQueryData(['projects', 'p1'], { id: 'p1', teamId: 't1', name: '项目', role: 'PROJECT_ADMIN' })
    client.setQueryData(['teams', 't1'], { id: 't1', role: 'TEAM_OWNER' })
    client.setQueryData(['teams', 't1', 'agents', 'list'], [])
    client.setQueryData(['projects', 'p1', 'members'], [{ userId: 'u1', displayName: '创建者', role: 'PROJECT_ADMIN' }])
    client.setQueryData(['teams', 't1', 'members'], [])
    client.setQueryData(['skills', 'p1'], [])
    client.setQueryData(['memories', 'p1'], [])
    client.setQueryData(['repositories', 'p1'], [])
  })
}

it('opens every management capability from the same horizontal tabs and preserves the chat group', async () => {
  openSettings('/app/projects/p1/settings?groupId=g2')
  const heading = screen.getByRole('heading', { name: '项目设置' })
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
    '基本信息', '成员管理', 'Agent', 'Skill', '共享知识', '项目仓库',
  ])
  for (const [label, path, control] of [
    ['Agent', 'agents', '创建 Agent'],
    ['Skill', 'skills', '新建 Skill'],
    ['共享知识', 'memory', '新建 Memory'],
    ['项目仓库', 'code', '导入仓库'],
  ]) {
    fireEvent.click(screen.getByRole('tab', { name: label }))
    expect(await screen.findByRole('button', { name: new RegExp(control) })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(`/app/projects/p1/${path}?groupId=g2`)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '项目设置' })).toBe(heading)
  }
  fireEvent.click(screen.getByRole('tab', { name: '成员管理' }))
  expect(await screen.findByText('创建者')).toBeInTheDocument()
  expect(screen.getByText('/app/projects/p1/settings?groupId=g2&tab=members')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: '基本信息' }))
  expect(await screen.findByRole('button', { name: '保存资料' })).toBeInTheDocument()
})

it('selects the repository tab when opening its existing deep link directly', () => {
  openSettings('/app/projects/p1/code')
  expect(screen.getByRole('tab', { name: '项目仓库' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('button', { name: /导入仓库/ })).toBeInTheDocument()
  expect(screen.queryByText('项目工具')).not.toBeInTheDocument()
})
