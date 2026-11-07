import { useState } from 'react'
import { Alert, App, Button, Input, Modal, Popconfirm, Space } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/api/project'
import { skillApi } from '@/api/skill'
import { useAuth } from '@/context/AuthContext'
import { formatApiError } from '@/utils/formatApiError'

type Action = 'submitReview' | 'approve' | 'reject' | 'archive'
/** 共享 Skill 在详情中完成审核，权限和可编辑状态由后端服务校验。 */
export function SkillActions({ projectId, id, creatorId, status, onEdit }: {
  projectId: string; id: string; creatorId: string; status: string; onEdit: () => void
}) {
  const { user } = useAuth()
  const { message } = App.useApp()
  const client = useQueryClient()
  const project = useQuery({ queryKey: ['projects', projectId], queryFn: () => projectApi.getById(projectId) })
  const admin = project.data?.role === 'PROJECT_ADMIN'
  const owns = creatorId === user?.id || admin
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const api = skillApi
  const action = useMutation({
    mutationFn: async (operation: Action) => {
      if (operation === 'reject') await api.reject(projectId, id, reason.trim())
      else await api[operation](projectId, id)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['skills', projectId] })
      setRejectOpen(false); setReason(''); void message.success('知识状态已更新')
    },
  })
  const editable = owns && status !== 'ARCHIVED'
  const published = status === 'PUBLISHED'
  return <>
    {action.isError && <Alert type="error" showIcon message={formatApiError(action.error)} />}
    <Space wrap>
      {editable && <Button onClick={onEdit} disabled={action.isPending}>编辑</Button>}
      {owns && (status === 'DRAFT' || status === 'REJECTED') && <Button type="primary" loading={action.isPending} onClick={() => action.mutate('submitReview')}>提交审核</Button>}
      {admin && status === 'PENDING_REVIEW' && <><Button type="primary" loading={action.isPending} onClick={() => action.mutate('approve')}>批准共享</Button><Button onClick={() => setRejectOpen(true)}>拒绝</Button></>}
      {published && owns && <Popconfirm title="归档这条知识？" okText="归档" cancelText="取消" onConfirm={() => action.mutate('archive')}><Button loading={action.isPending}>归档</Button></Popconfirm>}
    </Space>
    <Modal title="拒绝原因" open={rejectOpen} onCancel={() => setRejectOpen(false)} onOk={() => action.mutate('reject')} confirmLoading={action.isPending} okButtonProps={{ disabled: !reason.trim() }} okText="拒绝" cancelText="取消">
      <Input.TextArea aria-label="拒绝原因" value={reason} onChange={event => setReason(event.target.value)} rows={3} />
    </Modal>
  </>
}
