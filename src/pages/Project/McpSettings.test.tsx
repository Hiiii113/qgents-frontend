import type { ReactNode } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useLocation } from 'react-router-dom'
import { agentApi } from '@/api/agent'
import { mcpApi } from '@/api/mcp'
import { renderWorkspace } from '@/test/renderWorkspace'
import type { McpServer, ProjectRole } from '@/types'
import ProjectSettingsPage from './ProjectSettingsPage'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const shared: McpServer = {
  id: 'm1',
  name: 'Notion 项目库',
  url: 'https://mcp.notion.com/mcp',
  scope: 'SHARED',
  authMode: 'OAUTH',
  enabled: true,
  credentialStatus: 'CONNECTED',
  agentIds: ['a1'],
}

const personal: McpServer = {
  id: 'm2',
  name: 'Linear 我的待办',
  url: 'https://mcp.linear.app/mcp',
  scope: 'PERSONAL',
  authMode: 'BEARER',
  enabled: true,
  credentialStatus: 'MISSING',
  agentIds: [],
}

const qgent = {
  id: 'a1',
  name: 'Qgent',
  defaultAgent: true,
  status: 'ACTIVE' as const,
}

interface OpenOptions {
  path?: string
  extra?: ReactNode
}

function open(role: ProjectRole, servers: McpServer[], options: OpenOptions = {}) {
  const list = vi.spyOn(mcpApi, 'list').mockResolvedValue(servers)
  const result = renderWorkspace(
    <>
      {options.extra}
      <ProjectSettingsPage />
    </>,
    options.path ?? '/app/projects/p1/settings?tab=mcp',
    '/app/projects/:projectId/settings',
    (client: QueryClient) => {
      client.setQueryData(['projects', 'p1'], {
        id: 'p1',
        teamId: 't1',
        name: 'qgents-web',
        role,
        status: 'ACTIVE',
      })
    },
  )
  return { ...result, list }
}

/** 把地址片段渲染出来，验证回调参数读一次后从地址栏移除。 */
function HashProbe() {
  const location = useLocation()
  return <output data-testid="hash">{location.hash}</output>
}

const cardOf = (name: string) => within(screen.getByText(name).closest('article') as HTMLElement)

it('publishes a new MCP service with the chosen scope and auth mode', async () => {
  const create = vi.spyOn(mcpApi, 'create').mockResolvedValue({
    ...personal,
    id: 'm3',
    name: 'Sentry',
    url: 'https://mcp.sentry.dev/mcp',
    authMode: 'OAUTH',
  })
  open('PROJECT_ADMIN', [])

  fireEvent.click((await screen.findAllByRole('button', { name: '接入 MCP 服务' }))[0])
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('名称'), { target: { value: 'Sentry' } })
  fireEvent.change(within(dialog).getByLabelText('服务地址'), {
    target: { value: 'https://mcp.sentry.dev/mcp' },
  })
  fireEvent.change(within(dialog).getByLabelText('归属'), { target: { value: 'PERSONAL' } })
  fireEvent.change(within(dialog).getByLabelText('鉴权方式'), { target: { value: 'OAUTH' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '接入' }))

  await waitFor(() =>
    expect(create).toHaveBeenCalledWith('p1', {
      name: 'Sentry',
      url: 'https://mcp.sentry.dev/mcp',
      scope: 'PERSONAL',
      authMode: 'OAUTH',
    }),
  )
})

it('keeps shared credentials with admins while members save their own personal token', async () => {
  const saveCredential = vi.spyOn(mcpApi, 'saveCredential').mockResolvedValue(undefined)
  open('PROJECT_MEMBER', [shared, personal])

  expect(await screen.findByText('Notion 项目库')).toBeInTheDocument()
  expect(screen.getByText('项目共享')).toBeInTheDocument()
  expect(screen.getByText('成员个人')).toBeInTheDocument()
  expect(screen.getByText('凭证已连接')).toBeInTheDocument()
  expect(screen.getByText('未配置凭证')).toBeInTheDocument()

  const sharedCard = cardOf('Notion 项目库')
  const personalCard = cardOf('Linear 我的待办')
  expect(screen.queryByRole('button', { name: '接入 MCP 服务' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '编辑 Notion 项目库' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '删除 Linear 我的待办' })).not.toBeInTheDocument()
  expect(
    sharedCard.getByText('共享凭证、Agent 分配与测试由项目管理员维护。'),
  ).toBeInTheDocument()
  expect(sharedCard.queryByRole('button', { name: '重新授权' })).not.toBeInTheDocument()
  expect(sharedCard.queryByRole('button', { name: '测试连接' })).not.toBeInTheDocument()
  expect(personalCard.getByRole('button', { name: '填写 Token' })).toBeInTheDocument()
  expect(personalCard.getByRole('button', { name: '分配 Agent' })).toBeInTheDocument()
  expect(personalCard.getByRole('button', { name: '测试连接' })).toBeInTheDocument()

  fireEvent.click(personalCard.getByRole('button', { name: '填写 Token' }))
  const dialog = await screen.findByRole('dialog')
  const input = within(dialog).getByLabelText('Bearer Token')
  expect(input).toHaveAttribute('type', 'password')

  const token = 'lin_api_personal_secret'
  fireEvent.change(input, { target: { value: token } })
  fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))

  await waitFor(() => expect(saveCredential).toHaveBeenCalledWith('p1', 'm2', token))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(document.body.textContent).not.toContain(token)
})

it('saves only the service name and enabled state, then removes the service', async () => {
  const update = vi.spyOn(mcpApi, 'update').mockResolvedValue(undefined)
  const remove = vi.spyOn(mcpApi, 'remove').mockResolvedValue(undefined)
  open('PROJECT_ADMIN', [personal])

  fireEvent.click(await screen.findByRole('button', { name: '编辑 Linear 我的待办' }))
  let dialog = await screen.findByRole('dialog')
  expect(within(dialog).queryByLabelText('服务地址')).not.toBeInTheDocument()
  fireEvent.change(within(dialog).getByLabelText('名称'), { target: { value: 'Linear 待办' } })
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /启用这个服务/ }))
  fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))

  await waitFor(() =>
    expect(update).toHaveBeenCalledWith('p1', 'm2', { name: 'Linear 待办', enabled: false }),
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: '删除 Linear 我的待办' }))
  dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: '删除' }))
  await waitFor(() => expect(remove).toHaveBeenCalledWith('p1', 'm2'))
})

it('completes the OAuth callback once, clears the fragment and refreshes the list', async () => {
  const complete = vi.spyOn(mcpApi, 'completeOAuth').mockResolvedValue(undefined)
  const { list } = open('PROJECT_MEMBER', [personal], {
    path: '/app/projects/p1/settings?tab=mcp#mcpState=st-1&mcpCode=code-1',
    extra: <HashProbe />,
  })

  await waitFor(() => expect(complete).toHaveBeenCalledTimes(1))
  expect(complete).toHaveBeenCalledWith('p1', { state: 'st-1', code: 'code-1' })
  expect(await screen.findByText('MCP 授权完成，凭证已保存。')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByTestId('hash').textContent).toBe(''))
  await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
})

it('reports a cancelled OAuth login without saving a credential', async () => {
  const complete = vi.spyOn(mcpApi, 'completeOAuth').mockResolvedValue(undefined)
  open('PROJECT_MEMBER', [personal], {
    path: '/app/projects/p1/settings?tab=mcp#mcpState=st-2',
  })

  await waitFor(() => expect(complete).toHaveBeenCalledWith('p1', { state: 'st-2' }))
  expect(await screen.findByText(/授权已取消/)).toBeInTheDocument()
})

it('shows the tools returned by the connection test', async () => {
  const test = vi.spyOn(mcpApi, 'test').mockResolvedValue({ tools: ['search', 'create_page'] })
  open('PROJECT_MEMBER', [personal])

  fireEvent.click(await screen.findByRole('button', { name: '测试连接' }))
  expect(await screen.findByText('search')).toBeInTheDocument()
  expect(screen.getByText('create_page')).toBeInTheDocument()
  expect(screen.getByText('可用工具（2）')).toBeInTheDocument()
  expect(test).toHaveBeenCalledWith('p1', 'm2')
})

it('assigns only active project agents to a personal service', async () => {
  const assign = vi.spyOn(mcpApi, 'assignAgents').mockResolvedValue(undefined)
  vi.spyOn(agentApi, 'list').mockResolvedValue([
    qgent,
    { id: 'a2', name: '审阅 Agent', defaultAgent: false, status: 'PENDING' },
  ])
  open('PROJECT_MEMBER', [personal])

  fireEvent.click(await screen.findByRole('button', { name: '分配 Agent' }))
  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByRole('checkbox', { name: /Qgent/ })).not.toBeChecked()
  expect(within(dialog).queryByRole('checkbox', { name: /审阅 Agent/ })).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /Qgent/ }))
  fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))

  await waitFor(() => expect(assign).toHaveBeenCalledWith('p1', 'm2', ['a1']))
})
