import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { App, Checkbox, Form } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agentApi } from '@/api/agent'
import { mcpApi } from '@/api/mcp'
import { chatKeys } from '@/query/chatKeys'
import { mcpKeys } from '@/query/mcpKeys'
import { formatApiError } from '@/utils/formatApiError'
import {
  Button,
  Dialog,
  EmptyState,
  Icon,
  Section,
  SelectField,
  Skeleton,
  Tag,
  TextField,
} from '@/components/ui'
import type {
  CreateMcpServerPayload,
  McpAuthMode,
  McpCredentialStatus,
  McpScope,
  McpServer,
  Project,
} from '@/types'
import './mcp-settings.css'

const SCOPE: Record<McpScope, string> = {
  SHARED: '项目共享',
  PERSONAL: '成员个人',
}

const AUTH_MODE: Record<McpAuthMode, string> = {
  BEARER: 'Bearer Token',
  OAUTH: 'OAuth',
}

const CREDENTIAL: Record<
  McpCredentialStatus,
  { label: string; tone: 'ok' | 'wait' | 'stop' }
> = {
  MISSING: { label: '未配置凭证', tone: 'wait' },
  CONNECTED: { label: '凭证已连接', tone: 'ok' },
  REAUTH_REQUIRED: { label: '需要重新授权', tone: 'stop' },
}

interface OAuthCallback {
  state: string
  code?: string
}

/** 供应商回跳只把一次性 state 和授权码放进 URL 片段，读一次后立刻从地址栏移除。 */
function parseOAuthCallback(hash: string): OAuthCallback | null {
  if (!hash.startsWith('#')) return null
  const params = new URLSearchParams(hash.slice(1))
  const state = params.get('mcpState')
  if (!state) return null
  const code = params.get('mcpCode')
  return code ? { state, code } : { state }
}

const isMcpUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !!url.host && !url.username && !url.password && !url.hash
  } catch {
    return false
  }
}

/**
 * 项目设置的 MCP 页签。
 * 管理员发布、启停、删除服务并维护共享凭证；每位成员（含管理员）维护个人服务自己的凭证与 Agent。
 */
export function McpSettings({ project }: { project: Project }) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = project.role === 'PROJECT_ADMIN'
  const listKey = mcpKeys.list(project.id)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<McpServer | null>(null)
  const [removing, setRemoving] = useState<McpServer | null>(null)
  const [credentialFor, setCredentialFor] = useState<McpServer | null>(null)
  const [assigning, setAssigning] = useState<McpServer | null>(null)
  const [toolsByServer, setToolsByServer] = useState<Record<string, string[]>>({})
  const [oauthNotice, setOauthNotice] = useState<{
    tone: 'ok' | 'wait' | 'stop'
    text: string
  } | null>(null)

  const servers = useQuery({ queryKey: listKey, queryFn: () => mcpApi.list(project.id) })
  const refresh = () => void client.invalidateQueries({ queryKey: listKey })

  const saveCredential = useMutation({
    mutationFn: ({ server, token }: { server: McpServer; token: string }) =>
      mcpApi.saveCredential(project.id, server.id, token),
    onSuccess: () => {
      refresh()
      setCredentialFor(null)
      void message.success('MCP 凭证已保存')
    },
    onError: (error) => void message.error(formatApiError(error)),
  })

  const disconnect = useMutation({
    mutationFn: (server: McpServer) => mcpApi.disconnectCredential(project.id, server.id),
    onSuccess: () => {
      refresh()
      void message.success('MCP 凭证已断开')
    },
    onError: (error) => void message.error(formatApiError(error)),
  })

  const test = useMutation({
    mutationFn: (server: McpServer) => mcpApi.test(project.id, server.id),
    onSuccess: (result, server) =>
      setToolsByServer((current) => ({ ...current, [server.id]: result.tools })),
    onError: (error) => void message.error(formatApiError(error)),
    onSettled: refresh,
  })

  const startOAuth = useMutation({
    mutationFn: (server: McpServer) => mcpApi.startOAuth(project.id, server.id),
    onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
    onError: (error) => void message.error(formatApiError(error)),
  })

  const { mutate: submitOAuthCallback } = useMutation({
    mutationFn: (callback: OAuthCallback) => mcpApi.completeOAuth(project.id, callback),
    onSuccess: (_data, callback) => {
      setOauthNotice(
        callback.code
          ? { tone: 'ok', text: 'MCP 授权完成，凭证已保存。' }
          : { tone: 'wait', text: '授权已取消，没有保存凭证；需要时可以重新发起授权。' },
      )
      refresh()
    },
    onError: (error) => setOauthNotice({ tone: 'stop', text: formatApiError(error) }),
  })

  const oauthCallback = useMemo(() => parseOAuthCallback(location.hash), [location.hash])
  const handledStates = useRef(new Set<string>())

  useEffect(() => {
    if (!oauthCallback) return
    navigate({ pathname: location.pathname, search: location.search, hash: '' }, { replace: true })
    // StrictMode 会重复执行 effect；同一个 state 只提交一次。
    if (handledStates.current.has(oauthCallback.state)) return
    handledStates.current.add(oauthCallback.state)
    submitOAuthCallback(oauthCallback)
  }, [oauthCallback, location.pathname, location.search, navigate, submitOAuthCallback])

  const remove = useMutation({
    mutationFn: (server: McpServer) => mcpApi.remove(project.id, server.id),
    onSuccess: (_data, server) => {
      refresh()
      setRemoving(null)
      setToolsByServer((current) => {
        const next = { ...current }
        delete next[server.id]
        return next
      })
      void message.success('MCP 服务已删除')
    },
    onError: (error) => void message.error(formatApiError(error)),
  })

  return (
    <Section
      title="MCP 服务"
      aside={
        isAdmin ? (
          <Button
            variant="quiet"
            icon={<Icon name="plus" size={16} aria-hidden />}
            onClick={() => setCreating(true)}
          >
            接入 MCP 服务
          </Button>
        ) : undefined
      }
    >
      {oauthNotice ? (
        <p className={`mcp-notice mcp-notice--${oauthNotice.tone}`} role="status">
          <Icon name={oauthNotice.tone === 'ok' ? 'check' : 'alert'} size={15} aria-hidden />
          {oauthNotice.text}
        </p>
      ) : null}

      {servers.isPending ? (
        <Skeleton rows={3} />
      ) : servers.isError ? (
        <EmptyState
          title="MCP 服务加载失败"
          description={formatApiError(servers.error)}
          action={
            <Button
              variant="link"
              onClick={() => void servers.refetch()}
              icon={<Icon name="refresh" size={15} />}
            >
              重试
            </Button>
          }
          stacked
        />
      ) : servers.data.length === 0 ? (
        <EmptyState
          icon="unlink"
          title="还没有 MCP 服务"
          description={
            isAdmin
              ? '接入远程 MCP 服务；项目共享使用项目凭证，成员个人则由每位成员保存自己的凭证。'
              : '项目管理员发布 MCP 服务后，你可以配置自己的凭证与 Agent。'
          }
          action={
            isAdmin ? (
              <Button
                variant="primary"
                icon={<Icon name="plus" size={16} />}
                onClick={() => setCreating(true)}
              >
                接入 MCP 服务
              </Button>
            ) : undefined
          }
          stacked
        />
      ) : (
        <div className="mcp-list">
          {servers.data.map((server) => {
            const canConfigure = isAdmin || server.scope === 'PERSONAL'
            const tools = toolsByServer[server.id]
            const testing = test.isPending && test.variables?.id === server.id
            const disconnecting = disconnect.isPending && disconnect.variables?.id === server.id
            const authorizing = startOAuth.isPending && startOAuth.variables?.id === server.id

            return (
              <article className="mcp-card" key={server.id}>
                <div className="mcp-card__head">
                  <div className="mcp-card__identity">
                    <div className="mcp-card__title">
                      <h3 className="h3">{server.name}</h3>
                      <Tag>{SCOPE[server.scope]}</Tag>
                      <Tag>{AUTH_MODE[server.authMode]}</Tag>
                      <Tag tone={CREDENTIAL[server.credentialStatus].tone}>
                        {CREDENTIAL[server.credentialStatus].label}
                      </Tag>
                      {server.enabled ? null : <Tag tone="readonly">已停用</Tag>}
                    </div>
                    <p className="mcp-card__url mono">{server.url}</p>
                    <p className="meta">
                      {server.agentIds.length
                        ? `已分配给 ${server.agentIds.length} 个 Agent`
                        : '还没有分配给 Agent'}
                      {server.scope === 'PERSONAL' ? ' · 凭证与分配只对你自己生效' : ''}
                    </p>
                  </div>
                  {isAdmin ? (
                    <div className="mcp-card__admin">
                      <Button
                        variant="quiet"
                        size="sm"
                        aria-label={`编辑 ${server.name}`}
                        icon={<Icon name="edit" size={14} />}
                        onClick={() => setEditing(server)}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="link"
                        aria-label={`删除 ${server.name}`}
                        icon={<Icon name="trash" size={14} />}
                        onClick={() => setRemoving(server)}
                      >
                        删除
                      </Button>
                    </div>
                  ) : null}
                </div>

                {canConfigure ? (
                  <div className="mcp-card__actions">
                    {server.authMode === 'BEARER' ? (
                      <Button
                        variant="quiet"
                        size="sm"
                        icon={<Icon name="lock" size={14} />}
                        onClick={() => setCredentialFor(server)}
                      >
                        {server.credentialStatus === 'MISSING' ? '填写 Token' : '更新 Token'}
                      </Button>
                    ) : (
                      <Button
                        variant="quiet"
                        size="sm"
                        icon={<Icon name="lock" size={14} />}
                        disabled={authorizing}
                        onClick={() => startOAuth.mutate(server)}
                      >
                        {authorizing
                          ? '正在前往授权…'
                          : server.credentialStatus === 'CONNECTED'
                            ? '重新授权'
                            : '授权'}
                      </Button>
                    )}
                    <Button
                      variant="quiet"
                      size="sm"
                      icon={<Icon name="agent" size={14} />}
                      onClick={() => setAssigning(server)}
                    >
                      分配 Agent
                    </Button>
                    <Button
                      variant="quiet"
                      size="sm"
                      icon={<Icon name="activity" size={14} />}
                      disabled={testing}
                      onClick={() => test.mutate(server)}
                    >
                      {testing ? '测试中…' : '测试连接'}
                    </Button>
                    {server.credentialStatus !== 'MISSING' ? (
                      <Button
                        variant="link"
                        disabled={disconnecting}
                        icon={<Icon name="unlink" size={14} />}
                        onClick={() => disconnect.mutate(server)}
                      >
                        {disconnecting ? '断开中…' : '断开凭证'}
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <p className="hint">共享凭证、Agent 分配与测试由项目管理员维护。</p>
                )}

                {tools ? (
                  <div className="mcp-tools">
                    <p className="meta">可用工具（{tools.length}）</p>
                    {tools.length ? (
                      <div className="mcp-tools__list">
                        {tools.map((tool) => (
                          <Tag key={tool}>{tool}</Tag>
                        ))}
                      </div>
                    ) : (
                      <p className="hint">服务没有返回工具。</p>
                    )}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      {creating ? (
        <CreateServerDialog
          projectId={project.id}
          onClose={() => setCreating(false)}
        />
      ) : null}

      {editing ? (
        <EditServerDialog
          key={editing.id}
          projectId={project.id}
          server={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {credentialFor ? (
        <CredentialDialog
          key={credentialFor.id}
          server={credentialFor}
          onClose={() => setCredentialFor(null)}
          onSave={(token) => saveCredential.mutate({ server: credentialFor, token })}
          saving={saveCredential.isPending}
        />
      ) : null}

      {assigning ? (
        <AgentsDialog
          key={assigning.id}
          projectId={project.id}
          server={assigning}
          onClose={() => setAssigning(null)}
        />
      ) : null}

      <Dialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="删除 MCP 服务"
        danger
        description={
          removing
            ? `删除「${removing.name}」后，已分配的 Agent 会失去这组工具，保存的凭证同时清除。`
            : undefined
        }
      >
        <div className="dlg__foot">
          <Button
            variant="quiet"
            onClick={() => setRemoving(null)}
            icon={<Icon name="close" size={15} />}
          >
            取消
          </Button>
          <Button
            variant="danger"
            icon={<Icon name="trash" size={15} />}
            disabled={remove.isPending}
            onClick={() => removing && remove.mutate(removing)}
          >
            {remove.isPending ? '删除中…' : '删除'}
          </Button>
        </div>
      </Dialog>
    </Section>
  )
}

function CreateServerDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const [form] = Form.useForm<CreateMcpServerPayload>()
  const create = useMutation({
    mutationFn: (values: CreateMcpServerPayload) =>
      mcpApi.create(projectId, {
        name: values.name.trim(),
        url: values.url.trim(),
        scope: values.scope,
        authMode: values.authMode,
      }),
    onSuccess: (created) => {
      void client.invalidateQueries({ queryKey: mcpKeys.list(projectId) })
      void message.success(`已接入 ${created.name}`)
      onClose()
    },
    onError: (error) => void message.error(formatApiError(error)),
  })

  return (
    <Dialog
      open
      onClose={() => {
        if (!create.isPending) onClose()
      }}
      title="接入 MCP 服务"
      description="填写远程 MCP 地址并选择凭证归属与鉴权方式；创建后这三项不可修改。"
    >
      <Form
        form={form}
        layout="vertical"
        className="form"
        initialValues={{ scope: 'SHARED', authMode: 'BEARER' }}
        onFinish={(values) => create.mutate(values)}
        disabled={create.isPending}
        requiredMark={false}
      >
        <Form.Item
          name="name"
          label="名称"
          rules={[
            { required: true, whitespace: true, message: '请输入服务名称' },
            { max: 120, message: '名称最多 120 个字符' },
          ]}
        >
          <TextField maxLength={120} autoFocus />
        </Form.Item>
        <Form.Item
          name="url"
          label="服务地址"
          validateTrigger="onBlur"
          extra="填写公网 HTTPS 的 Streamable HTTP 地址。"
          rules={[
            { required: true, whitespace: true, message: '请输入 MCP 服务地址' },
            {
              validator: (_, value: string) =>
                !value || isMcpUrl(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error('请输入完整的 HTTPS 地址，凭证请在创建后填写')),
            },
          ]}
        >
          <TextField placeholder="https://mcp.example.com/mcp" maxLength={2048} />
        </Form.Item>
        <Form.Item
          name="scope"
          label="归属"
          extra="项目共享使用项目凭证；成员个人则由每位成员保存自己的凭证。"
        >
          <SelectField>
            <option value="SHARED">项目共享</option>
            <option value="PERSONAL">成员个人</option>
          </SelectField>
        </Form.Item>
        <Form.Item name="authMode" label="鉴权方式">
          <SelectField>
            <option value="BEARER">手填 Bearer Token</option>
            <option value="OAUTH">OAuth 授权</option>
          </SelectField>
        </Form.Item>
        <div className="dlg__foot">
          <Button
            variant="quiet"
            onClick={onClose}
            icon={<Icon name="close" size={15} />}
            disabled={create.isPending}
          >
            取消
          </Button>
          <Button
            variant="primary"
            type="submit"
            icon={<Icon name="plus" size={15} />}
            disabled={create.isPending}
          >
            {create.isPending ? '接入中…' : '接入'}
          </Button>
        </div>
      </Form>
    </Dialog>
  )
}

function EditServerDialog({
  projectId,
  server,
  onClose,
}: {
  projectId: string
  server: McpServer
  onClose: () => void
}) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const [form] = Form.useForm<{ name: string; enabled: boolean }>()
  const save = useMutation({
    mutationFn: (values: { name: string; enabled: boolean }) =>
      mcpApi.update(projectId, server.id, {
        name: values.name.trim(),
        enabled: values.enabled,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: mcpKeys.list(projectId) })
      void message.success('MCP 服务已保存')
      onClose()
    },
    onError: (error) => void message.error(formatApiError(error)),
  })

  return (
    <Dialog
      open
      onClose={() => {
        if (!save.isPending) onClose()
      }}
      title="编辑 MCP 服务"
      description="只能修改名称与启停；服务地址、归属和鉴权方式需要删除后重新接入才能更换。"
    >
      <Form
        form={form}
        layout="vertical"
        className="form"
        initialValues={{ name: server.name, enabled: server.enabled }}
        onFinish={(values) => save.mutate(values)}
        disabled={save.isPending}
        requiredMark={false}
      >
        <Form.Item
          name="name"
          label="名称"
          rules={[
            { required: true, whitespace: true, message: '请输入服务名称' },
            { max: 120, message: '名称最多 120 个字符' },
          ]}
        >
          <TextField maxLength={120} />
        </Form.Item>
        <Form.Item
          name="enabled"
          label="状态"
          valuePropName="checked"
          extra="停用后 Agent 不会调用这个服务，已保存的凭证保留。"
        >
          <Checkbox>启用这个服务</Checkbox>
        </Form.Item>
        <div className="dlg__foot">
          <Button
            variant="quiet"
            onClick={onClose}
            icon={<Icon name="close" size={15} />}
            disabled={save.isPending}
          >
            取消
          </Button>
          <Button
            variant="primary"
            type="submit"
            icon={<Icon name="check" size={15} />}
            disabled={save.isPending}
          >
            {save.isPending ? '保存中…' : '保存'}
          </Button>
        </div>
      </Form>
    </Dialog>
  )
}

/** Token 只在提交时经过组件状态，保存成功后由父组件关闭弹窗并清空输入。 */
function CredentialDialog({
  server,
  onClose,
  onSave,
  saving,
}: {
  server: McpServer
  onClose: () => void
  onSave: (token: string) => void
  saving: boolean
}) {
  const [form] = Form.useForm<{ token: string }>()

  return (
    <Dialog
      open
      onClose={() => {
        if (!saving) onClose()
      }}
      title={`${server.name} 凭证`}
      description="Token 只提交到服务端，不会保存在浏览器，也不会再显示。"
    >
      <Form
        form={form}
        layout="vertical"
        className="form"
        onFinish={(values) => onSave(values.token.trim())}
        disabled={saving}
        requiredMark={false}
      >
        <Form.Item
          name="token"
          label="Bearer Token"
          rules={[{ required: true, whitespace: true, message: '请输入 Token' }]}
        >
          <TextField
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            autoFocus
          />
        </Form.Item>
        <div className="dlg__foot">
          <Button
            variant="quiet"
            onClick={onClose}
            icon={<Icon name="close" size={15} />}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            variant="primary"
            type="submit"
            icon={<Icon name="lock" size={15} />}
            disabled={saving}
          >
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </Form>
    </Dialog>
  )
}

/** 个人服务的 Agent 分配只对当前成员生效；共享服务则对项目所有运行生效。 */
function AgentsDialog({
  projectId,
  server,
  onClose,
}: {
  projectId: string
  server: McpServer
  onClose: () => void
}) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const [form] = Form.useForm<{ agentIds: string[] }>()
  const agents = useQuery({
    queryKey: chatKeys.agents(projectId),
    queryFn: () => agentApi.list(projectId),
  })
  const save = useMutation({
    mutationFn: (agentIds: string[]) => mcpApi.assignAgents(projectId, server.id, agentIds),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: mcpKeys.list(projectId) })
      void message.success('Agent 分配已保存')
      onClose()
    },
    onError: (error) => void message.error(formatApiError(error)),
  })

  if (agents.isPending) {
    return (
      <Dialog open onClose={onClose} title={`${server.name} 的 Agent`}>
        <p className="hint">正在加载项目 Agent…</p>
      </Dialog>
    )
  }
  if (agents.isError) {
    return (
      <Dialog open onClose={onClose} title={`${server.name} 的 Agent`}>
        <p className="err">{formatApiError(agents.error)}</p>
      </Dialog>
    )
  }

  const active = agents.data.filter((agent) => agent.status === 'ACTIVE')
  const knownIds = new Set(active.map((agent) => agent.id))
  const inactiveCount = server.agentIds.filter((id) => !knownIds.has(id)).length

  return (
    <Dialog
      open
      onClose={() => {
        if (!save.isPending) onClose()
      }}
      title={`${server.name} 的 Agent`}
      description="选择可以使用这个 MCP 服务的 Agent；保存后未选中的 Agent 会失去这组工具。"
    >
      <Form
        form={form}
        layout="vertical"
        className="form"
        initialValues={{ agentIds: server.agentIds.filter((id) => knownIds.has(id)) }}
        onFinish={(values) => save.mutate(values.agentIds ?? [])}
        disabled={save.isPending}
        requiredMark={false}
      >
        {active.length === 0 ? (
          <p className="meta">项目里还没有已启用的 Agent。</p>
        ) : (
          <Form.Item name="agentIds" label="可使用的 Agent">
            <Checkbox.Group
              className="checks"
              options={active.map((agent) => ({ value: agent.id, label: agent.name }))}
            />
          </Form.Item>
        )}
        {inactiveCount ? (
          <p className="hint">
            另有 {inactiveCount} 个已停用的 Agent 不在可选范围，保存后将取消分配。
          </p>
        ) : null}
        <div className="dlg__foot">
          <Button
            variant="quiet"
            onClick={onClose}
            icon={<Icon name="close" size={15} />}
            disabled={save.isPending}
          >
            取消
          </Button>
          <Button
            variant="primary"
            type="submit"
            icon={<Icon name="check" size={15} />}
            disabled={save.isPending || active.length === 0}
          >
            {save.isPending ? '保存中…' : '保存'}
          </Button>
        </div>
      </Form>
    </Dialog>
  )
}
