import { KnowledgeActions } from '@/components/KnowledgeActions'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import {
  PlusOutlined,
  TagsOutlined,
  UserOutlined,
  MessageOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { memoryApi } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import type { CreateMemoryPayload, Memory, MemoryStatus } from '@/types'
import './MemoryPage.css'

const { Text, Paragraph } = Typography

type FilterKey = 'ALL' | MemoryStatus

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'DRAFT', label: '草稿' },
  { key: 'PENDING_REVIEW', label: '待审核' },
  { key: 'APPROVED', label: '已发布' },
  { key: 'REJECTED', label: '已拒绝' },
  { key: 'ARCHIVED', label: '已归档' },
]

const STATUS_META: Record<MemoryStatus, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: '草稿' },
  PENDING_REVIEW: { color: 'orange', label: '待审核' },
  APPROVED: { color: 'green', label: '已发布' },
  REJECTED: { color: 'red', label: '已拒绝' },
  ARCHIVED: { color: 'default', label: '已归档' },
}

/**
 * 项目共享 Memory：列表、详情、创建、编辑与审核。
 * 列表 / 状态筛选 / 详情 / 手动创建 / 归档
 * 审核操作在知识详情中完成
 */
export function MemoryPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()

  const [filter, setFilter] = useState<FilterKey>('ALL')
  const [keyword, setKeyword] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const { data: memories = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['memories', projectId],
    queryFn: () => memoryApi.list(projectId),
    enabled: !!projectId,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['memories', projectId] })

  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return memories.filter((memory) => {
      const matchesFilter = filter === 'ALL' || memory.status === filter
      const searchable = [memory.title, memory.content, memory.category, ...(memory.tags ?? [])].join(' ').toLowerCase()
      return matchesFilter && (!normalized || searchable.includes(normalized))
    })
  }, [memories, filter, keyword])

  const detail = memories.find((m) => m.id === detailId) ?? null
  const editTarget = memories.find((m) => m.id === editId) ?? null


  return (
    <>

      <div className="memory-page__toolbar">
        <Select<FilterKey>
          className="memory-page__filter"
          options={FILTERS.map((f) => ({ label: f.label, value: f.key }))}
          value={filter}
          onChange={setFilter}
        />
        <Space>
          <Input.Search
            allowClear
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索标题、内容或标签"
            style={{ width: 240 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建 Memory
          </Button>
        </Space>
      </div>

      {isLoading ? <Spin delay={180} size="large" /> : isError ? (
        <EmptyState
          icon="⚠️"
          title="Memory 加载失败"
          description="请检查网络后重试"
          action={<Button onClick={() => void refetch()}>重新加载</Button>}
        />
      ) : <div className="memory-page__workspace">
        <section className="memory-page__list-panel" aria-label="Memory 列表">
          <div className="memory-page__list-heading">
            <span>知识条目</span>
            <span>{filtered.length}</span>
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              icon="🧠"
              title={keyword.trim() || filter !== 'ALL' ? '没有匹配的 Memory' : '暂无 Memory'}
              description={keyword.trim() || filter !== 'ALL' ? '可以更换关键词或状态筛选' : '从项目聊天沉淀讨论结论，或手动新建一条项目知识'}
            />
          ) : (
            <div className="memory-page__list">
              {filtered.map((m) => (
                <MemoryCard
                  key={m.id}
                  memory={m}
                  selected={m.id === detailId}
                  onClick={() => setDetailId(m.id)}
                />
              ))}
            </div>
          )}
        </section>

        <MemoryDetail
          memory={detail}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            setEditId(detail?.id ?? null)
            setCreateOpen(true)
          }}
        />
      </div>}

      {/* 新建 / 编辑弹窗 */}
      <CreateMemoryModal
        projectId={projectId}
        open={createOpen}
        editTarget={editTarget}
        onClose={() => {
          setCreateOpen(false)
          setEditId(null)
        }}
        onCreated={() => {
          invalidate()
          setCreateOpen(false)
          setEditId(null)
        }}
      />
    </>
  )
}

/** 列表卡片 */
function MemoryCard({ memory, selected, onClick }: { memory: Memory; selected: boolean; onClick: () => void }) {
  const meta = STATUS_META[memory.status] ?? { color: 'default', label: memory.status }
  return (
    <Card className={`memory-card${selected ? ' memory-card--selected' : ''}`} onClick={onClick}>
      <div className="memory-card__main">
        <div className="memory-card__left">
          <div className="memory-card__name-wrap">
            <Text className="memory-card__name">{memory.title}</Text>
            <Paragraph ellipsis={{ rows: 1 }} className="memory-card__content">
              {memory.content}
            </Paragraph>
          </div>
        </div>
        <div className="memory-card__right">
          <Tag color={meta.color} style={{ margin: 0 }}>
            {meta.label}
          </Tag>
          <Text className="memory-card__creator">
            {memory.creator?.displayName ?? '未知'}
          </Text>
        </div>
      </div>
      <div className="memory-card__tags">
        <Tag bordered={false} className="memory-card__category">
          {memory.category}
        </Tag>
        {(memory.tags ?? []).map((t) => (
          <Tag key={t} icon={<TagsOutlined />} bordered={false}>
            {t}
          </Tag>
        ))}
      </div>
    </Card>
  )
}

/** 固定详情栏 */
function MemoryDetail({
  memory,
  onClose,
  onEdit,
}: {
  memory: Memory | null
  onClose: () => void
  onEdit: () => void
}) {
  if (!memory) {
    return (
      <aside className="memory-detail memory-detail--empty">
        <MessageOutlined className="memory-detail__empty-icon" />
        <Text strong>选择一条 Memory</Text>
        <Text type="secondary">在这里查看完整内容和来源信息</Text>
      </aside>
    )
  }
  const meta = STATUS_META[memory.status] ?? { color: 'default', label: memory.status }

  return (
    <aside className="memory-detail">
      <div className="memory-detail__header">
        <div>
          <Text className="memory-detail__title">{memory.title}</Text>
          <div className="memory-detail__meta">
            <Tag color={meta.color}>{meta.label}</Tag>
            <Text type="secondary">{memory.category}</Text>
          </div>
        </div>
        <Button type="text" icon={<CloseOutlined />} onClick={onClose} aria-label="关闭详情" />
      </div>
      <div className="memory-detail__body">
        {(memory.tags ?? []).length > 0 && (
          <div className="memory-detail__tags">
            {(memory.tags ?? []).map((t) => (
              <Tag key={t} icon={<TagsOutlined />}>
                {t}
              </Tag>
            ))}
          </div>
        )}
        <Paragraph className="memory-detail__content">{memory.content}</Paragraph>
        <div className="memory-detail__provenance">
          <div>
            <UserOutlined /> 创建者：{memory.creator?.displayName ?? '未知'}
          </div>
          {memory.reviewer && (
            <div>
              <UserOutlined /> 审核者：{memory.reviewer.displayName}
              {memory.reviewedAt ? ` · ${formatDate(memory.reviewedAt)}` : ''}
            </div>
          )}
        </div>
        <div className="memory-detail__actions">
          <KnowledgeActions kind="memory" projectId={memory.projectId} id={memory.id} creatorId={memory.creator.id} status={memory.status} onEdit={onEdit} />
        </div>
      </div>
    </aside>
  )
}

/** 新建 / 编辑弹窗 */
function CreateMemoryModal({
  projectId,
  open,
  editTarget,
  onClose,
  onCreated,
}: {
  projectId: string
  open: boolean
  editTarget: Memory | null
  onClose: () => void
  onCreated: () => void
}) {
  const [form] = Form.useForm<CreateMemoryPayload>()
  const { message } = App.useApp()

  // 弹窗打开/编辑目标变化时显式回填表单（绕开 Modal destroyOnClose 下 initialValues 时序问题，
  // 确保编辑时标签等所有字段回显）
  useEffect(() => {
    if (!open) return
    if (editTarget) {
      form.setFieldsValue({
        title: editTarget.title,
        content: editTarget.content,
        category: editTarget.category,
        // 标签输入为逗号分隔字符串（提交时 splitTags 转回数组）
        tags: (editTarget.tags ?? []).join(','),
      } as unknown as Partial<CreateMemoryPayload>)
    } else {
      form.resetFields()
      form.setFieldsValue({ category: 'ENGINEERING_DECISION' })
    }
  }, [open, editTarget, form])

  const save = useMutation({
    mutationFn: (payload: CreateMemoryPayload) =>
      editTarget
        ? memoryApi.patch(projectId, editTarget.id, payload)
        : memoryApi.create(projectId, payload),
    onSuccess: (saved) => {
      form.resetFields()
      onCreated()
      // Project Admin 自建免审批：直接 APPROVED 上架；普通成员创建为草稿
      if (editTarget) {
        message.success('Memory 已更新')
      } else {
        message.success(saved.status === 'APPROVED' ? 'Memory 已创建并发布为项目共享知识' : 'Memory 草稿已创建，提交审核后即可共享')
      }
    },
  })

  return (
    <Modal
      title={editTarget ? '编辑 Memory' : '新建 Memory'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editTarget ? '保存' : '创建'}
      cancelText="取消"
      confirmLoading={save.isPending}
      destroyOnClose
      // 编辑目标变化时强制重建 Modal 内容，确保 initialValues（含标签回显）重新生效
      key={editTarget?.id ?? 'create'}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(v) => save.mutate({ ...v, tags: splitTags(v.tags) })}
        initialValues={
          editTarget
            ? {
                title: editTarget.title,
                content: editTarget.content,
                category: editTarget.category,
                tags: (editTarget.tags ?? []).join(','),
              }
            : { category: 'ENGINEERING_DECISION' }
        }
      >
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="例如：密码存储约定" maxLength={50} />
        </Form.Item>
        <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
          <Input.TextArea
            placeholder="沉淀为可复用的项目知识或约定"
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
        </Form.Item>
        <Form.Item name="category" label="分类">
          <Select
            options={[
              { value: 'ENGINEERING_DECISION', label: '工程决策' },
              { value: 'PROCESS', label: '流程约定' },
              { value: 'GENERAL', label: '通用' },
            ]}
          />
        </Form.Item>
        <Form.Item name="tags" label="标签（逗号分隔）">
          <Input placeholder="如 auth / security，用逗号分隔" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

/** 标签输入（逗号分隔字符串或数组）→ string[] */
function splitTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((tag): tag is string => typeof tag === 'string')
  if (typeof value === 'string') return value.split(',').map((tag) => tag.trim()).filter(Boolean)
  return []
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
