import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Avatar,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import { CameraOutlined, GithubOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { teamApi } from '@/api'
import { useAuth } from '@/context/AuthContext'
import { useAppUiStore } from '@/store/appUiStore'
import { EmptyState } from '@/components/EmptyState'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import type { CreateTeamPayload, Team, TeamMember, TeamInvitation, TeamRole } from '@/types'
import type { TableProps } from 'antd'

const { Title, Text } = Typography

const INVITE_ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  // 邀请接口目前仅创建普通成员；管理员由团队所有者后续任命。
  { value: 'TEAM_MEMBER', label: '成员' },
]

const MEMBER_ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: 'TEAM_ADMIN', label: '管理员' },
  { value: 'TEAM_MEMBER', label: '成员' },
]

function getRoleLabel(role: TeamRole): string {
  if (role === 'TEAM_OWNER') return '所有者'
  if (role === 'TEAM_ADMIN') return '管理员'
  return '成员'
}

function formatCreatedAt(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

/**
 * 团队设置沿用团队详情的浅色背景。
 * 顶部：标题 + GitHub 集成 / 解散团队按钮
 * 下方 Tab：基本信息 / 成员管理
 * 路由：/app/teams/:teamId/settings
 */
export default function TeamSettingsPage() {
  const { teamId = '' } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    data: team,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['teams', teamId],
    queryFn: () => teamApi.getById(teamId),
    enabled: !!teamId,
  })

  const { data: members = [] } = useQuery({
    queryKey: ['teams', teamId, 'members'],
    queryFn: () => teamApi.listMembers(teamId),
    enabled: !!teamId,
  })

  const isOwner = team?.role === 'TEAM_OWNER'
  const canManage = isOwner || team?.role === 'TEAM_ADMIN'

  const disbandTeam = useMutation({
    mutationFn: () => teamApi.disband(teamId),
    onSuccess: () => {
      message.success('团队已解散')
      queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] })
      queryClient.removeQueries({ queryKey: ['me'] })
      useAppUiStore.getState().clearContext()
      navigate(PATHS.APP, { replace: true })
    },
    onError: (err) => {
      message.error(err instanceof Error ? err.message : '解散失败')
    },
  })

  function handleDisband() {
    Modal.confirm({
      title: '解散团队',
      content: `确定要解散「${team?.name}」吗？解散后团队下的所有项目、群聊和成员将不可恢复。`,
      okText: '解散',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => disbandTeam.mutate(),
    })
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '120px 0' }}>
        <Spin delay={180} size="large" />
      </div>
    )
  }

  if (isError || !team) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '120px 0' }}>
        <EmptyState title="团队未找到" description="该团队不存在，或你暂无访问权限" />
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 40, minHeight: '100%' }}>
      {/* 返回项目列表由团队详情的操作入口提供。 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          团队设置
        </Title>
        <Space>
          {isOwner && (
            <Button
              icon={<GithubOutlined />}
              onClick={() => navigate(PATHS.githubIntegration(teamId))}
            >
              GitHub 集成
            </Button>
          )}
          {isOwner && (
            <Button danger loading={disbandTeam.isPending} onClick={handleDisband}>
              解散团队
            </Button>
          )}
        </Space>
      </div>

      <Tabs
        defaultActiveKey="basic"
        items={[
          {
            key: 'basic',
            label: '基本信息',
            children: <BasicInfoTab team={team} teamId={teamId} canManage={canManage} />,
          },
          {
            key: 'members',
            label: '成员管理',
            children: (
              <MembersTab
                teamId={teamId}
                members={members}
                canManage={canManage}
                isOwner={isOwner}
              />
            ),
          },
        ]}
      />
    </div>
  )
}

/** ──── Tab 1：基本信息 ──── */
function BasicInfoTab({
  team,
  teamId,
  canManage,
}: {
  team: Team
  teamId: string
  canManage: boolean
}) {
  const [form] = Form.useForm<CreateTeamPayload>()
  const queryClient = useQueryClient()
  const [avatarUploading, setAvatarUploading] = useState(false)

  const updateTeam = useMutation({
    mutationFn: (payload: CreateTeamPayload) => teamApi.update(teamId, payload),
    onSuccess: () => {
      message.success('团队信息已保存')
      queryClient.invalidateQueries({ queryKey: ['teams', teamId] })
    },
    onError: (err) => message.error(formatApiError(err)),
  })

  useEffect(() => {
    form.setFieldsValue({ name: team.name, description: team.description ?? '' })
  }, [team, form])

  /** 团队头像：签发凭证 → 直传 OSS → 确认，确认接口直接写入团队头像（所有者或管理员） */
  async function handleAvatarUpload(file: File): Promise<boolean> {
    if (!canManage || avatarUploading) return false
    setAvatarUploading(true)
    try {
      await teamApi.uploadAvatar(teamId, file)
      message.success('团队头像已更新')
      // 同步刷新所有展示团队头像的查询：详情页、个人菜单团队列表（key 不同，需分别失效）
      queryClient.invalidateQueries({ queryKey: ['teams', teamId] })
      queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '头像上传失败，请重试')
    } finally {
      setAvatarUploading(false)
    }
    return false
  }

  function handleFinish(values: CreateTeamPayload) {
    updateTeam.mutate({
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
    })
  }

  return (
    <Form
      form={form}
      layout="vertical"
      disabled={!canManage}
      onFinish={handleFinish}
      style={{ maxWidth: 480, margin: '0 auto' }}
    >
      <Form.Item label="团队头像">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar
            size={56}
            src={team.avatarUrl}
            icon={<CameraOutlined />}
            style={{ flexShrink: 0 }}
          />
          <Upload accept="image/*" showUploadList={false} beforeUpload={handleAvatarUpload}>
            <Button icon={<UploadOutlined />} loading={avatarUploading}>
              上传图片
            </Button>
          </Upload>
        </div>
        <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          支持 JPG / PNG，建议 200×200 方形图片；上传后自动保存
        </Text>
      </Form.Item>
      <Form.Item
        name="name"
        label="团队名称"
        rules={[{ required: true, whitespace: true, message: '请输入团队名称' }]}
      >
        <Input placeholder="团队名称" />
      </Form.Item>
      <Form.Item name="description" label="团队简介">
        <Input.TextArea rows={3} placeholder="描述团队用途、协作方向" />
      </Form.Item>
      <Form.Item label="成立时间">
        <Text type="secondary">{formatCreatedAt(team.createdAt)}</Text>
      </Form.Item>
      {canManage && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button type="primary" htmlType="submit" loading={updateTeam.isPending}>
            保存修改
          </Button>
        </div>
      )}
    </Form>
  )
}

/** ──── Tab 2：成员管理 ──── */
function MembersTab({
  teamId,
  members,
  canManage,
  isOwner,
}: {
  teamId: string
  members: TeamMember[]
  canManage: boolean
  isOwner: boolean
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamRole>('TEAM_MEMBER')

  const { data: invitations = [] } = useQuery({
    queryKey: ['teams', teamId, 'invitations'],
    queryFn: () => teamApi.listInvitations(teamId),
    enabled: !!teamId && canManage,
  })

  const inviteMutation = useMutation({
    // expiresInDays 后端必填（INVALID_ARGUMENT），前端默认 7 天
    mutationFn: () =>
      teamApi.invite(teamId, { email: inviteEmail.trim(), role: inviteRole, expiresInDays: 7 }),
    onSuccess: () => {
      message.success('邀请已发送')
      setInviteEmail('')
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'invitations'] })
    },
    onError: (err) => message.error(formatApiError(err)),
  })

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => teamApi.revokeInvitation(teamId, invitationId),
    onSuccess: () => {
      message.success('邀请已撤销')
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'invitations'] })
    },
    onError: (err) => message.error(formatApiError(err)),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => teamApi.removeMember(teamId, userId),
    onSuccess: () => {
      message.success('成员已移除')
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'members'] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId] })
    },
    onError: (err) => message.error(formatApiError(err)),
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: TeamRole }) =>
      teamApi.updateMemberRole(teamId, userId, role),
    onSuccess: () => {
      message.success('成员角色已更新')
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'members'] })
    },
    onError: (err) => message.error(formatApiError(err)),
  })

  function canRemove(member: TeamMember): boolean {
    if (member.role === 'TEAM_OWNER' || member.userId === user?.id) return false
    return isOwner || member.role === 'TEAM_MEMBER'
  }

  function canChangeRole(member: TeamMember): boolean {
    return isOwner && member.role !== 'TEAM_OWNER' && member.userId !== user?.id
  }

  function confirmRemove(member: TeamMember) {
    const name = member.displayName || member.userId
    Modal.confirm({
      title: '移除成员',
      content: `确定要将「${name}」移出团队吗？`,
      okText: '移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => removeMutation.mutate(member.userId),
    })
  }

  const columns: TableProps<TeamMember>['columns'] = [
    {
      title: '成员',
      key: 'name',
      render: (_, m) => m.displayName || m.userId,
    },
    {
      title: '邮箱',
      key: 'email',
      render: (_, m) => m.email || '—',
    },
    {
      title: '角色',
      key: 'role',
      width: 180,
      render: (_, m) =>
        canChangeRole(m) ? (
          <Select
            size="small"
            aria-label={`调整 ${m.displayName || m.userId} 的团队角色`}
            value={m.role}
            options={MEMBER_ROLE_OPTIONS}
            loading={
              updateRoleMutation.isPending && updateRoleMutation.variables?.userId === m.userId
            }
            onChange={(role) => updateRoleMutation.mutate({ userId: m.userId, role })}
          />
        ) : (
          <Tag
            color={m.role === 'TEAM_OWNER' ? 'gold' : m.role === 'TEAM_ADMIN' ? 'blue' : 'default'}
          >
            {getRoleLabel(m.role)}
          </Tag>
        ),
    },
    ...(canManage
      ? [
          {
            title: '操作',
            key: 'action',
            width: 120,
            render: (_: unknown, m: TeamMember) =>
              canRemove(m) ? (
                <Button
                  size="small"
                  danger
                  type="link"
                  loading={removeMutation.isPending}
                  onClick={() => confirmRemove(m)}
                >
                  移除
                </Button>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  —
                </Text>
              ),
          },
        ]
      : []),
  ]

  const invitationColumns: TableProps<TeamInvitation>['columns'] = [
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: TeamRole) => getRoleLabel(role),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: TeamInvitation['status']) => {
        const map: Record<string, string> = {
          PENDING: 'orange',
          ACCEPTED: 'green',
          REVOKED: 'default',
          EXPIRED: 'default',
        }
        return <Tag color={map[status] ?? 'default'}>{status}</Tag>
      },
    },
    {
      title: '邀请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => formatCreatedAt(v),
    },
    ...(canManage
      ? [
          {
            title: '操作',
            key: 'action',
            width: 100,
            render: (_: unknown, inv: TeamInvitation) =>
              inv.status === 'PENDING' ? (
                <Button
                  size="small"
                  type="link"
                  danger
                  loading={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(inv.id)}
                >
                  撤销
                </Button>
              ) : null,
          },
        ]
      : []),
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Table
          rowKey="userId"
          columns={columns}
          dataSource={members}
          pagination={false}
          size="middle"
        />
      </div>

      {!isOwner && canManage && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          团队管理员可以邀请和移除普通成员，不能调整管理员或所有者。
        </Text>
      )}

      {canManage && (
        <div>
          <Title level={5}>邀请成员</Title>
          <Space.Compact style={{ width: '100%', maxWidth: 480 }}>
            <Input
              placeholder="输入邮箱地址"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onPressEnter={() => inviteEmail.trim() && inviteMutation.mutate()}
            />
            <Select
              value={inviteRole}
              options={INVITE_ROLE_OPTIONS}
              style={{ width: 120 }}
              onChange={(v) => setInviteRole(v)}
            />
            <Button
              type="primary"
              loading={inviteMutation.isPending}
              disabled={!inviteEmail.trim()}
              onClick={() => inviteMutation.mutate()}
            >
              发送邀请
            </Button>
          </Space.Compact>

          {invitations.length > 0 && (
            <Table
              rowKey="id"
              columns={invitationColumns}
              dataSource={invitations}
              pagination={false}
              size="small"
              style={{ marginTop: 16, maxWidth: 720 }}
              title={() => '待处理邀请'}
            />
          )}
        </div>
      )}
    </Space>
  )
}
