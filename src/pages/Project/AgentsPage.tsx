import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { App, Form } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agentApi } from '@/api/agent'
import { chatApi } from '@/api/chat'
import { chatKeys } from '@/query/chatKeys'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
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
  Skeleton,
  TableCell,
  TableRow,
  Tag,
  TextAreaField,
  TextField,
} from '@/components/ui'
import type { AgentApplication, AgentStatus, ProjectAgent } from '@/types/agent'
import './agents.css'

const STATUS: Record<AgentStatus, { label: string; tone: 'ok' | 'wait' | 'stop' }> = {
  PENDING: { label: '待审批', tone: 'wait' },
  ACTIVE: { label: '已启用', tone: 'ok' },
  REJECTED: { label: '已拒绝', tone: 'stop' },
}

/**
 * 项目 Agent：默认 Agent 卡片 + 成员申请的自定义 Agent。
 * 申请提交后为待审批，不能邀请入群；审批只在默认群里由 Qgent 工具完成。
 */
export default function AgentsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { message } = App.useApp()
  const client = useQueryClient()
  const [form] = Form.useForm<AgentApplication>()
  const [open, setOpen] = useState(false)
  // 申请成功后给出直达默认群的跟进入口。
  const [application, setApplication] = useState<ProjectAgent | null>(null)

  const agents = useQuery({
    queryKey: chatKeys.agents(projectId),
    queryFn: () => agentApi.list(projectId),
    enabled: Boolean(projectId),
  })
  const groups = useQuery({
    queryKey: chatKeys.groups(projectId),
    queryFn: () => chatApi.groups(projectId),
    enabled: Boolean(projectId) && Boolean(application),
  })
  const defaultGroup = groups.data?.find((group) => group.defaultGroup)
  const apply = useMutation({
    mutationFn: (body: AgentApplication) => agentApi.apply(projectId, body),
    onSuccess: (created) => {
      setApplication(created)
      setOpen(false)
      form.resetFields()
      void client.invalidateQueries({ queryKey: chatKeys.agents(projectId) })
    },
    onError: (error) => void message.error(formatApiError(error)),
  })

  const list = agents.data ?? []
  const defaultAgent = list.find((agent) => agent.defaultAgent) ?? null
  const customAgents = list.filter((agent) => !agent.defaultAgent)
  const closeDialog = () => {
    if (apply.isPending) return
    setOpen(false)
    form.resetFields()
  }

  return (
    <main className="canvas">
      <Page>
        <PageHead
          title="Agent"
          description="每个项目有自己 ID 的默认 Agent。自定义 Agent 由成员申请，审批在默认群完成。"
          actions={
            <Button
              variant="primary"
              icon={<Icon name="plus" size={16} aria-hidden />}
              onClick={() => setOpen(true)}
            >
              申请新 Agent
            </Button>
          }
        />

        {agents.isPending ? (
          <Skeleton rows={3} />
        ) : agents.isError ? (
          <EmptyState
            title="Agent 加载失败"
            description={formatApiError(agents.error)}
            action={
              <Button
                variant="link"
                onClick={() => void agents.refetch()}
                icon={<Icon name="refresh" size={15} />}
              >
                重试
              </Button>
            }
            stacked
          />
        ) : (
          <>
            <Section title="默认 Agent">
              {defaultAgent ? (
                <article className="agent-default">
                  <Avatar
                    type="agent"
                    size="lg"
                    name={defaultAgent.name}
                    src={defaultAgent.avatarUrl ?? undefined}
                  />
                  <div className="agent-default__body">
                    <p className="agent-default__name">{defaultAgent.name}</p>
                    <p className="meta">
                      项目内独立 ID <span className="mono">{defaultAgent.id}</span> · 已在默认群启用
                    </p>
                    <p className="agent-default__desc">
                      {defaultAgent.description ||
                        '读取群上下文、项目记忆、附件与已导入仓库，在沙箱内执行并推送分支。'}
                    </p>
                  </div>
                  <Tag tone={STATUS[defaultAgent.status].tone}>
                    {STATUS[defaultAgent.status].label}
                  </Tag>
                </article>
              ) : (
                <EmptyState
                  title="还没有默认 Agent"
                  description="默认 Agent 由项目创建时生成；刷新后仍没有时可以重新加载。"
                  action={
                    <Button
                      variant="link"
                      onClick={() => void agents.refetch()}
                      icon={<Icon name="refresh" size={15} />}
                    >
                      重新加载
                    </Button>
                  }
                  stacked
                />
              )}
            </Section>

            <Section
              title="自定义 Agent"
              aside={<span className="meta">{customAgents.length} 个</span>}
            >
              {customAgents.length === 0 ? (
                <EmptyState
                  icon="agent"
                  title="还没有自定义 Agent"
                  description="成员可以按职责申请；通过后才会出现在群里可邀请的成员中。待审批的 Agent 不能邀请入群，到默认群 @Qgent 说明申请即可通过或拒绝。"
                  action={
                    <Button
                      variant="link"
                      onClick={() => setOpen(true)}
                      icon={<Icon name="plus" size={15} />}
                    >
                      申请新 Agent
                    </Button>
                  }
                  stacked
                />
              ) : (
                <DataTable layout="agents" columns={['名称', '职责', '状态', 'ID']}>
                  {customAgents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <span className="name">{agent.name}</span>
                        <span className="meta">自定义 Agent</span>
                      </TableCell>
                      <TableCell className="meta">{agent.description || '—'}</TableCell>
                      <TableCell>
                        <Tag tone={STATUS[agent.status].tone}>{STATUS[agent.status].label}</Tag>
                      </TableCell>
                      <TableCell className="mono">{agent.id}</TableCell>
                    </TableRow>
                  ))}
                </DataTable>
              )}
              {customAgents.length > 0 ? (
                <p className="note">
                  待审批的 Agent 不能邀请入群。到默认群 <code>@Qgent</code>{' '}
                  说明申请，即可通过或拒绝；前端没有独立的审批操作。
                </p>
              ) : null}
              {application ? (
                <p className="note note--ok">
                  {`「${application.name}」已提交，${STATUS[application.status].label}`}
                  {defaultGroup ? (
                    <>
                      {' · '}
                      <Link to={PATHS.projectChat(projectId, undefined, defaultGroup.id)}>
                        去默认群跟进
                      </Link>
                    </>
                  ) : null}
                  {' · '}
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setApplication(null)}
                    icon={<Icon name="close" size={15} />}
                  >
                    关闭
                  </Button>
                </p>
              ) : null}
            </Section>
          </>
        )}
      </Page>

      <Dialog
        open={open}
        onClose={closeDialog}
        title="申请新 Agent"
        description="提交后为待审批状态，不能邀请入群。到默认群 @Qgent 跟进即可。"
      >
        <Form
          className="form"
          form={form}
          layout="vertical"
          preserve={false}
          onFinish={(values) =>
            apply.mutate({
              name: values.name.trim(),
              systemPrompt: values.systemPrompt.trim(),
              description: values.description?.trim() || undefined,
              avatarUrl: values.avatarUrl?.trim() || undefined,
            })
          }
        >
          <Form.Item
            name="name"
            label="Agent 名称"
            rules={[
              { required: true, whitespace: true, message: '请输入 Agent 名称' },
              { max: 120 },
            ]}
          >
            <TextField maxLength={120} placeholder="例如：前端助手" />
          </Form.Item>
          <Form.Item name="description" label="职责描述" rules={[{ max: 2000 }]}>
            <TextAreaField rows={2} maxLength={2000} placeholder="这个 Agent 负责什么" />
          </Form.Item>
          <Form.Item
            name="systemPrompt"
            label="系统提示词"
            rules={[
              { required: true, whitespace: true, message: '请输入系统提示词' },
              { max: 20000 },
            ]}
          >
            <TextAreaField rows={4} maxLength={20000} placeholder="描述它的角色、边界和协作方式" />
          </Form.Item>
          <Form.Item
            name="avatarUrl"
            label="头像地址"
            rules={[{ max: 2048 }, { type: 'url', message: '请输入完整的图片地址' }]}
          >
            <TextField maxLength={2048} placeholder="可选，留空使用默认头像" />
          </Form.Item>
          <div className="dlg__foot">
            <Button variant="quiet" onClick={closeDialog} icon={<Icon name="close" size={15} />}>
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              icon={<Icon name="check" size={15} />}
              disabled={apply.isPending}
            >
              {apply.isPending ? '提交中…' : '提交申请'}
            </Button>
          </div>
        </Form>
      </Dialog>
    </main>
  )
}
