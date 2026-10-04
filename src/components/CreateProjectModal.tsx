import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Form, Input, Modal, Select } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/api/project'
import { teamApi } from '@/api/team'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import type { CreateProjectPayload } from '@/types/project'

export function CreateProjectModal({ teamId, open, onClose }: { teamId: string; open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const [form] = Form.useForm<Omit<CreateProjectPayload, 'teamId'>>()
  const [error, setError] = useState<string | null>(null)
  const members = useQuery({ queryKey: ['teams', teamId, 'members'], queryFn: () => teamApi.listMembers(teamId), enabled: open && Boolean(teamId) })
  const create = useMutation({
    mutationFn: (values: Omit<CreateProjectPayload, 'teamId'>) => projectApi.create({ teamId, name: values.name.trim(), description: values.description?.trim(), memberIds: values.memberIds }),
    onSuccess: project => {
      void client.invalidateQueries({ queryKey: ['teams', teamId, 'projects'] })
      form.resetFields(); setError(null); onClose()
      navigate(PATHS.projectChat(project.id))
    },
    onError: failure => setError(formatApiError(failure)),
  })
  return <Modal title="创建项目" open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={create.isPending} okText="创建" cancelText="取消">
    <p>创建后即可在项目聊天中与成员和 Agent 一起协作。</p>
    {error && <Alert type="error" showIcon message={error} />}
    <Form form={form} layout="vertical" onFinish={values => create.mutate(values)} disabled={create.isPending}>
      <Form.Item name="name" label="项目名称" rules={[{ required: true, whitespace: true, message: '请输入项目名称' }, { max: 255 }]}><Input maxLength={255} /></Form.Item>
      <Form.Item name="description" label="项目描述"><Input.TextArea maxLength={16000} rows={3} /></Form.Item>
      <Form.Item name="memberIds" label="邀请团队成员"><Select mode="multiple" loading={members.isPending} optionFilterProp="label" options={members.data?.map(member => ({ value: member.userId, label: member.displayName || member.email || member.userId }))} /></Form.Item>
      {members.isError && <Alert type="warning" message="团队成员加载失败，可创建后再添加成员" />}
    </Form>
  </Modal>
}
