import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { App, Checkbox, Form } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/api/project'
import { teamApi } from '@/api/team'
import { chatApi } from '@/api/chat'
import { chatKeys } from '@/query/chatKeys'
import { useAuth } from '@/context/AuthContext'
import { formatApiError } from '@/utils/formatApiError'
import type { Project, ProjectMember, ProjectRole } from '@/types'
import {
  Avatar,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  Icon,
  MenuSelect,
  Page,
  PageHead,
  Section,
  Skeleton,
  TableCell,
  TableRow,
  Tabs,
  Tag,
  TextAreaField,
  TextField,
} from '@/components/ui'
import './project-settings.css'

const TABS = [
  { key: 'basic', label: '基本信息' },
  { key: 'members', label: '成员' },
  { key: 'archive', label: '归档' },
] as const

type TabKey = (typeof TABS)[number]['key']

const roleLabel = (role: ProjectRole) => (role === 'PROJECT_ADMIN' ? '项目管理员' : '成员')

const PROJECT_ROLE_OPTIONS = [
  { value: 'PROJECT_ADMIN', label: '项目管理员', description: '管理项目资料、成员、仓库与审批' },
  { value: 'PROJECT_MEMBER', label: '成员', description: '参与群聊与 Agent 协作' },
] as const

/** 项目设置：资料、成员与归档。页签放进 ?tab=，管理员才有写操作。 */
export default function ProjectSettingsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [params, setParams] = useSearchParams()
  const tab: TabKey = TABS.find((item) => item.key === params.get('tab'))?.key ?? 'basic'
  const project = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: Boolean(projectId),
  })

  return (
    <main className="canvas">
      <Page>
        <PageHead
          title={project.data ? `${project.data.name} · 设置` : '项目设置'}
        />

        {project.isPending ? (
          <Skeleton rows={6} />
        ) : project.isError ? (
          <div className="block">
            <p className="h3">项目加载失败</p>
            <p className="sub">{formatApiError(project.error)}</p>
            <Button
              variant="quiet"
              onClick={() => void project.refetch()}
              icon={<Icon name="refresh" size={15} />}
            >
              重试
            </Button>
          </div>
        ) : (
          <>
            <Tabs
              label="项目设置分区"
              items={TABS.map((item) => ({ key: item.key, label: item.label }))}
              value={tab}
              onChange={(key) => {
                const next = new URLSearchParams(params)
                if (key === 'basic') next.delete('tab')
                else next.set('tab', key)
                setParams(next, { replace: true })
              }}
            />
            {tab === 'basic' ? <BasicInfo project={project.data} /> : null}
            {tab === 'members' ? <Members project={project.data} /> : null}
            {tab === 'archive' ? <Archive project={project.data} /> : null}
          </>
        )}
      </Page>
    </main>
  )
}

function BasicInfo({ project }: { project: Project }) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const editable = project.role === 'PROJECT_ADMIN'
  const [editing, setEditing] = useState<'name' | 'description' | null>(null)
  const [draft, setDraft] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const groups = useQuery({
    queryKey: chatKeys.groups(project.id),
    queryFn: () => chatApi.groups(project.id),
  })
  const defaultGroup = groups.data?.find((group) => group.defaultGroup)
  const update = useMutation({
    mutationFn: (values: { name: string; description?: string }) =>
      projectApi.update(project.id, {
        name: values.name.trim(),
        description: values.description?.trim(),
      }),
    onSuccess: (updated) => {
      client.setQueryData(['projects', project.id], updated)
      void client.invalidateQueries({ queryKey: ['teams', project.teamId, 'projects'] })
      setEditing(null)
      setFieldError(null)
      void message.success('项目资料已更新')
    },
    onError: (error) => setFieldError(formatApiError(error)),
  })

  function startEdit(field: 'name' | 'description') {
    setDraft(field === 'name' ? project.name : (project.description ?? ''))
    setFieldError(null)
    setEditing(field)
  }

  function cancelEdit() {
    setEditing(null)
    setFieldError(null)
  }

  function submitField() {
    if (editing === 'name') {
      const trimmed = draft.trim()
      if (!trimmed) {
        setFieldError('请输入项目名称')
        return
      }
      if (trimmed.length > 255) {
        setFieldError('项目名称最多 255 个字符')
        return
      }
      if (trimmed === project.name.trim()) {
        setEditing(null)
        return
      }
      update.mutate({ name: trimmed, description: project.description ?? '' })
      return
    }
    if (editing === 'description') {
      const trimmed = draft.trim()
      if (trimmed.length > 16000) {
        setFieldError('项目说明过长')
        return
      }
      if (trimmed === (project.description ?? '').trim()) {
        setEditing(null)
        return
      }
      update.mutate({ name: project.name, description: trimmed })
    }
  }

  const isDirty =
    editing === 'name'
      ? draft.trim() !== project.name.trim()
      : editing === 'description'
        ? draft.trim() !== (project.description ?? '').trim()
        : false

  return (
    <div className="setting-group">
      <div className="setting-row">
        <div className="setting-row__info">
          <span className="setting-row__label">项目名称</span>
        </div>
        <div className="setting-row__control">
          {editing === 'name' ? (
            <div className="setting-inline__edit">
              <div className="setting-inline__edit-row">
                <TextField
                  value={draft}
                  maxLength={255}
                  aria-label="项目名称"
                  autoFocus
                  disabled={update.isPending}
                  onChange={(event) => {
                    setDraft(event.target.value)
                    if (fieldError) setFieldError(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      submitField()
                    } else if (event.key === 'Escape') {
                      event.preventDefault()
                      cancelEdit()
                    }
                  }}
                />
                <div className="setting-inline__actions">
                  <Button variant="ghost" size="sm" disabled={update.isPending} onClick={cancelEdit}>
                    取消
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!isDirty || update.isPending}
                    onClick={submitField}
                  >
                    {update.isPending ? '保存中…' : '保存'}
                  </Button>
                </div>
              </div>
              {fieldError ? <p className="err">{fieldError}</p> : null}
            </div>
          ) : (
            <div className="setting-inline">
              <span className="setting-inline__text">{project.name}</span>
              {editable ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="编辑项目名称"
                  onClick={() => startEdit('name')}
                >
                  编辑
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="setting-row setting-row--top">
        <div className="setting-row__info">
          <span className="setting-row__label">项目说明</span>
        </div>
        <div className="setting-row__control">
          {editing === 'description' ? (
            <div className="setting-inline__edit">
              <TextAreaField
                rows={3}
                value={draft}
                maxLength={16000}
                aria-label="项目说明"
                autoFocus
                disabled={update.isPending}
                onChange={(event) => {
                  setDraft(event.target.value)
                  if (fieldError) setFieldError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    cancelEdit()
                  }
                }}
              />
              {fieldError ? <p className="err">{fieldError}</p> : null}
              <div className="setting-inline__actions">
                <Button variant="ghost" size="sm" disabled={update.isPending} onClick={cancelEdit}>
                  取消
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!isDirty || update.isPending}
                  onClick={submitField}
                >
                  {update.isPending ? '保存中…' : '保存'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="setting-inline setting-inline--top">
              {project.description ? (
                <span className="setting-inline__text">{project.description}</span>
              ) : (
                <span className="setting-inline__text setting-inline__placeholder">未填写</span>
              )}
              {editable ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="编辑项目说明"
                  onClick={() => startEdit('description')}
                >
                  编辑
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-row__info">
          <span className="setting-row__label">默认群</span>
        </div>
        <div className="setting-row__control">
          <span className="setting-row__value">{defaultGroup?.title ?? '默认群'}</span>
        </div>
      </div>

      {!editable ? (
        <div className="setting-group__foot">
          <span className="meta setting-group__foot-start">只有项目管理员可以修改项目资料。</span>
        </div>
      ) : null}
    </div>
  )
}

function Members({ project }: { project: Project }) {
  const { user } = useAuth()
  const { message } = App.useApp()
  const client = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [removing, setRemoving] = useState<ProjectMember | null>(null)
  const [addForm] = Form.useForm<{ userIds: string[] }>()
  const isAdmin = project.role === 'PROJECT_ADMIN'
  const members = useQuery({
    queryKey: ['projects', project.id, 'members'],
    queryFn: () => projectApi.listMembers(project.id),
  })
  const teamMembers = useQuery({
    queryKey: ['teams', project.teamId, 'members'],
    queryFn: () => teamApi.listMembers(project.teamId),
  })
  const teamMemberById = new Map((teamMembers.data ?? []).map((member) => [member.userId, member]))
  const teamOwnerId = (teamMembers.data ?? []).find(
    (member) => member.role === 'TEAM_OWNER',
  )?.userId
  // 项目成员接口不返回 displayName/email 时用团队成员补全（项目成员 ⊆ 团队成员）。
  const nameOf = (member: ProjectMember) =>
    member.displayName || teamMemberById.get(member.userId)?.displayName || member.userId
  const emailOf = (member: ProjectMember) =>
    member.email || teamMemberById.get(member.userId)?.email || '—'
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['projects', project.id, 'members'] })
    void client.invalidateQueries({ queryKey: ['projects', project.id] })
  }
  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: ProjectRole }) =>
      projectApi.updateMemberRole(project.id, userId, role),
    onSuccess: () => {
      invalidate()
      void message.success('成员角色已更新')
    },
    onError: (error) => void message.error(formatApiError(error)),
  })
  const remove = useMutation({
    mutationFn: (userId: string) => projectApi.removeMember(project.id, userId),
    onSuccess: () => {
      invalidate()
      setRemoving(null)
      void message.success('成员已移出项目')
    },
    onError: (error) => void message.error(formatApiError(error)),
  })
  const add = useMutation({
    mutationFn: (userIds: string[]) =>
      Promise.all(userIds.map((userId) => projectApi.addMember(project.id, userId))),
    onSuccess: (_data, userIds) => {
      invalidate()
      addForm.resetFields()
      setAddOpen(false)
      void message.success(`已加入 ${userIds.length} 位成员`)
    },
  })
  // 团队所有者已继承项目管理员权限，不出现在候选里；已在项目里的成员也不重复列出。
  const candidates = (teamMembers.data ?? []).filter(
    (member) =>
      member.userId !== teamOwnerId &&
      !(members.data ?? []).some((projectMember) => projectMember.userId === member.userId),
  )
  const canRemove = (member: ProjectMember) =>
    isAdmin && member.userId !== user?.id && member.userId !== teamOwnerId

  return (
    <>
      <Section
        title="项目成员"
        aside={
          isAdmin ? (
            <Button
              variant="quiet"
              icon={<Icon name="plus" size={16} aria-hidden />}
              onClick={() => setAddOpen(true)}
            >
              添加成员
            </Button>
          ) : (
            <Tag tone="readonly" icon="lock">
              只读
            </Tag>
          )
        }
      >
        {members.isPending ? (
          <Skeleton rows={4} />
        ) : members.isError ? (
          <EmptyState
            title="成员加载失败"
            description={formatApiError(members.error)}
            action={
              <Button
                variant="link"
                onClick={() => void members.refetch()}
                icon={<Icon name="refresh" size={15} />}
              >
                重试
              </Button>
            }
            stacked
          />
        ) : members.data.length === 0 ? (
          <EmptyState
            icon="people"
            title="还没有项目成员"
            action={
              isAdmin ? (
                <Button
                  variant="primary"
                  icon={<Icon name="plus" size={16} />}
                  onClick={() => setAddOpen(true)}
                >
                  添加成员
                </Button>
              ) : undefined
            }
            stacked
          />
        ) : (
          <DataTable layout="members" columns={['成员', '邮箱', '角色', '']}>
            {members.data.map((member) => (
              <TableRow key={member.userId}>
                <TableCell>
                  <span className="member-cell">
                    <Avatar name={nameOf(member)} src={member.avatarUrl} size="sm" />
                    <span className="member-cell__body">
                      <span className="name">{nameOf(member)}</span>
                      {member.userId === user?.id ? (
                        <span className="member-cell__badge">你</span>
                      ) : member.userId === teamOwnerId ? (
                        <span className="member-cell__badge">团队所有者</span>
                      ) : null}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="mono">{emailOf(member)}</TableCell>
                <TableCell>
                  {isAdmin && member.userId !== teamOwnerId ? (
                    <MenuSelect
                      variant="ghost"
                      aria-label={`调整 ${nameOf(member)} 的项目角色`}
                      value={member.role}
                      options={PROJECT_ROLE_OPTIONS}
                      disabled={updateRole.isPending}
                      onChange={(role) => updateRole.mutate({ userId: member.userId, role })}
                    />
                  ) : (
                    <span className="name">
                      {member.userId === teamOwnerId ? '项目管理员' : roleLabel(member.role)}
                    </span>
                  )}
                </TableCell>
                <TableCell end>
                  {canRemove(member) ? (
                    <Button
                      variant="ghost-danger"
                      size="sm"
                      onClick={() => setRemoving(member)}
                    >
                      移出
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        )}
      </Section>

      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="添加成员"
      >
        <Form
          form={addForm}
          layout="vertical"
          className="form"
          onFinish={(values) => add.mutate(values.userIds)}
          disabled={add.isPending}
          requiredMark={false}
        >
          {add.isError ? <p className="err">{formatApiError(add.error)}</p> : null}
          {candidates.length === 0 ? (
            <p className="meta">团队现有成员都已加入本项目。</p>
          ) : (
            <Form.Item
              name="userIds"
              label={`待加入的团队成员（${candidates.length}）`}
              rules={[{ required: true, message: '至少选择一位成员' }]}
            >
              <Checkbox.Group
                className="checks"
                options={candidates.map((member) => ({
                  value: member.userId,
                  label: member.displayName || member.email || member.userId,
                }))}
              />
            </Form.Item>
          )}
          <div className="dlg__foot">
            <Button
              variant="quiet"
              onClick={() => setAddOpen(false)}
              icon={<Icon name="close" size={15} />}
            >
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              icon={<Icon name="plus" size={15} />}
              disabled={add.isPending || candidates.length === 0}
            >
              {add.isPending ? '添加中…' : '添加'}
            </Button>
          </div>
        </Form>
      </Dialog>

      <Dialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="移出成员"
        danger
      >
        {removing ? (
          <div className="settings-subject">
            <Avatar name={nameOf(removing)} src={removing.avatarUrl} size="sm" />
            <span className="settings-subject__body">
              <span className="settings-subject__name">{nameOf(removing)}</span>
              <span className="settings-subject__mail mono">{emailOf(removing)}</span>
            </span>
          </div>
        ) : null}
        <div className="dlg__foot">
          <Button
            variant="quiet"
            onClick={() => setRemoving(null)}
            icon={<Icon name="close" size={15} />}
          >
            取消
          </Button>
          <Button
            variant="danger"
            icon={<Icon name="trash" size={15} />}
            disabled={remove.isPending}
            onClick={() => removing && remove.mutate(removing.userId)}
          >
            {remove.isPending ? '移出中…' : '移出'}
          </Button>
        </div>
      </Dialog>
    </>
  )
}

function Archive({ project }: { project: Project }) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<{ name: string }>()
  const archived = project.status === 'ARCHIVED'
  const isAdmin = project.role === 'PROJECT_ADMIN'
  const run = useMutation({
    mutationFn: () => (archived ? projectApi.restore(project.id) : projectApi.archive(project.id)),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['projects', project.id] })
      void client.invalidateQueries({ queryKey: ['teams', project.teamId, 'projects'] })
      setOpen(false)
      form.resetFields()
      void message.success(archived ? '项目已恢复' : '项目已归档')
    },
  })

  return (
    <div className="setting-group">
      <div className="setting-row setting-row--action">
        <div className="setting-row__info">
          <div className="setting-row__head">
            <span className="setting-row__label">{archived ? '恢复项目' : '归档项目'}</span>
            <Tag tone={archived ? 'readonly' : 'ok'}>{archived ? '已归档' : '使用中'}</Tag>
          </div>
          <span className="setting-row__desc">
            {archived ? '恢复后成员可继续在项目内协作' : '归档后项目变为只读，可随时恢复'}
          </span>
        </div>
        {isAdmin ? (
          <Button
            variant={archived ? 'quiet' : 'danger-outline'}
            size="sm"
            onClick={() => setOpen(true)}
          >
            {archived ? `恢复 ${project.name}` : `归档 ${project.name}`}
          </Button>
        ) : (
          <span className="meta">只有项目管理员可以归档或恢复项目。</span>
        )}
      </div>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
          form.resetFields()
        }}
        title={archived ? '恢复项目' : '归档项目'}
        danger={!archived}
      >
        <div className="settings-confirm">
          <span className="settings-confirm__label">项目</span>
          <span className="settings-confirm__name">{project.name}</span>
        </div>
        <Form
          form={form}
          layout="vertical"
          className="form"
          onFinish={() => run.mutate()}
          disabled={run.isPending}
          requiredMark={false}
        >
          {run.isError ? <p className="err">{formatApiError(run.error)}</p> : null}
          <Form.Item
            name="name"
            label="项目名称"
            rules={[
              { required: true, whitespace: true, message: '请输入项目名称' },
              {
                validator: (_, value: string) =>
                  value?.trim() === project.name
                    ? Promise.resolve()
                    : Promise.reject(new Error('名称与当前项目不一致')),
              },
            ]}
          >
            <TextField autoFocus autoComplete="off" placeholder={project.name} />
          </Form.Item>
          <div className="dlg__foot">
            <Button
              variant="quiet"
              onClick={() => {
                setOpen(false)
                form.resetFields()
              }}
              icon={<Icon name="close" size={15} />}
            >
              取消
            </Button>
            <Button
              variant={archived ? 'primary' : 'danger'}
              type="submit"
              icon={<Icon name={archived ? 'refresh' : 'archive'} size={15} />}
              disabled={run.isPending}
            >
              {run.isPending ? '处理中…' : archived ? '恢复项目' : '归档项目'}
            </Button>
          </div>
        </Form>
      </Dialog>
    </div>
  )
}
