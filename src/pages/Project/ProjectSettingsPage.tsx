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
  Page,
  PageHead,
  Section,
  SelectField,
  Skeleton,
  TableCell,
  TableRow,
  Tabs,
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

const isProjectRole = (value: string): value is ProjectRole =>
  value === 'PROJECT_ADMIN' || value === 'PROJECT_MEMBER'

const roleLabel = (role: ProjectRole) => (role === 'PROJECT_ADMIN' ? '项目管理员' : '成员')

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
          kicker={project.data ? `项目 ${project.data.name}` : '项目'}
          title="项目设置"
          description={
            project.data?.status === 'ARCHIVED'
              ? '项目已归档，群聊只读；恢复后可继续协作。'
              : '项目资料与成员在这里维护，Agent、记忆、Skill 与仓库在项目导航里。'
          }
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
  const [form] = Form.useForm<{ name: string; description?: string }>()
  const editable = project.role === 'PROJECT_ADMIN'
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
      void message.success('项目资料已更新')
    },
  })

  return (
    <Form
      form={form}
      layout="vertical"
      className="form form--narrow"
      initialValues={{ name: project.name, description: project.description ?? '' }}
      onFinish={(values) => update.mutate(values)}
      disabled={!editable || update.isPending}
      requiredMark={false}
    >
      {update.isError ? <p className="err">{formatApiError(update.error)}</p> : null}
      <Form.Item
        name="name"
        label="项目名称"
        rules={[
          { required: true, whitespace: true, message: '请输入项目名称' },
          { max: 255, message: '项目名称最多 255 个字符' },
        ]}
      >
        <TextField maxLength={255} />
      </Form.Item>
      <Form.Item name="description" label="项目说明">
        <TextAreaField rows={3} maxLength={16000} />
      </Form.Item>
      <Form.Item label="默认群" extra="创建项目时自动生成，Qgent 已加入；群名可在聊天页修改。">
        <TextField value={defaultGroup?.title ?? '默认群'} readOnly />
      </Form.Item>
      {editable ? (
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
      ) : (
        <p className="meta">只有项目管理员可以修改项目资料。</p>
      )}
    </Form>
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
            <span className="meta">只有项目管理员可以调整成员。</span>
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
            description="从团队成员里添加需要参与这个项目的人。"
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
                        <span className="meta">你</span>
                      ) : member.userId === teamOwnerId ? (
                        <span className="meta">团队所有者</span>
                      ) : null}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="mono">{emailOf(member)}</TableCell>
                <TableCell>
                  {isAdmin && member.userId !== teamOwnerId ? (
                    <SelectField
                      className="project-settings__role"
                      aria-label={`调整 ${nameOf(member)} 的项目角色`}
                      value={member.role}
                      disabled={updateRole.isPending}
                      onChange={(event) => {
                        if (isProjectRole(event.target.value)) {
                          updateRole.mutate({ userId: member.userId, role: event.target.value })
                        }
                      }}
                    >
                      <option value="PROJECT_ADMIN">项目管理员</option>
                      <option value="PROJECT_MEMBER">成员</option>
                    </SelectField>
                  ) : (
                    <span className="name">
                      {member.userId === teamOwnerId ? '项目管理员' : roleLabel(member.role)}
                    </span>
                  )}
                </TableCell>
                <TableCell end>
                  {canRemove(member) ? (
                    <Button
                      variant="link"
                      onClick={() => setRemoving(member)}
                      icon={<Icon name="trash" size={15} />}
                    >
                      移出
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

      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="添加成员"
        description="从团队成员中选择；团队所有者已继承项目管理员权限。"
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
        description={
          removing
            ? `确定要把「${nameOf(removing)}」移出项目吗？该成员将失去这个项目的访问权限。`
            : ''
        }
      >
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
    <div className="danger">
      <h2 className="h3">{archived ? '恢复项目' : '归档项目'}</h2>
      <p className="sub">
        {archived
          ? '恢复后群聊可继续派活，Agent 与已导入的仓库引用保持不变。'
          : '归档后项目变为只读：群聊可读、不能再派活，Agent 与仓库引用保留，可随时恢复。'}
      </p>
      {isAdmin ? (
        <Button
          variant={archived ? 'quiet' : 'danger'}
          icon={<Icon name={archived ? 'refresh' : 'trash'} size={16} aria-hidden />}
          onClick={() => setOpen(true)}
        >
          {archived ? `恢复 ${project.name}` : `归档 ${project.name}`}
        </Button>
      ) : (
        <p className="meta">只有项目管理员可以归档或恢复项目。</p>
      )}

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
          form.resetFields()
        }}
        title={archived ? '恢复项目' : '归档项目'}
        danger={!archived}
        description={`输入项目名称「${project.name}」确认。`}
      >
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
            <TextField autoFocus autoComplete="off" />
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
