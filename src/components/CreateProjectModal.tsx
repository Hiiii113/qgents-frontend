import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Checkbox, Form } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/api/project'
import { teamApi } from '@/api/team'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import { useAuth } from '@/context/AuthContext'
import { Button, Dialog, Icon, TextAreaField, TextField } from '@/components/ui'

interface Values {
  name: string
  description?: string
  memberIds?: string[]
}

/** 新建项目：自动生成默认 Agent 与默认群，可顺手加入团队成员。 */
export function CreateProjectModal({
  teamId,
  open,
  onClose,
}: {
  teamId: string
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { user } = useAuth()
  const client = useQueryClient()
  const [form] = Form.useForm<Values>()
  const [error, setError] = useState<string | null>(null)
  const members = useQuery({
    queryKey: ['teams', teamId, 'members'],
    queryFn: () => teamApi.listMembers(teamId),
    enabled: open && Boolean(teamId),
  })
  const create = useMutation({
    mutationFn: (values: Values) =>
      projectApi.create({
        teamId,
        name: values.name.trim(),
        description: values.description?.trim(),
        memberIds: values.memberIds,
      }),
    onSuccess: (project) => {
      void client.invalidateQueries({ queryKey: ['teams', teamId, 'projects'] })
      form.resetFields()
      setError(null)
      onClose()
      void message.success('项目已创建')
      navigate(PATHS.projectChat(project.id))
    },
    onError: (failure) => setError(formatApiError(failure)),
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="新建项目"
      description="创建后会自动生成该项目的默认 Agent 与一个默认群。"
    >
      <Form
        form={form}
        layout="vertical"
        className="form"
        onFinish={(values) => create.mutate(values)}
        disabled={create.isPending}
        requiredMark={false}
      >
        {error ? <p className="err">{error}</p> : null}
        <Form.Item
          name="name"
          label="项目名称"
          rules={[
            { required: true, whitespace: true, message: '请输入项目名称' },
            { max: 255, message: '项目名称最多 255 个字符' },
          ]}
        >
          <TextField maxLength={255} placeholder="例如：qgents-web" autoFocus />
        </Form.Item>
        <Form.Item name="description" label="项目说明">
          <TextAreaField rows={3} maxLength={16000} placeholder="项目要解决的问题或范围（可选）" />
        </Form.Item>
        {members.data && members.data.length > 0 ? (
          <Form.Item name="memberIds" label="加入项目成员">
            <Checkbox.Group
              options={members.data
                .filter((member) => member.userId !== user?.id && member.role !== 'TEAM_OWNER')
                .map((member) => ({
                  value: member.userId,
                  label: member.displayName || member.email || member.userId,
                }))}
            />
          </Form.Item>
        ) : null}
        <div className="dlg__foot">
          <Button variant="quiet" onClick={onClose} icon={<Icon name="close" size={15} />}>
            取消
          </Button>
          <Button
            variant="primary"
            type="submit"
            icon={<Icon name="plus" size={16} />}
            disabled={create.isPending}
          >
            {create.isPending ? '创建中…' : '创建项目'}
          </Button>
        </div>
      </Form>
    </Dialog>
  )
}
