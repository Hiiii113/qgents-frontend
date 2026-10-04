import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, App, Avatar, Button, Form, Input, Popconfirm, Skeleton, Space, Upload } from 'antd'
import { CameraOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/api/project'
import { WorkspacePage } from '@/components/WorkspacePage'
import { useProjectAvatarUpload } from '@/hooks/useProjectAvatarUpload'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import type { Project } from '@/types/project'

export function SettingsPage() {
  const { projectId = '' } = useParams()
  const project = useQuery({ queryKey: ['projects', projectId], queryFn: () => projectApi.getById(projectId), enabled: Boolean(projectId) })
  return <WorkspacePage title="项目设置" description="维护项目资料。仓库和成员在各自页面管理。">
    {project.isPending ? <Skeleton active /> : project.isError ? <Alert type="error" showIcon message={formatApiError(project.error)} /> :
      <ProjectSettings key={project.data.id} project={project.data} />}
  </WorkspacePage>
}

function ProjectSettings({ project }: { project: Project }) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const [form] = Form.useForm<{ name: string; description: string }>()
  const [actionError, setActionError] = useState<string | null>(null)
  const { uploading, uploadAvatar } = useProjectAvatarUpload(project.teamId)
  const editable = project.role === 'PROJECT_ADMIN'
  const update = useMutation({
    mutationFn: (values: { name: string; description: string }) => projectApi.update(project.id, { name: values.name.trim(), description: values.description.trim() }),
    onSuccess: updated => {
      client.setQueryData(['projects', project.id], updated)
      void client.invalidateQueries({ queryKey: ['teams', project.teamId, 'projects'] })
      setActionError(null)
      void message.success('项目资料已更新')
    },
    onError: error => setActionError(formatApiError(error)),
  })
  const archive = useMutation({
    mutationFn: () => project.status === 'ARCHIVED' ? projectApi.restore(project.id) : projectApi.archive(project.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['projects', project.id] })
      void client.invalidateQueries({ queryKey: ['teams', project.teamId, 'projects'] })
      setActionError(null)
      void message.success(project.status === 'ARCHIVED' ? '项目已恢复' : '项目已归档')
    },
    onError: error => setActionError(formatApiError(error)),
  })
  return <div className="workspace-card" style={{ maxWidth: 680 }}>
    {actionError && <Alert type="error" showIcon message={actionError} />}
    <Space style={{ marginBottom: 24 }}>
      <Avatar size={64} src={project.avatarUrl} icon={<CameraOutlined />} />
      {editable && <Upload accept="image/*" showUploadList={false} disabled={uploading} beforeUpload={file => { void uploadAvatar(project.id, file); return false }}>
        <Button icon={<UploadOutlined />} loading={uploading}>更换头像</Button>
      </Upload>}
    </Space>
    <Form form={form} layout="vertical" initialValues={{ name: project.name, description: project.description ?? '' }} onFinish={values => update.mutate(values)} disabled={!editable || update.isPending}>
      <Form.Item name="name" label="项目名称" rules={[{ required: true, whitespace: true, message: '请输入项目名称' }, { max: 255 }]}><Input maxLength={255} /></Form.Item>
      <Form.Item name="description" label="项目描述" rules={[{ max: 16000 }]}><Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={16000} /></Form.Item>
      {editable && <Button type="primary" htmlType="submit" loading={update.isPending}>保存资料</Button>}
    </Form>
    <Space wrap style={{ marginTop: 24 }}><Link to={PATHS.projectCode(project.id)}>项目仓库</Link><Link to={PATHS.projectMembers(project.id)}>项目成员</Link></Space>
    {editable && <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid #e5e9e4' }}>
      <h3>{project.status === 'ARCHIVED' ? '恢复项目' : '归档项目'}</h3>
      <p>{project.status === 'ARCHIVED' ? '恢复后可继续协作。' : '暂时结束项目协作时，可以归档项目。'}</p>
      <Popconfirm title={project.status === 'ARCHIVED' ? '恢复此项目？' : '归档此项目？'} onConfirm={() => archive.mutate()} okText="确定" cancelText="取消">
        <Button danger={project.status !== 'ARCHIVED'} loading={archive.isPending}>{project.status === 'ARCHIVED' ? '恢复项目' : '归档项目'}</Button>
      </Popconfirm>
    </div>}
  </div>
}
