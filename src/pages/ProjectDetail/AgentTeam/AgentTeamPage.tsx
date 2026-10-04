import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, App, Avatar, Button, Empty, Form, Input, Modal, Popconfirm, Select, Spin, Switch, Tag } from 'antd'
import { PlusOutlined, RobotOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agentApi } from '@/api/agent'
import { projectApi } from '@/api/project'
import { teamApi } from '@/api/team'
import { useAgents } from '@/hooks/agents'
import { useAuth } from '@/context/AuthContext'
import { WorkspacePage } from '@/components/WorkspacePage'
import { formatApiError } from '@/utils/formatApiError'
import { queryKeys } from '@/query/queryKeys'
import { PATHS } from '@/routes/paths'
import type { AgentSummary, CreateAgentPayload } from '@/types/agent'

export default function AgentTeamPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const { message, modal } = App.useApp()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AgentSummary | null>(null)
  const [form] = Form.useForm<CreateAgentPayload>()
  const [visibility, setVisibility] = useState('ACTIVE')
  const project = useQuery({ queryKey: ['projects', projectId], queryFn: () => projectApi.getById(projectId), enabled: Boolean(projectId) })
  const teamId = project.data?.teamId || ''
  const team = useQuery({ queryKey: ['teams', teamId], queryFn: () => teamApi.getById(teamId), enabled: Boolean(teamId) })
  const list = useAgents(teamId)
  const owner = team.data?.role === 'TEAM_OWNER'
  const visibleAgents = list.data?.filter(agent => agent.status === visibility) ?? []
  function refresh() { void client.invalidateQueries({ queryKey: queryKeys.agents.all(teamId) }) }
  const save = useMutation({
    mutationFn: (body: CreateAgentPayload) => editing ? agentApi.update(teamId, editing.id, body) : agentApi.create(teamId, body),
    onSuccess: () => { setOpen(false); refresh(); void message.success(editing ? 'Agent 已更新' : 'Agent 已创建') },
    onError: error => void message.error(formatApiError(error)),
  })
  const action = useMutation({
    mutationFn: async ({ id, kind, reason }: { id: string; kind: 'publish' | 'approve' | 'reject' | 'archive'; reason?: string }) => kind === 'reject'
      ? agentApi.reject(teamId, id, reason) : agentApi[kind](teamId, id),
    onSuccess: () => refresh(), onError: error => void message.error(formatApiError(error)),
  })
  const github = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => agentApi.configureGithub(teamId, id, enabled),
    onSuccess: () => refresh(), onError: error => void message.error(formatApiError(error)),
  })
  async function edit(agent: AgentSummary) {
    try {
      const detail = await agentApi.get(teamId, agent.id)
      setEditing(agent); form.setFieldsValue({ name: detail.name, description: detail.description || '', role: detail.role, prompt: detail.prompt || '', githubEnabled: detail.githubEnabled }); setOpen(true)
    } catch (error) { void message.error(formatApiError(error)) }
  }
  function reject(agent: AgentSummary) {
    let reason = ''
    modal.confirm({ title: '拒绝共享这个 Agent？', content: <Input.TextArea placeholder="说明需要调整的地方（可选）" onChange={event => { reason = event.target.value }} />,
      onOk: () => action.mutateAsync({ id: agent.id, kind: 'reject', reason }) })
  }
  return <WorkspacePage title="Agent 伙伴" description="选择与你协作的 Agent。在聊天中 @它，讨论、分析或执行工作；不需要预先安排固定流程。"
    action={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>创建 Agent</Button>}>
    <div className="workspace-page__toolbar"><Select aria-label="Agent 状态" value={visibility} onChange={setVisibility} style={{ width: 160 }} options={[{ value: 'ACTIVE', label: '可用 Agent' }, { value: 'ARCHIVED', label: '已归档' }]} /><Link to={PATHS.projectChat(projectId)}><Button>回到聊天</Button></Link></div>
    {list.isError && <Alert type="error" showIcon message={formatApiError(list.error)} action={<Button onClick={() => void list.refetch()}>重试</Button>} />}
    {list.isPending ? <Spin /> : !visibleAgents.length ? <Empty description="暂无 Agent" /> : <div className="workspace-page__grid">{visibleAgents.map(agent => {
      const creator = agent.createdBy === user?.id
      const canEdit = creator && !agent.isDefault && agent.status === 'ACTIVE'
      return <article className="workspace-card" key={agent.id}>
        <Avatar src={agent.avatar} icon={<RobotOutlined />} size={44} style={{ background: '#e4eddd', color: '#4f7146', marginBottom: 15 }} />
        <h2>{agent.name}</h2><Tag bordered={false}>{agent.isDefault ? '团队默认' : agent.visibility === 'TEAM' ? '团队共享' : agent.visibility === 'PENDING' ? '等待审核' : '仅自己可用'}</Tag>
        <p>{agent.description || '在聊天里告诉它你希望完成什么。'}</p>
        {agent.githubEnabled && <span className="workspace-card__label">已开启 GitHub 能力</span>}
        {agent.reviewReason && <p>审核意见：{agent.reviewReason}</p>}
        <div className="workspace-card__actions">
          {owner && agent.isDefault && agent.status === 'ACTIVE' && <Switch aria-label={`${agent.name}的 GitHub 能力`} checkedChildren="GitHub 开" unCheckedChildren="GitHub 关" checked={agent.githubEnabled} loading={github.isPending && github.variables?.id === agent.id} onChange={enabled => github.mutate({ id: agent.id, enabled })} />}
          {canEdit && <Button size="small" type="text" onClick={() => void edit(agent)}>编辑</Button>}
          {canEdit && agent.visibility === 'PRIVATE' && <Button size="small" type="text" onClick={() => action.mutate({ id: agent.id, kind: 'publish' })}>共享给团队</Button>}
          {owner && !agent.isDefault && agent.visibility === 'PENDING' && <><Button size="small" type="text" onClick={() => action.mutate({ id: agent.id, kind: 'approve' })}>批准共享</Button><Button size="small" type="text" onClick={() => reject(agent)}>拒绝</Button></>}
          {(creator || owner) && !agent.isDefault && agent.status === 'ACTIVE' && <Popconfirm title="归档这个 Agent？" onConfirm={() => action.mutateAsync({ id: agent.id, kind: 'archive' })}><Button size="small" type="text" danger>归档</Button></Popconfirm>}
        </div>
      </article>
    })}</div>}
    <Modal title={editing ? '编辑 Agent' : '创建你的 Agent'} open={open} onCancel={() => setOpen(false)} okText="保存" cancelText="取消" confirmLoading={save.isPending} onOk={() => form.submit()}>
      <Form form={form} layout="vertical" initialValues={{ role: 'GENERAL', githubEnabled: false }} onFinish={values => save.mutate(values)}>
        <Form.Item name="name" label="名称" rules={[{ required: true, whitespace: true, message: '请输入 Agent 名称' }]}><Input maxLength={80} /></Form.Item>
        <Form.Item name="role" hidden><Input /></Form.Item>
        <Form.Item name="description" label="简介"><Input.TextArea maxLength={1000} autoSize={{ minRows: 2, maxRows: 4 }} /></Form.Item>
        <Form.Item name="prompt" label="协作说明" rules={[{ required: true, whitespace: true, message: '请说明 Agent 的职责与工作方式' }]}><Input.TextArea placeholder="希望它擅长什么，如何与你协作？" autoSize={{ minRows: 5, maxRows: 10 }} /></Form.Item>
        <Form.Item name="githubEnabled" label="开启 GitHub 能力" valuePropName="checked" extra="开启后可操作当前项目导入的 GitHub 仓库。"><Switch /></Form.Item>
      </Form>
    </Modal>
  </WorkspacePage>
}
