import { useState } from 'react'
import { App, Form } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agentApi } from '@/api/agent'
import { chatApi } from '@/api/chat'
import { projectApi } from '@/api/project'
import { teamApi } from '@/api/team'
import { useAuth } from '@/context/AuthContext'
import { formatApiError } from '@/utils/formatApiError'
import { chatKeys } from '@/query/chatKeys'
import type { ChatGroup } from '@/types/chat'
import { Avatar, Button, Dialog, Skeleton, TextField } from '@/components/ui'

interface Values {
  title?: string
  userIds?: string[]
  agentIds?: string[]
}

/**
 * 建群与追加邀请共用成员选择：只提交选择的真实成员 ID，
 * 创建者由服务端自动入群，待审批 Agent 不会出现在可选列表里。
 */
export function GroupMembersDialog({
  projectId,
  teamId,
  group,
  open,
  onClose,
  onCreated,
}: {
  projectId: string
  teamId: string
  group?: ChatGroup
  open: boolean
  onClose: () => void
  onCreated?: (group: ChatGroup) => void
}) {
  const [form] = Form.useForm<Values>()
  const [error, setError] = useState('')
  const { user } = useAuth()
  const { message } = App.useApp()
  const client = useQueryClient()
  const enabled = open && Boolean(projectId) && Boolean(teamId)
  const members = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => projectApi.listMembers(projectId),
    enabled,
  })
  const teamMembers = useQuery({
    queryKey: ['teams', teamId, 'members'],
    queryFn: () => teamApi.listMembers(teamId),
    enabled,
  })
  const current = useQuery({
    queryKey: chatKeys.members(projectId, group?.id ?? ''),
    queryFn: () => chatApi.members(projectId, group?.id ?? ''),
    enabled: enabled && Boolean(group),
  })
  const agents = useQuery({
    queryKey: chatKeys.agents(projectId),
    queryFn: () => agentApi.list(projectId),
    enabled,
  })

  const joined = new Set(current.data?.map((member) => `${member.memberType}:${member.id}`))
  const users = (members.data ?? [])
    .filter((member) => member.userId !== user?.id)
    .map((member) => {
      const detail = teamMembers.data?.find((item) => item.userId === member.userId)
      return {
        id: member.userId,
        name: detail?.displayName || member.displayName || detail?.email || member.userId,
        meta: detail?.email || member.email || '成员',
        avatarUrl: detail?.avatarUrl || member.avatarUrl,
        joined: joined.has(`USER:${member.userId}`),
      }
    })
    .filter((member) => !member.joined)
  const agentRows = (agents.data ?? [])
    .filter((agent) => agent.status === 'ACTIVE' && !joined.has(`AGENT:${agent.id}`))
    .map((agent) => ({ id: agent.id, name: agent.name, avatarUrl: agent.avatarUrl }))

  const mutation = useMutation({
    mutationFn: async () => {
      const values = await form.validateFields()
      const body = {
        title: values.title?.trim() ?? '',
        userIds: values.userIds ?? [],
        agentIds: values.agentIds ?? [],
      }
      return group ? chatApi.invite(projectId, group.id, body) : chatApi.createGroup(projectId, body)
    },
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: chatKeys.groups(projectId) })
      if (group) {
        void client.invalidateQueries({ queryKey: chatKeys.members(projectId, group.id) })
        void message.success('成员已加入群聊')
      } else {
        const created = result as ChatGroup
        client.setQueryData<ChatGroup[]>(chatKeys.groups(projectId), (groups) => [
          ...(groups ?? []).filter((item) => item.id !== created.id),
          created,
        ])
        onCreated?.(created)
        void message.success('群聊已创建')
      }
      form.resetFields()
      setError('')
      onClose()
    },
    onError: (failure) => {
      if (!(typeof failure === 'object' && failure && 'errorFields' in failure))
        setError(formatApiError(failure))
    },
  })

  const loading =
    members.isPending ||
    teamMembers.isPending ||
    agents.isPending ||
    (Boolean(group) && current.isPending)
  const failed = members.isError || teamMembers.isError || agents.isError || current.isError

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={group ? '邀请群成员' : '新建群聊'}
      description={
        group
          ? '只列出项目成员与本项目已启用的 Agent，已入群的不会重复出现。'
          : '新群只有在你选择后才邀请成员与 Agent。'
      }
    >
      <Form
        form={form}
        layout="vertical"
        className="form"
        onFinish={() => mutation.mutate()}
        disabled={mutation.isPending}
        requiredMark={false}
      >
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        {!group ? (
          <Form.Item
            name="title"
            label="群名"
            rules={[{ required: true, whitespace: true, message: '请输入群名' }]}
          >
            <TextField maxLength={120} placeholder="例如：前端周会" autoFocus />
          </Form.Item>
        ) : null}
        {loading ? <Skeleton rows={2} /> : null}
        {failed ? (
          <p className="err">
            成员列表加载失败。
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                void members.refetch()
                void teamMembers.refetch()
                void agents.refetch()
              }}
            >
              重试
            </Button>
          </p>
        ) : null}
        {!loading && !failed ? (
          <div className="dialog-checks">
            <div>
              <p className="dialog-checks__label">项目成员</p>
              <Form.Item name="userIds" noStyle>
                <CheckGroup rows={users} empty="项目里没有可邀请的成员。" />
              </Form.Item>
            </div>
            <div>
              <p className="dialog-checks__label">已启用的 Agent</p>
              <Form.Item name="agentIds" noStyle>
                <CheckGroup rows={agentRows} empty="本项目还没有已启用的 Agent。" agent />
              </Form.Item>
            </div>
          </div>
        ) : null}
        <div className="dlg__foot">
          <Button variant="quiet" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" type="submit" disabled={loading || failed}>
            {mutation.isPending ? '提交中…' : group ? '邀请' : '创建群聊'}
          </Button>
        </div>
      </Form>
    </Dialog>
  )
}

interface Row {
  id: string
  name: string
  avatarUrl?: string | null
  meta?: string
}

/** Checkbox group 需同时支持 antd Form 注入的 value/onChange 与直接渲染。 */
function CheckGroup({
  rows,
  empty,
  agent,
  value = [],
  onChange,
}: {
  rows: Row[]
  empty: string
  agent?: boolean
  value?: string[]
  onChange?: (value: string[]) => void
}) {
  if (!rows.length) return <p className="meta">{empty}</p>
  const toggle = (id: string, checked: boolean) => {
    const next = checked ? [...value, id] : value.filter((item) => item !== id)
    onChange?.(next)
  }
  return (
    <div className="dialog-checks__group">
      {rows.map((row) => (
        <label className="check" key={row.id}>
          <input
            type="checkbox"
            checked={value.includes(row.id)}
            onChange={(event) => toggle(row.id, event.target.checked)}
          />
          <Avatar name={row.name} src={row.avatarUrl} type={agent ? 'agent' : 'user'} size="sm" />
          <span>
            {row.name}
            {row.meta ? <span className="meta"> · {row.meta}</span> : null}
          </span>
        </label>
      ))}
    </div>
  )
}
