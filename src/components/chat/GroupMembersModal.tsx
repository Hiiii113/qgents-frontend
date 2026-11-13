import { useState } from 'react'
import { Alert, App, Avatar, Button, Checkbox, Form, Input, Modal } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agentApi } from '@/api/agent'
import { chatApi } from '@/api/chat'
import { projectApi } from '@/api/project'
import { teamApi } from '@/api/team'
import { useAuth } from '@/context/AuthContext'
import { formatApiError } from '@/utils/formatApiError'
import { chatKeys } from './useChatMessages'
import type { ChatGroup } from '@/types/chat'
import './GroupMembersModal.css'

/** 一行候选成员；joined 表示已在群里，显示为勾选且不可再提交。 */
interface MemberRow {
  key: string
  value: string
  name: string
  meta?: string
  avatarUrl?: string | null
  agent: boolean
  joined: boolean
}

/** 建群与追加邀请共用成员选择；只提交选择的 ID，创建者由服务端自动入群。 */
export function GroupMembersModal({
  projectId,
  teamId,
  group,
  onClose,
  onCreated,
}: {
  projectId: string
  teamId: string
  group?: ChatGroup
  onClose: () => void
  onCreated?: (group: ChatGroup) => void
}) {
  const [form] = Form.useForm<{
    title: string
    userIds: string[]
    agentIds: string[]
  }>()
  const [error, setError] = useState('')
  const { user } = useAuth()
  const { message } = App.useApp()
  const client = useQueryClient()
  const members = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => projectApi.listMembers(projectId),
  })
  const teamMembers = useQuery({
    queryKey: ['teams', teamId, 'members'],
    queryFn: () => teamApi.listMembers(teamId),
  })
  const current = useQuery({
    queryKey: chatKeys.members(projectId, group?.id ?? ''),
    queryFn: () => chatApi.members(projectId, group!.id),
    enabled: Boolean(group),
  })
  // 只有本项目已启用的 Agent 能邀请入群；待审批申请不在列表接口中。
  const agents = useQuery({
    queryKey: chatKeys.agents(projectId),
    queryFn: () => agentApi.list(projectId),
  })
  const existing = new Set(current.data?.map((member) => `${member.memberType}:${member.id}`))
  const mutation = useMutation({
    mutationFn: async () => {
      const values = await form.validateFields()
      const body = {
        title: values.title?.trim(),
        userIds: values.userIds ?? [],
        agentIds: values.agentIds ?? [],
      }
      return group
        ? chatApi.invite(projectId, group.id, body)
        : chatApi.createGroup(projectId, body)
    },
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: chatKeys.groups(projectId) })
      if (group) void client.invalidateQueries({ queryKey: chatKeys.members(projectId, group.id) })
      else {
        const created = result as ChatGroup
        client.setQueryData<ChatGroup[]>(chatKeys.groups(projectId), (groups) => [
          ...(groups ?? []).filter((item) => item.id !== created.id),
          created,
        ])
        onCreated?.(created)
      }
      void message.success(group ? '成员已加入群聊' : '群聊已创建')
      onClose()
    },
    onError: (error) => {
      if (!(typeof error === 'object' && error && 'errorFields' in error))
        setError(formatApiError(error))
    },
  })
  const loading =
    members.isPending ||
    teamMembers.isPending ||
    agents.isPending ||
    (Boolean(group) && current.isPending)
  const failed = members.isError || teamMembers.isError || agents.isError || current.isError
  // 人与 Agent 的 ID 各自从 1 开始，会撞号：按成员类型拼接后判断，避免把同号的 Agent 误判为已入群。
  const users: MemberRow[] = (members.data ?? [])
    .filter((member) => member.userId !== user?.id)
    .map((member) => {
      const detail = teamMembers.data?.find((item) => item.userId === member.userId)
      return {
        key: `USER:${member.userId}`,
        value: member.userId,
        name: detail?.displayName || member.displayName || detail?.email || member.userId,
        meta: detail?.email || member.email || undefined,
        avatarUrl: detail?.avatarUrl || member.avatarUrl,
        agent: false,
        joined: existing.has(`USER:${member.userId}`),
      }
    })
  const agentRows: MemberRow[] = (agents.data ?? []).map((agent) => ({
    key: `AGENT:${agent.id}`,
    value: agent.id,
    name: agent.name,
    meta: 'Agent',
    avatarUrl: agent.avatarUrl,
    agent: true,
    joined: existing.has(`AGENT:${agent.id}`),
  }))
  const renderRows = (rows: MemberRow[], empty: string) =>
    rows.length ? (
      rows.map((row) => (
        <Checkbox
          key={row.key}
          className="group-modal__row"
          value={row.value}
          checked={row.joined || undefined}
          disabled={row.joined}
          // 已入群的勾选只是展示，不能混进邀请的 userIds / agentIds。
          skipGroup={row.joined}
        >
          <span className="group-modal__member">
            <Avatar
              src={row.avatarUrl}
              icon={row.agent ? <RobotOutlined /> : undefined}
              size="small"
            >
              {row.agent ? undefined : row.name.slice(0, 1)}
            </Avatar>
            <span className="group-modal__member-text">
              <span className="group-modal__member-name">{row.name}</span>
              {row.meta && <span className="group-modal__member-meta">{row.meta}</span>}
            </span>
          </span>
        </Checkbox>
      ))
    ) : loading ? null : (
      <p className="group-modal__empty">{empty}</p>
    )
  return (
    <Modal
      open
      title={group ? '邀请加入群聊' : '创建新群聊'}
      okText={group ? '邀请加入' : '创建群聊'}
      cancelText="取消"
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: loading || failed }}
      onOk={() => {
        setError('')
        mutation.mutate()
      }}
      onCancel={onClose}
      maskClosable={!mutation.isPending}
      closable={!mutation.isPending}
      cancelButtonProps={{ disabled: mutation.isPending }}
    >
      {(error || failed) && (
        <Alert
          type="error"
          showIcon
          message={error || '成员加载失败'}
          action={
            failed ? (
              <Button
                onClick={() => {
                  void members.refetch()
                  void teamMembers.refetch()
                  void agents.refetch()
                  if (group) void current.refetch()
                }}
              >
                重试
              </Button>
            ) : undefined
          }
        />
      )}
      <Form
        form={form}
        layout="vertical"
        initialValues={{ userIds: [], agentIds: [] }}
        disabled={mutation.isPending}
      >
        {!group && (
          <>
            <Form.Item
              name="title"
              label="群聊名称"
              rules={[{ required: true, whitespace: true, message: '请输入群聊名称' }]}
            >
              <Input maxLength={255} placeholder="例如：产品想法、前端协作" autoFocus />
            </Form.Item>
          </>
        )}
        <Form.Item name="userIds" label="项目成员">
          <Checkbox.Group className="group-modal__options">
            {renderRows(users, '暂无可邀请的项目成员')}
          </Checkbox.Group>
        </Form.Item>
        <Form.Item name="agentIds" label="Agent">
          <Checkbox.Group className="group-modal__options">
            {renderRows(agentRows, '暂无可邀请的 Agent')}
          </Checkbox.Group>
        </Form.Item>
      </Form>
    </Modal>
  )
}
