import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Alert, App, Avatar, Button, Form, Input, Popconfirm, Skeleton, Upload } from 'antd'
import { CameraOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/api/project'
import { useProjectAvatarUpload } from '@/hooks/useProjectAvatarUpload'
import { formatApiError } from '@/utils/formatApiError'
import type { Project } from '@/types/project'
import { ProjectMembers } from './ProjectMembers'
import './SettingsPage.css'

export function SettingsPage() {
  const { projectId = '' } = useParams()
  const [params] = useSearchParams()
  const project = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: Boolean(projectId),
  })
  if (project.isPending) return <Skeleton active />
  if (project.isError)
    return (
      <Alert
        type="error"
        showIcon
        title={formatApiError(project.error)}
        action={<Button onClick={() => void project.refetch()}>重试</Button>}
      />
    )
  return params.get('tab') === 'members' ? (
    <ProjectMembers key={project.data.id} />
  ) : (
    <ProjectSettings key={project.data.id} project={project.data} />
  )
}

function ProjectSettings({ project }: { project: Project }) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const [form] = Form.useForm<{ name: string; description: string }>()
  const [actionError, setActionError] = useState<string | null>(null)
  const { uploading, uploadAvatar } = useProjectAvatarUpload(project.teamId)
  const editable = project.role === 'PROJECT_ADMIN'
  const update = useMutation({
    mutationFn: (values: { name: string; description: string }) =>
      projectApi.update(project.id, {
        name: values.name.trim(),
        description: values.description.trim(),
      }),
    onSuccess: (updated) => {
      client.setQueryData(['projects', project.id], updated)
      void client.invalidateQueries({ queryKey: ['teams', project.teamId, 'projects'] })
      setActionError(null)
      void message.success('项目资料已更新')
    },
    onError: (error) => setActionError(formatApiError(error)),
  })
  const archive = useMutation({
    mutationFn: () =>
      project.status === 'ARCHIVED'
        ? projectApi.restore(project.id)
        : projectApi.archive(project.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['projects', project.id] })
      void client.invalidateQueries({ queryKey: ['teams', project.teamId, 'projects'] })
      setActionError(null)
      void message.success(project.status === 'ARCHIVED' ? '项目已恢复' : '项目已归档')
    },
    onError: (error) => setActionError(formatApiError(error)),
  })
  return (
    <div className="settings-page">
      {actionError && <Alert type="error" showIcon title={actionError} />}
      <section className="settings-section">
        <h2 className="settings-section__title">项目资料</h2>
        <hr className="qg-rule" />
        <div className="settings-avatar">
          <Avatar size={64} src={project.avatarUrl} icon={<CameraOutlined />} />
          {editable && (
            <Upload
              accept="image/*"
              showUploadList={false}
              disabled={uploading}
              beforeUpload={(file) => {
                void uploadAvatar(project.id, file)
                return false
              }}
            >
              <Button icon={<UploadOutlined />} loading={uploading}>
                更换头像
              </Button>
            </Upload>
          )}
        </div>
        <Form
          className="settings-form"
          form={form}
          layout="vertical"
          initialValues={{ name: project.name, description: project.description ?? '' }}
          onFinish={(values) => update.mutate(values)}
          disabled={!editable || update.isPending}
        >
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, whitespace: true, message: '请输入项目名称' }, { max: 255 }]}
          >
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item name="description" label="项目描述" rules={[{ max: 16000 }]}>
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={16000} />
          </Form.Item>
          {editable && (
            <Button type="primary" htmlType="submit" loading={update.isPending}>
              保存资料
            </Button>
          )}
        </Form>
      </section>
      {editable && (
        <section className="settings-section">
          <h2 className="settings-section__title">项目状态</h2>
          <hr className="qg-rule" />
          <p className="settings-hint">
            {project.status === 'ARCHIVED'
              ? '恢复后可继续协作。'
              : '暂时结束项目协作时，可以归档项目。'}
          </p>
          <Popconfirm
            title={project.status === 'ARCHIVED' ? '恢复此项目？' : '归档此项目？'}
            onConfirm={() => archive.mutate()}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger={project.status !== 'ARCHIVED'} loading={archive.isPending}>
              {project.status === 'ARCHIVED' ? '恢复项目' : '归档项目'}
            </Button>
          </Popconfirm>
        </section>
      )}
    </div>
  )
}
