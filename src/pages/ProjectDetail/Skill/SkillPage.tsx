import { SkillActions } from '@/components/SkillActions'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Drawer, Form, Input, Modal, Segmented, Select, Spin, Tag } from 'antd'
import { PlusOutlined, TagsOutlined, UserOutlined } from '@ant-design/icons'
import { skillApi } from '@/api'
import type { Skill, SkillPreview, SkillStatus, SkillVisibility } from '@/types'
import './SkillPage.css'

/** 状态筛选维度 */
type FilterKey = 'ALL' | SkillStatus

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'DRAFT', label: '草稿' },
  { key: 'PENDING_REVIEW', label: '待审核' },
  { key: 'PUBLISHED', label: '已发布' },
  { key: 'REJECTED', label: '已拒绝' },
  { key: 'ARCHIVED', label: '已归档' },
]

const STATUS_LABEL: Record<SkillStatus, string> = {
  DRAFT: '草稿',
  PENDING_REVIEW: '待审核',
  PUBLISHED: '已发布',
  REJECTED: '已拒绝',
  ARCHIVED: '已归档',
}

const VISIBILITY_LABEL: Record<Skill['visibility'], string> = {
  PRIVATE: '私有',
  PROJECT_SHARED: '项目共享',
}

/**
 * 共享 Skill —— 当前接口
 * 列表 / 状态筛选 / 详情 / 文件导入 / 归档
 * 普通成员的审核操作在知识详情中完成；
 * Project Admin 创建 PROJECT_SHARED Skill 时由后端直接发布。
 */
export function SkillPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()

  const [filter, setFilter] = useState<FilterKey>('ALL')
  const [keyword, setKeyword] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<Skill | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const {
    data: skills = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['skills', projectId],
    queryFn: () => skillApi.list(projectId),
    enabled: !!projectId,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['skills', projectId] })

  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return skills.filter((skill) => {
      const matchesFilter = filter === 'ALL' || skill.status === filter
      const searchable = [skill.name, skill.description, skill.content, ...(skill.tags ?? [])]
        .join(' ')
        .toLowerCase()
      return matchesFilter && (!normalized || searchable.includes(normalized))
    })
  }, [skills, filter, keyword])

  const detail = skills.find((s) => s.id === detailId) ?? null

  return (
    <div className="skill-page">
      <div className="skill-toolbar">
        <Segmented
          options={FILTERS.map((f) => ({ label: f.label, value: f.key }))}
          value={filter}
          onChange={(v) => setFilter(v as FilterKey)}
        />
        <div className="skill-toolbar__actions">
          <Input.Search
            className="skill-toolbar__search"
            allowClear
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索名称、内容或标签"
            aria-label="搜索 Skill"
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建 Skill
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Spin delay={180} />
      ) : isError ? (
        <>
          <p className="skill-note">Skill 加载失败，请检查网络后重试。</p>
          <div>
            <Button onClick={() => void refetch()}>重新加载</Button>
          </div>
        </>
      ) : filtered.length === 0 ? (
        <p className="skill-note">
          {keyword.trim() || filter !== 'ALL'
            ? '没有匹配的 Skill，可以更换关键词或状态筛选。'
            : '暂无共享 Skill，用右上角新建私有 Skill，或创建项目共享 Skill。'}
        </p>
      ) : (
        <div className="skill-list">
          {filtered.map((s, i) => (
            <SkillCard key={s.id} skill={s} index={i + 1} onClick={() => setDetailId(s.id)} />
          ))}
        </div>
      )}

      {/* 详情抽屉 */}
      <SkillDetail
        skill={detail}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          // 编辑目标独立于详情抽屉，且不随列表刷新而更新，否则会重置表单覆盖未保存的输入
          setEditTarget(detail)
          setDetailId(null)
          setCreateOpen(true)
        }}
      />

      {/* 新建 / 编辑弹窗 */}
      <CreateSkillModal
        projectId={projectId}
        open={createOpen}
        editTarget={editTarget}
        onClose={() => {
          setCreateOpen(false)
          setEditTarget(null)
        }}
        onCreated={() => {
          invalidate()
          setCreateOpen(false)
          setEditTarget(null)
        }}
      />
    </div>
  )
}

/** 列表卡片。整行可点，用原生 button 拿到键盘焦点与 Enter 触发。 */
function SkillCard({
  skill,
  index,
  onClick,
}: {
  skill: Skill
  index: number
  onClick: () => void
}) {
  const status = STATUS_LABEL[skill.status] ?? skill.status
  const visibility = VISIBILITY_LABEL[skill.visibility] ?? skill.visibility
  return (
    <button type="button" className="skill-card" onClick={onClick}>
      <span className="skill-card__main">
        <span className="skill-card__index">{String(index).padStart(2, '0')}</span>
        <span className="skill-card__body">
          <span className="skill-card__name">{skill.name}</span>
          <span className="skill-card__description">{skill.description}</span>
        </span>
        <span className="skill-card__meta">
          <Tag>{visibility}</Tag>
          <Tag>{status}</Tag>
          <span className="skill-card__creator">{skill.creator?.displayName ?? '未知'}</span>
        </span>
      </span>
      {(skill.tags ?? []).length > 0 && (
        <span className="skill-card__tags">
          {(skill.tags ?? []).map((t) => (
            <Tag key={t} icon={<TagsOutlined />}>
              {t}
            </Tag>
          ))}
        </span>
      )}
    </button>
  )
}

/** 详情抽屉 */
function SkillDetail({
  skill,
  onClose,
  onEdit,
}: {
  skill: Skill | null
  onClose: () => void
  onEdit: () => void
}) {
  if (!skill) return <Drawer open={false} onClose={onClose} />
  const status = STATUS_LABEL[skill.status] ?? skill.status
  const visibility = VISIBILITY_LABEL[skill.visibility] ?? skill.visibility

  return (
    <Drawer
      title={skill.name}
      placement="right"
      size={420}
      open
      onClose={onClose}
      extra={<Tag>{status}</Tag>}
    >
      <div className="skill-detail">
        <div>
          <Tag>{visibility}</Tag>
          {(skill.tags ?? []).length > 0 && (
            <div className="skill-detail__tags">
              {(skill.tags ?? []).map((t) => (
                <Tag key={t} icon={<TagsOutlined />}>
                  {t}
                </Tag>
              ))}
            </div>
          )}
        </div>

        <p className="skill-detail__content">{skill.content}</p>

        <div className="skill-detail__meta">
          <span>
            <UserOutlined aria-hidden /> 创建者：{skill.creator?.displayName ?? '未知'}
          </span>
          {skill.reviewer && (
            <span>
              <UserOutlined aria-hidden /> 审核者：{skill.reviewer.displayName}
              {skill.reviewedAt ? ` · ${formatDate(skill.reviewedAt)}` : ''}
            </span>
          )}
        </div>

        <div className="skill-detail__actions">
          <SkillActions
            projectId={skill.projectId}
            id={skill.id}
            creatorId={skill.creator.id}
            status={skill.status}
            onEdit={onEdit}
          />
        </div>
      </div>
    </Drawer>
  )
}

/** 新建 / 编辑弹窗 */
function CreateSkillModal({
  projectId,
  open,
  editTarget,
  onClose,
  onCreated,
}: {
  projectId: string
  open: boolean
  editTarget: Skill | null
  onClose: () => void
  onCreated: () => void
}) {
  const [form] = Form.useForm<{ content: string; tags: string; visibility: SkillVisibility }>()
  const { message } = App.useApp()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<SkillPreview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({
      content: editTarget?.content,
      tags: editTarget?.tags.join(',') ?? '',
      visibility: editTarget?.visibility ?? 'PRIVATE',
    })
    setFile(null)
    setPreview(null)
    setError('')
  }, [open, editTarget, form])

  const previewMutation = useMutation({
    mutationFn: (selected: File) => skillApi.preview(projectId, selected),
    onSuccess: (result) => setPreview(result),
    onError: (err) => setError(err.message),
  })
  const save = useMutation({
    mutationFn: (values: { content: string; tags: string; visibility: SkillVisibility }) => {
      const tags = (values.tags ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
      return editTarget
        ? skillApi.patch(projectId, editTarget.id, { content: values.content, tags })
        : skillApi.create(projectId, { file: file!, visibility: values.visibility, tags })
    },
    onSuccess: (saved) => {
      onCreated()
      message.success(
        editTarget
          ? 'Skill 已更新'
          : saved.status === 'PUBLISHED'
            ? 'Skill 已创建并发布'
            : 'Skill 草稿已创建，提交审核后即可共享',
      )
    },
    onError: (err) => setError(err.message),
  })

  return (
    <Modal
      title={editTarget ? '编辑 Skill' : '导入 Skill'}
      open={open}
      onCancel={() => {
        if (!previewMutation.isPending && !save.isPending) onClose()
      }}
      closable={!previewMutation.isPending && !save.isPending}
      cancelButtonProps={{ disabled: previewMutation.isPending || save.isPending }}
      onOk={() => form.submit()}
      okText={editTarget ? '保存' : '确认创建'}
      cancelText="取消"
      confirmLoading={save.isPending}
      okButtonProps={{ disabled: !editTarget && !preview }}
      destroyOnClose
    >
      <Form
        className="skill-form"
        form={form}
        layout="vertical"
        onFinish={(values) => save.mutate(values)}
      >
        {editTarget ? (
          <>
            <p className="skill-form__intro">可见性：{VISIBILITY_LABEL[editTarget.visibility]}</p>
            <Form.Item
              name="content"
              label="SKILL.md 完整内容"
              rules={[{ required: true, message: '请输入完整文件内容' }]}
            >
              <Input.TextArea autoSize={{ minRows: 8, maxRows: 18 }} />
            </Form.Item>
          </>
        ) : (
          <>
            <p className="skill-form__intro">
              仅导入单个 SKILL.md。文件中提到的文件、脚本、外部工具或其他 Skill
              不会随之安装，宿主特有字段也未必生效。
            </p>
            <Form.Item label="选择 SKILL.md">
              <input
                type="file"
                accept=".md"
                aria-label="选择 SKILL.md"
                disabled={previewMutation.isPending}
                onChange={(event) => {
                  const selected = event.target.files?.[0]
                  setFile(null)
                  setPreview(null)
                  setError('')
                  if (!selected) return
                  setFile(selected)
                  previewMutation.mutate(selected)
                }}
              />
            </Form.Item>
            {previewMutation.isPending && <Spin delay={180} />}
            {preview && (
              <div className="skill-preview">
                <strong>{preview.name}</strong>
                <span className="skill-preview__content">{preview.description}</span>
                <span className="skill-preview__content">{preview.content}</span>
              </div>
            )}
            <Form.Item name="visibility" label="可见性" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'PRIVATE', label: '私有（仅自己可用）' },
                  { value: 'PROJECT_SHARED', label: '项目共享' },
                ]}
              />
            </Form.Item>
          </>
        )}
        <Form.Item name="tags" label="标签（逗号分隔）">
          <Input placeholder="如 java, backend" />
        </Form.Item>
        {error && <Alert type="error" showIcon message={error} />}
      </Form>
    </Modal>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
