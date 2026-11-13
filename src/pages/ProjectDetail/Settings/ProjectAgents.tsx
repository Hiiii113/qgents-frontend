import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, App, Avatar, Button, Form, Input, Modal, Skeleton, Tag } from 'antd'
import { PlusOutlined, RobotOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agentApi } from '@/api/agent'
import { chatApi } from '@/api/chat'
import { chatKeys } from '@/query/chatKeys'
import { formatApiError } from '@/utils/formatApiError'
import { PATHS } from '@/routes/paths'
import { ProjectPage } from '../ProjectPage'
import type { AgentApplication, AgentStatus, ProjectAgent } from '@/types/agent'
import './SettingsPage.css'

const statusLabel: Record<AgentStatus, string> = {
  PENDING: '待审批',
  ACTIVE: '已启用',
  REJECTED: '已拒绝',
}

/** 项目 Agent：浏览已启用的 Agent，申请新 Agent 后去默认群跟进管理员审批。 */
export function ProjectAgents() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { message } = App.useApp()
  const client = useQueryClient()
  const [form] = Form.useForm<AgentApplication>()
  const [open, setOpen] = useState(false)
  const [application, setApplication] = useState<ProjectAgent | null>(null)
  const agents = useQuery({
    queryKey: chatKeys.agents(projectId),
    queryFn: () => agentApi.list(projectId),
    enabled: Boolean(projectId),
  })
  // 申请后给出一条去默认群跟进的直达入口；只在有申请结果时读取群列表。
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

  return (
    <ProjectPage
      title="Agent"
      action={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          申请新 Agent
        </Button>
      }
    >
      <div className="settings-page">
        {agents.isError && (
          <Alert
            type="error"
            showIcon
            title={formatApiError(agents.error)}
            action={<Button onClick={() => void agents.refetch()}>重试</Button>}
          />
        )}
        {application && (
          <section className="settings-application">
            <p>{`「${application.name}」已提交，${statusLabel[application.status]}`}</p>
            <p className="settings-hint">项目管理员在默认群回复并 @Agent 后生效。</p>
            <div className="settings-application__actions">
              {defaultGroup && (
                <Link
                  className="settings-application__link"
                  to={PATHS.projectChat(projectId, undefined, defaultGroup.id)}
                >
                  去默认群跟进
                </Link>
              )}
              <Button type="text" size="small" onClick={() => setApplication(null)}>
                关闭
              </Button>
            </div>
          </section>
        )}
        <section className="settings-section">
          <h2 className="settings-section__title">已启用的 Agent</h2>
          {agents.isPending ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : !(agents.data ?? []).length ? (
            <p className="settings-hint">项目暂无已启用的 Agent。</p>
          ) : (
            <ul className="settings-agent-list">
              {(agents.data ?? []).map((agent) => (
                <li className="settings-agent-list__row" key={agent.id}>
                  <Avatar
                    shape="square"
                    src={agent.avatarUrl ?? undefined}
                    icon={<RobotOutlined />}
                  />
                  <div className="settings-agent-list__body">
                    <span className="settings-agent-list__name">{agent.name}</span>
                    <span className="settings-agent-list__description">
                      {agent.description || '暂无描述'}
                    </span>
                  </div>
                  {agent.defaultAgent && <Tag>默认 Agent</Tag>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <Modal
        title="申请新 Agent"
        open={open}
        okText="提交申请"
        cancelText="取消"
        confirmLoading={apply.isPending}
        onOk={() => form.submit()}
        onCancel={() => {
          setOpen(false)
          form.resetFields()
        }}
      >
        <Form
          className="settings-form"
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
            <Input maxLength={120} placeholder="例如：前端助手" />
          </Form.Item>
          <Form.Item name="description" label="职责描述" rules={[{ max: 2000 }]}>
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 5 }}
              maxLength={2000}
              placeholder="这个 Agent 负责什么"
            />
          </Form.Item>
          <Form.Item
            name="systemPrompt"
            label="系统提示词"
            rules={[
              { required: true, whitespace: true, message: '请输入系统提示词' },
              { max: 20000 },
            ]}
          >
            <Input.TextArea
              autoSize={{ minRows: 4, maxRows: 10 }}
              maxLength={20000}
              placeholder="描述它的角色、边界和协作方式"
            />
          </Form.Item>
          <Form.Item
            name="avatarUrl"
            label="头像地址"
            rules={[{ max: 2048 }, { type: 'url', message: '请输入完整的图片地址' }]}
          >
            <Input maxLength={2048} placeholder="可选，留空使用默认头像" />
          </Form.Item>
        </Form>
      </Modal>
    </ProjectPage>
  )
}
