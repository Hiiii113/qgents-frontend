import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { App, Form } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { teamApi } from '@/api/team'
import { PATHS } from '@/routes/paths'
import { useAuth } from '@/context/AuthContext'
import { useAppUiStore } from '@/store/appUiStore'
import { formatApiError } from '@/utils/formatApiError'
import type { Team, TeamInvitation, TeamMember, TeamRole } from '@/types'
import {
  Avatar,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  Icon,
  Page,
  PageHead,
  Section,
  SelectField,
  Skeleton,
  TableCell,
  TableRow,
  Tag,
  TextAreaField,
  TextField,
} from '@/components/ui'
import './team-settings.css'

const ROLE_LABEL: Record<TeamRole, string> = {
  TEAM_OWNER: '所有者',
  TEAM_ADMIN: '管理员',
  TEAM_MEMBER: '成员',
}

const INVITATION_STATUS: Record<
  TeamInvitation['status'],
  { label: string; tone: 'wait' | 'ok' | 'readonly' }
> = {
  PENDING: { label: '待接受', tone: 'wait' },
  ACCEPTED: { label: '已接受', tone: 'ok' },
  REVOKED: { label: '已撤销', tone: 'readonly' },
  EXPIRED: { label: '已过期', tone: 'readonly' },
}

const isTeamRole = (value: string): value is TeamRole =>
  value === 'TEAM_OWNER' || value === 'TEAM_ADMIN' || value === 'TEAM_MEMBER'

function formatDate(iso?: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

/** 团队设置：成员与邀请、团队资料、解散。成员由所有者调整角色，管理员可邀请与移除普通成员。 */
export default function TeamSettingsPage() {
  const { teamId = '' } = useParams<{ teamId: string }>()
  const team = useQuery({
    queryKey: ['teams', teamId],
    queryFn: () => teamApi.getById(teamId),
    enabled: Boolean(teamId),
  })
  const [inviteOpen, setInviteOpen] = useState(false)
  const isOwner = team.data?.role === 'TEAM_OWNER'
  const canManage = isOwner || team.data?.role === 'TEAM_ADMIN'

  return (
    <main className="canvas">
      <Page>
        <PageHead
          kicker="团队"
          title={team.data ? `${team.data.name} · 成员` : team.isError ? '团队不可用' : '团队设置'}
          description="团队管理员邀请成员、维护团队资料；项目成员在各自项目里单独管理。"
          actions={
            canManage ? (
              <Button
                variant="primary"
                icon={<Icon name="plus" size={16} />}
                onClick={() => setInviteOpen(true)}
              >
                邀请成员
              </Button>
            ) : undefined
          }
        />

        {team.isPending ? (
          <Skeleton rows={6} />
        ) : team.isError ? (
          <div className="block">
            <p className="h3">团队加载失败</p>
            <p className="sub">{formatApiError(team.error)}</p>
            <Button variant="quiet" onClick={() => void team.refetch()}>
              重试
            </Button>
          </div>
        ) : !canManage ? (
          <Forbidden />
        ) : (
          <>
            <Members teamId={teamId} isOwner={isOwner} />
            <p className="note">
              角色只分团队管理员与成员。项目内的管理员与成员在「项目设置 · 成员」里单独设置。
            </p>
            {isOwner ? null : (
              <p className="note">团队管理员可以邀请和移除普通成员，不能调整管理员或所有者。</p>
            )}
            <Invitations teamId={teamId} />
            <Profile team={team.data} canManage={canManage} />
            {isOwner ? <Disband teamId={teamId} name={team.data.name} /> : null}
          </>
        )}
      </Page>

      <InviteDialog teamId={teamId} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </main>
  )
}

function Forbidden() {
  const navigate = useNavigate()
  return (
    <div className="block">
      <p className="h3">需要团队管理员权限</p>
      <p className="sub">
        你在这个团队里的角色是「成员」。成员管理、邀请与团队资料只对团队管理员开放。
      </p>
      <Button variant="quiet" onClick={() => navigate(PATHS.APP)}>
        回到团队首页
      </Button>
    </div>
  )
}

function Members({ teamId, isOwner }: { teamId: string; isOwner: boolean }) {
  const { user } = useAuth()
  const { message } = App.useApp()
  const client = useQueryClient()
  const [removing, setRemoving] = useState<TeamMember | null>(null)
  const members = useQuery({
    queryKey: ['teams', teamId, 'members'],
    queryFn: () => teamApi.listMembers(teamId),
  })
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['teams', teamId, 'members'] })
    void client.invalidateQueries({ queryKey: ['teams', teamId] })
  }
  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: TeamRole }) =>
      teamApi.updateMemberRole(teamId, userId, role),
    onSuccess: () => {
      invalidate()
      void message.success('成员角色已更新')
    },
    onError: (error) => void message.error(formatApiError(error)),
  })
  const remove = useMutation({
    mutationFn: (userId: string) => teamApi.removeMember(teamId, userId),
    onSuccess: () => {
      invalidate()
      setRemoving(null)
      void message.success('成员已移出团队')
    },
    onError: (error) => void message.error(formatApiError(error)),
  })
  // 所有者与自己是不可移出的底线：管理员只能移除普通成员，所有者可移除管理员与成员。
  const canRemove = (member: TeamMember) =>
    member.role !== 'TEAM_OWNER' &&
    member.userId !== user?.id &&
    (isOwner || member.role === 'TEAM_MEMBER')
  const canChangeRole = (member: TeamMember) =>
    isOwner && member.role !== 'TEAM_OWNER' && member.userId !== user?.id
  const nameOf = (member: TeamMember) => member.displayName || member.userId

  return (
    <Section title="成员">
      {members.isPending ? (
        <Skeleton rows={4} />
      ) : members.isError ? (
        <EmptyState
          title="成员加载失败"
          description={formatApiError(members.error)}
          action={
            <Button variant="link" onClick={() => void members.refetch()}>
              重试
            </Button>
          }
          stacked
        />
      ) : members.data.length === 0 ? (
        <EmptyState icon="people" title="还没有成员" description="邀请同事加入团队。" stacked />
      ) : (
        <DataTable layout="team" columns={['成员', '邮箱', '角色', '']}>
          {members.data.map((member) => (
            <TableRow key={member.userId}>
              <TableCell>
                <span className="member-cell">
                  <Avatar name={nameOf(member)} src={member.avatarUrl} size="sm" />
                  <span className="member-cell__body">
                    <span className="name">{nameOf(member)}</span>
                    {member.userId === user?.id ? <span className="meta">你</span> : null}
                  </span>
                </span>
              </TableCell>
              <TableCell className="mono">{member.email || '—'}</TableCell>
              <TableCell>
                {canChangeRole(member) ? (
                  <SelectField
                    className="team-settings__role"
                    aria-label={`调整 ${nameOf(member)} 的团队角色`}
                    value={member.role}
                    disabled={updateRole.isPending}
                    onChange={(event) => {
                      if (isTeamRole(event.target.value)) {
                        updateRole.mutate({ userId: member.userId, role: event.target.value })
                      }
                    }}
                  >
                    <option value="TEAM_ADMIN">管理员</option>
                    <option value="TEAM_MEMBER">成员</option>
                  </SelectField>
                ) : (
                  <span className="name">{ROLE_LABEL[member.role]}</span>
                )}
              </TableCell>
              <TableCell end>
                {canRemove(member) ? (
                  <Button variant="link" onClick={() => setRemoving(member)}>
                    移除
                  </Button>
                ) : (
                  <span className="meta">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}

      <Dialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="移除成员"
        danger
        description={
          removing
            ? `确定要把「${nameOf(removing)}」移出团队吗？该成员将失去团队与项目访问权限。`
            : ''
        }
      >
        <div className="dlg__foot">
          <Button variant="quiet" onClick={() => setRemoving(null)}>
            取消
          </Button>
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => removing && remove.mutate(removing.userId)}
          >
            {remove.isPending ? '移除中…' : '移除'}
          </Button>
        </div>
      </Dialog>
    </Section>
  )
}

function Invitations({ teamId }: { teamId: string }) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const invitations = useQuery({
    queryKey: ['teams', teamId, 'invitations'],
    queryFn: () => teamApi.listInvitations(teamId),
  })
  const revoke = useMutation({
    mutationFn: (invitationId: string) => teamApi.revokeInvitation(teamId, invitationId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['teams', teamId, 'invitations'] })
      void message.success('邀请已撤销')
    },
    onError: (error) => void message.error(formatApiError(error)),
  })

  return (
    <Section title="邀请">
      {invitations.isPending ? (
        <Skeleton rows={3} />
      ) : invitations.isError ? (
        <EmptyState
          title="邀请加载失败"
          description={formatApiError(invitations.error)}
          action={
            <Button variant="link" onClick={() => void invitations.refetch()}>
              重试
            </Button>
          }
          stacked
        />
      ) : invitations.data.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="还没有发出邀请"
          description="邀请 7 天内有效；接受、撤销与过期状态都显示在这里。"
          stacked
        />
      ) : (
        <DataTable layout="team" columns={['邮箱', '角色', '状态', '']}>
          {invitations.data.map((invitation) => (
            <TableRow key={invitation.id}>
              <TableCell>
                <span className="mono">{invitation.email}</span>
                <span className="meta">邀请于 {formatDate(invitation.createdAt)}</span>
              </TableCell>
              <TableCell>
                <span className="name">{ROLE_LABEL[invitation.role]}</span>
              </TableCell>
              <TableCell>
                <Tag tone={INVITATION_STATUS[invitation.status].tone}>
                  {INVITATION_STATUS[invitation.status].label}
                </Tag>
              </TableCell>
              <TableCell end>
                {invitation.status === 'PENDING' ? (
                  <Button
                    variant="link"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(invitation.id)}
                  >
                    撤销
                  </Button>
                ) : (
                  <span className="meta">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}
    </Section>
  )
}

function InviteDialog({
  teamId,
  open,
  onClose,
}: {
  teamId: string
  open: boolean
  onClose: () => void
}) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const [form] = Form.useForm<{ email: string; role: 'TEAM_ADMIN' | 'TEAM_MEMBER' }>()
  const invite = useMutation({
    // 后端要求 expiresInDays：默认 7 天。
    mutationFn: (values: { email: string; role: 'TEAM_ADMIN' | 'TEAM_MEMBER' }) =>
      teamApi.invite(teamId, {
        email: values.email.trim(),
        role: values.role,
        expiresInDays: 7,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['teams', teamId, 'invitations'] })
      form.resetFields()
      onClose()
      void message.success('邀请已发送')
    },
  })

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose()
        form.resetFields()
      }}
      title="邀请成员"
      description="对方用邮箱里的链接加入团队；邀请 7 天内有效。"
    >
      <Form
        form={form}
        layout="vertical"
        className="form"
        initialValues={{ role: 'TEAM_MEMBER' }}
        onFinish={(values) => invite.mutate(values)}
        disabled={invite.isPending}
        requiredMark={false}
      >
        {invite.isError ? <p className="err">{formatApiError(invite.error)}</p> : null}
        <Form.Item
          name="email"
          label="邮箱"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效邮箱' },
          ]}
        >
          <TextField type="email" autoComplete="email" autoFocus />
        </Form.Item>
        <Form.Item name="role" label="角色">
          <SelectField>
            <option value="TEAM_MEMBER">成员</option>
            <option value="TEAM_ADMIN">管理员</option>
          </SelectField>
        </Form.Item>
        <div className="dlg__foot">
          <Button variant="quiet" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" type="submit" disabled={invite.isPending}>
            {invite.isPending ? '发送中…' : '发送邀请'}
          </Button>
        </div>
      </Form>
    </Dialog>
  )
}

function Profile({ team, canManage }: { team: Team; canManage: boolean }) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [form] = Form.useForm<{ name: string; description?: string }>()
  const update = useMutation({
    mutationFn: (values: { name: string; description?: string }) =>
      teamApi.update(team.id, {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
      }),
    onSuccess: () => {
      // PATCH 响应不保证带角色，重新拉取详情再渲染，避免把权限字段冲掉。
      void client.invalidateQueries({ queryKey: ['teams', team.id] })
      void client.invalidateQueries({ queryKey: ['teams', 'mine'] })
      void message.success('团队资料已更新')
    },
  })

  async function handleAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploading) return
    if (!file.type.startsWith('image/')) {
      message.warning('仅支持图片文件')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      message.warning('图片不超过 5MB')
      return
    }
    setUploading(true)
    try {
      await teamApi.uploadAvatar(team.id, file)
      await client.invalidateQueries({ queryKey: ['teams', team.id] })
      await client.invalidateQueries({ queryKey: ['teams', 'mine'] })
      void message.success('团队头像已更新')
    } catch (error) {
      void message.error(formatApiError(error))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Section title="团队资料">
      <Form
        form={form}
        layout="vertical"
        className="form form--narrow"
        initialValues={{ name: team.name, description: team.description ?? '' }}
        onFinish={(values) => update.mutate(values)}
        disabled={!canManage || update.isPending}
        requiredMark={false}
      >
        {update.isError ? <p className="err">{formatApiError(update.error)}</p> : null}
        <Form.Item label="团队头像">
          <div className="row">
            <Avatar name={team.name} src={team.avatarUrl} size="lg" />
            {canManage ? (
              <Button variant="quiet" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? '上传中…' : '更换头像'}
              </Button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => void handleAvatar(event)}
            />
          </div>
        </Form.Item>
        <Form.Item
          name="name"
          label="团队名称"
          rules={[
            { required: true, whitespace: true, message: '请输入团队名称' },
            { max: 255, message: '团队名称最多 255 个字符' },
          ]}
        >
          <TextField maxLength={255} />
        </Form.Item>
        <Form.Item name="description" label="团队简介">
          <TextAreaField rows={3} maxLength={16000} placeholder="描述团队用途、协作方向" />
        </Form.Item>
        <p className="meta">成立于 {formatDate(team.createdAt)}</p>
        <div className="form__foot form__foot--start">
          <Button
            variant="primary"
            type="submit"
            icon={<Icon name="check" size={15} />}
            disabled={update.isPending}
          >
            {update.isPending ? '保存中…' : '保存'}
          </Button>
        </div>
      </Form>
    </Section>
  )
}

function Disband({ teamId, name }: { teamId: string; name: string }) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<{ name: string }>()
  const disband = useMutation({
    mutationFn: () => teamApi.disband(teamId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['teams', 'mine'] })
      client.removeQueries({ queryKey: ['me'] })
      useAppUiStore.getState().clearContext()
      void message.success('团队已解散')
      navigate(PATHS.APP, { replace: true })
    },
  })

  return (
    <div className="danger">
      <h2 className="h3">解散团队</h2>
      <p className="sub">解散后团队下的所有项目、群聊和成员不可恢复。</p>
      <Button variant="danger" onClick={() => setOpen(true)}>
        解散团队
      </Button>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
          form.resetFields()
        }}
        title="解散团队"
        danger
        description={`输入团队名称「${name}」确认。此操作不可撤销。`}
      >
        <Form
          form={form}
          layout="vertical"
          className="form"
          onFinish={() => disband.mutate()}
          disabled={disband.isPending}
          requiredMark={false}
        >
          {disband.isError ? <p className="err">{formatApiError(disband.error)}</p> : null}
          <Form.Item
            name="name"
            label="团队名称"
            rules={[
              { required: true, whitespace: true, message: '请输入团队名称' },
              {
                validator: (_, value: string) =>
                  value?.trim() === name
                    ? Promise.resolve()
                    : Promise.reject(new Error('名称与当前团队不一致')),
              },
            ]}
          >
            <TextField autoFocus autoComplete="off" />
          </Form.Item>
          <div className="dlg__foot">
            <Button
              variant="quiet"
              onClick={() => {
                setOpen(false)
                form.resetFields()
              }}
            >
              取消
            </Button>
            <Button variant="danger" type="submit" disabled={disband.isPending}>
              {disband.isPending ? '解散中…' : '解散团队'}
            </Button>
          </div>
        </Form>
      </Dialog>
    </div>
  )
}
