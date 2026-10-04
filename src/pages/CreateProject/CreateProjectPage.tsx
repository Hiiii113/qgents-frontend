import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Form, Input } from 'antd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/api/project'
import { WorkspacePage } from '@/components/WorkspacePage'
import { formatApiError } from '@/utils/formatApiError'
import { PATHS } from '@/routes/paths'

export default function CreateProjectPage() {
  const { teamId = '' } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const client = useQueryClient()
  const create = useMutation({
    mutationFn: (values: { name: string; description?: string }) => projectApi.create({ teamId, ...values }),
    onSuccess: project => { void client.invalidateQueries({ queryKey: ['teams', teamId, 'projects'] }); navigate(`${PATHS.projectDetail(project.id)}/chat`) },
  })
  return <WorkspacePage title="创建项目" description="给团队一个专注的协作空间。群聊会自动准备好，GitHub 仓库可以稍后按需导入。">
    <div className="workspace-card" style={{ maxWidth: 600 }}>
      {create.isError && <Alert type="error" showIcon message={formatApiError(create.error)} />}
      <Form layout="vertical" onFinish={values => create.mutate(values)}>
        <Form.Item name="name" label="项目名称" rules={[{ required: true, whitespace: true, message: '请输入项目名称' }]}><Input maxLength={80} placeholder="例如：产品工作台" /></Form.Item>
        <Form.Item name="description" label="简介"><Input.TextArea maxLength={1000} autoSize={{ minRows: 3, maxRows: 6 }} placeholder="这个项目希望一起完成什么？" /></Form.Item>
        <Button type="primary" htmlType="submit" loading={create.isPending}>创建并开始聊天</Button>
      </Form>
    </div>
  </WorkspacePage>
}
