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
  Upload,
  message,
} from 'antd'
import { CameraOutlined, GithubOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { teamApi } from '@/api'
import { useAuth } from '@/context/AuthContext'
import { useAppUiStore } from '@/store/appUiStore'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import type { CreateTeamPayload, Team, TeamMember, TeamInvitation, TeamRole } from '@/types'
import type { TableProps } from 'antd'
import './TeamSettingsPage.css'

const INVITE_ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  // 邀请接口目前仅创建普通成员；管理员由团队所有者后续任命。
  { value: 'TEAM_MEMBER', label: '成员' },
]

const MEMBER_ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: 'TEAM_ADMIN', label: '管理员' },
  { value: 'TEAM_MEMBER', label: '成员' },
]

const INVITATION_STATUS_LABEL: Record<TeamInvitation['status'], string> = {
  PENDING: '待接受',
  ACCEPTED: '已接受',
  REVOKED: '已撤销',
  EXPIRED: '已过期',
}

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
 * 团队设置沿用团队详情的纸张底色。
 * 顶部：标题 + GitHub 集成 / 解散团队
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
      <div className="team-settings__loading">
        <Spin delay={180} />
      </div>
    )
  }

  if (isError || !team) {
    return (
      <div className="team-settings__page">
        <p className="workspace-page__note">团队未找到：该团队不存在，或你暂无访问权限。</p>
      </div>
    )
  }

  return (
    <div className="team-settings__page">
      {/* 页头由团队详情提供；这里是分区操作，与标签同一行。 */}
      <div className="team-settings__header">
        <div className="team-settings__actions">
          {isOwner && (
            <Button
              icon={<GithubOutlined />}
              onClick={() => navigate(PATHS.githubIntegration(teamId))}
            >
              GitHub 集成
            </Button>
          )}
          {isOwner && (
            <Button type="text" danger loading={disbandTeam.isPending} onClick={handleDisband}>
              解散团队
            </Button>
          )}
        </div>
      </div>

      <Tabs
        className="team-settings__tabs"
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
      className="team-settings__form"
      form={form}
      layout="vertical"
      disabled={!canManage}
      onFinish={handleFinish}
    >
      <Form.Item label="团队头像">
        <div className="team-settings__avatar">
          <Avatar size={56} src={team.avatarUrl} icon={<CameraOutlined />} />
          <Upload accept="image/*" showUploadList={false} beforeUpload={handleAvatarUpload}>
            <Button icon={<UploadOutlined />} loading={avatarUploading}>
              上传图片
            </Button>
          </Upload>
        </div>
        <p className="team-settings__hint">支持 JPG / PNG，建议 200×200 方形图片；上传后自动保存</p>
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
        <span className="team-settings__value">{formatCreatedAt(team.createdAt)}</span>
      </Form.Item>
      {canManage && (
        <Button type="primary" htmlType="submit" loading={updateTeam.isPending}>
          保存修改
        </Button>
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
            aria-label={`调整 ${m.displayName || m.userId} 的团队角色`}
            value={m.role}
            options={MEMBER_ROLE_OPTIONS}
            loading={
              updateRoleMutation.isPending && updateRoleMutation.variables?.userId === m.userId
            }
            onChange={(role) => updateRoleMutation.mutate({ userId: m.userId, role })}
          />
        ) : (
          <Tag>{getRoleLabel(m.role)}</Tag>
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
                  type="text"
                  danger
                  loading={removeMutation.isPending}
                  onClick={() => confirmRemove(m)}
                >
                  移除
                </Button>
              ) : (
                <span className="team-settings__hint">—</span>
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
      render: (status: TeamInvitation['status']) => (
        <Tag>{INVITATION_STATUS_LABEL[status] ?? status}</Tag>
      ),
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
                  type="text"
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
    <div className="team-settings__stack">
      <Table
        size="middle"
        rowKey="userId"
        columns={columns}
        dataSource={members}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />

      {!isOwner && canManage && (
        <p className="team-settings__hint">
          团队管理员可以邀请和移除普通成员，不能调整管理员或所有者。
        </p>
      )}

      {canManage && (
        <section className="team-settings__section">
          <h3 className="team-settings__subtitle">邀请成员</h3>
          <Space.Compact className="team-settings__invite">
            <Input
              placeholder="输入邮箱地址"
              aria-label="邀请成员邮箱"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onPressEnter={() => inviteEmail.trim() && inviteMutation.mutate()}
            />
            <Select
              aria-label="邀请角色"
              value={inviteRole}
              options={INVITE_ROLE_OPTIONS}
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
            <div className="team-settings__invitations">
              <h3 className="team-settings__subtitle">待处理邀请</h3>
              <Table
                size="middle"
                rowKey="id"
                columns={invitationColumns}
                dataSource={invitations}
                pagination={false}
                scroll={{ x: 'max-content' }}
              />
            </div>
          )}
        </section>
      )}
    </div>
  )
}
