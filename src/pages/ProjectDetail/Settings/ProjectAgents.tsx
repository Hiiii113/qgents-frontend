import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, App, Avatar, Button, Form, Input, List, Modal, Tag } from 'antd'
import { PlusOutlined, RobotOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agentApi } from '@/api/agent'
import { chatKeys } from '@/query/chatKeys'
import { formatApiError } from '@/utils/formatApiError'
import type { AgentApplication, AgentStatus, ProjectAgent } from '@/types/agent'

const statusLabel: Record<AgentStatus, string> = {
  PENDING: '待审批',
  ACTIVE: '已启用',
  REJECTED: '已拒绝',
}

/** 项目 Agent：成员提交自定义 Agent 申请，项目管理员在默认群回复并 @Agent 后启用。 */
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
    <div className="workspace-card" style={{ maxWidth: 760 }}>
      {agents.isError && <Alert type="error" showIcon message={formatApiError(agents.error)} />}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <h3 style={{ marginBottom: 4 }}>项目 Agent</h3>
          <p style={{ color: '#6b7280', margin: 0 }}>
            申请本项目专用的 Agent；审批通过后可在群设置里邀请它入群。
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          申请新 Agent
        </Button>
      </div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="申请会公布在项目默认群，项目管理员回复并 @Agent 后生效；审批通过前不能邀请入群或参与对话。"
      />
      {application && (
        <Alert
          type="success"
          showIcon
          closable
          style={{ marginBottom: 16 }}
          onClose={() => setApplication(null)}
          message={`「${application.name}」申请已提交，${statusLabel[application.status]}`}
          description="请在项目默认群等待项目管理员回复并 @Agent 审批，通过后即可邀请入群。"
        />
      )}
      <List
        loading={agents.isPending}
        dataSource={agents.data ?? []}
        locale={{ emptyText: '项目暂无已启用的 Agent' }}
        renderItem={(agent: ProjectAgent) => (
          <List.Item
            extra={
              agent.defaultAgent ? (
                <Tag color="gold">默认 Agent</Tag>
              ) : (
                <Tag color="green">已启用</Tag>
              )
            }
          >
            <List.Item.Meta
              avatar={<Avatar src={agent.avatarUrl ?? undefined} icon={<RobotOutlined />} />}
              title={agent.name}
              description={agent.description || '暂无描述'}
            />
          </List.Item>
        )}
      />
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
    </div>
  )
}
