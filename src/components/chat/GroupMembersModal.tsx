import { useState } from 'react'
import { Alert, App, Button, Checkbox, Form, Input, Modal, Select } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chatApi } from '@/api/chat'
import { projectApi } from '@/api/project'
import { teamApi } from '@/api/team'
import { useAuth } from '@/context/AuthContext'
import { formatApiError } from '@/utils/formatApiError'
import { chatKeys } from './useChatMessages'
import { QGENT_ID, QGENT_NAME, type ChatGroup, type QgentId } from '@/types/chat'

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
    includeQgent: boolean
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
  const existing = new Set(current.data?.map((member) => member.id))
  const mutation = useMutation({
    mutationFn: async () => {
      const values = await form.validateFields()
      const agentIds: QgentId[] = values.includeQgent ? [QGENT_ID] : []
      const body = {
        title: values.title?.trim(),
        userIds: values.userIds ?? [],
        agentIds,
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
    (Boolean(group) && current.isPending)
  const failed = members.isError || teamMembers.isError || current.isError
  const users = (members.data ?? [])
    .filter((member) => member.userId !== user?.id && !existing.has(member.userId))
    .map((member) => {
      const detail = teamMembers.data?.find((item) => item.userId === member.userId)
      return {
        value: member.userId,
        label: detail?.displayName || member.displayName || detail?.email || member.userId,
      }
    })
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
      <p className="group-modal__intro">
        {group
          ? '邀请项目成员或 Qgent，继续一起讨论。'
          : '给这次讨论一个名字，邀请合适的伙伴。你会自动加入群聊。'}
      </p>
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
        initialValues={{ userIds: [], includeQgent: false }}
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
        {!group?.defaultGroup && (
          <Form.Item name="userIds" label="项目成员">
            <Select
              mode="multiple"
              loading={loading}
              options={users}
              optionFilterProp="label"
              placeholder="选择要邀请的成员"
            />
          </Form.Item>
        )}
        {!existing.has(QGENT_ID) && <Form.Item name="includeQgent" valuePropName="checked"><Checkbox>{QGENT_NAME}</Checkbox></Form.Item>}
        <p className="group-modal__hint">加入群聊后可通过 @Qgent 发起工作，普通消息不会触发执行。</p>
      </Form>
    </Modal>
  )
}
