import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  App,
} from 'antd'
import { PlusOutlined, UserOutlined } from '@ant-design/icons'
import { projectApi, teamApi } from '@/api'
import { useAuth } from '@/context/AuthContext'
import { formatApiError } from '@/utils/formatApiError'
import type { ProjectMember } from '@/types'
import type { TableProps } from 'antd'

const { Text } = Typography

/** 项目成员与角色由项目接口管理；群聊成员随项目同步。 */
export function ProjectMembers() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // 当前项目信息（判断是否 Project Admin）
  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: !!projectId,
  })
  const isAdmin = project?.role === 'PROJECT_ADMIN'

  // 项目成员
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => projectApi.listMembers(projectId),
    enabled: !!projectId,
  })

  // 团队成员（作为「添加成员」候选，做差集）
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['teams', project?.teamId, 'members'],
    queryFn: () => teamApi.listMembers(project?.teamId ?? ''),
    enabled: !!project?.teamId,
  })
  const teamOwner = teamMembers.find((member) => member.role === 'TEAM_OWNER')
  const isTeamOwnerRow = (member: ProjectMember) => teamOwner?.userId === member.userId

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'members'] })
    queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
  }

  const removeMutation = useMutation({
    mutationFn: (userId: string) => projectApi.removeMember(projectId, userId),
    onSuccess: () => {
      message.success('成员已移除')
      invalidate()
    },
    onError: (err) => message.error(formatApiError(err)),
  })

  // 项目管理员可以提升、降级和移除其他管理员；团队所有者的继承权限由后端保护。
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: ProjectMember['role'] }) =>
      projectApi.updateMemberRole(projectId, userId, role),
    onSuccess: () => {
      message.success('成员角色已更新')
      invalidate()
    },
    onError: (err) => message.error(formatApiError(err)),
  })

  const addMutation = useMutation({
    mutationFn: (userIds: string[]) =>
      Promise.all(userIds.map((id) => projectApi.addMember(projectId, id))),
    onSuccess: () => {
      message.success('成员已加入项目')
      setAddOpen(false)
      setSelectedIds([])
      invalidate()
    },
    onError: (err) => message.error(formatApiError(err)),
  })

  // 项目成员接口可能不返回 displayName，用团队成员信息补全（项目成员 ⊆ 团队成员）
  const teamMemberById = new Map(teamMembers.map((tm) => [tm.userId, tm]))
  const resolveDisplayName = (m: ProjectMember) =>
    m.displayName || teamMemberById.get(m.userId)?.displayName || m.userId
  const resolveEmail = (m: ProjectMember) => m.email || teamMemberById.get(m.userId)?.email || '—'

  function confirmRemove(member: ProjectMember) {
    Modal.confirm({
      title: '移除成员',
      content: `确定要将「${resolveDisplayName(member)}」移出项目吗？`,
      okText: '移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => removeMutation.mutate(member.userId),
    })
  }

  // 添加成员候选 = 团队成员 − 已在项目里的成员；团队所有者已继承管理员权限，无需显式加入。
  const candidateMembers = teamMembers.filter(
    (tm) => tm.userId !== teamOwner?.userId && !members.some((pm) => pm.userId === tm.userId),
  )

  const columns: TableProps<ProjectMember>['columns'] = [
    {
      title: '成员',
      key: 'member',
      render: (_, m) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserOutlined style={{ color: '#8b5cf6' }} />
          <div>
            <div>{resolveDisplayName(m)}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {resolveEmail(m)}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: '角色',
      key: 'role',
      width: 150,
      render: (_, m) =>
        isTeamOwnerRow(m) ? (
          <Tag color="gold">继承管理员</Tag>
        ) : (
          <Tag color={m.role === 'PROJECT_ADMIN' ? 'gold' : 'default'}>
            {m.role === 'PROJECT_ADMIN' ? '管理员' : '成员'}
          </Tag>
        ),
    },
    ...(isAdmin
      ? [
          {
            title: '操作',
            key: 'action',
            width: 240,
            render: (_: unknown, m: ProjectMember) => {
              if (isTeamOwnerRow(m)) {
                return (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    团队所有者
                  </Text>
                )
              }
              const isSelf = m.userId === user?.id
              const nextRole = m.role === 'PROJECT_ADMIN' ? 'PROJECT_MEMBER' : 'PROJECT_ADMIN'
              const actionLabel = m.role === 'PROJECT_ADMIN' ? '降为成员' : '设为管理员'
              return (
                <Space size={4}>
                  <Popconfirm
                    title={actionLabel}
                    description={
                      m.role === 'PROJECT_ADMIN'
                        ? '该成员将失去项目管理员权限。'
                        : '该成员将获得项目管理权限。'
                    }
                    okText={actionLabel}
                    cancelText="取消"
                    onConfirm={() =>
                      updateRoleMutation.mutate({ userId: m.userId, role: nextRole })
                    }
                  >
                    <Button
                      size="small"
                      type="link"
                      loading={
                        updateRoleMutation.isPending &&
                        updateRoleMutation.variables?.userId === m.userId
                      }
                    >
                      {actionLabel}
                    </Button>
                  </Popconfirm>
                  {!isSelf && (
                    <Button
                      size="small"
                      danger
                      type="link"
                      loading={removeMutation.isPending}
                      onClick={() => confirmRemove(m)}
                    >
                      移除
                    </Button>
                  )}
                </Space>
              )
            },
          },
        ]
      : []),
  ]

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <Spin delay={180} size="large" />
      </div>
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        {isAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setSelectedIds([])
              setAddOpen(true)
            }}
          >
            添加成员
          </Button>
        )}
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="团队所有者始终拥有本项目管理员权限（继承），无需出现在项目成员列表中。"
      />

      <Table rowKey="userId" columns={columns} dataSource={members} pagination={false} />

      {/* 添加成员弹窗：从团队现有成员里选（已在项目里的不显示） */}
      <Modal
        title="添加项目成员"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={() => addMutation.mutate(selectedIds)}
        okText="添加"
        cancelText="取消"
        confirmLoading={addMutation.isPending}
        okButtonProps={{ disabled: selectedIds.length === 0 }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            从团队现有成员中选择，选中即加入项目（无需对方确认）
          </Text>
        </div>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="选择团队成员"
          value={selectedIds}
          onChange={setSelectedIds}
          options={candidateMembers.map((m) => ({
            value: m.userId,
            label: m.displayName || m.userId,
          }))}
          optionFilterProp="label"
        />
      </Modal>
    </div>
  )
}
