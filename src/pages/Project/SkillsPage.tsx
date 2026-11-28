import { useMemo, useState, type ChangeEvent } from 'react'
import { useParams } from 'react-router-dom'
import { App, Form } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { projectApi } from '@/api/project'
import { skillApi } from '@/api/skill'
import { useAuth } from '@/context/AuthContext'
import { formatApiError } from '@/utils/formatApiError'
import {
  Button,
  Dialog,
  EmptyState,
  Icon,
  Page,
  PageHead,
  SelectField,
  Skeleton,
  Tag,
  TextAreaField,
  TextField,
} from '@/components/ui'
import type { Skill, SkillPreview, SkillStatus, SkillVisibility } from '@/types'
import './skills.css'

type FilterKey = 'ALL' | SkillStatus
type ConfirmAction = 'reject' | 'archive'
type ReviewAction = 'submitReview' | 'approve' | ConfirmAction

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'DRAFT', label: '草稿' },
  { key: 'PENDING_REVIEW', label: '待审核' },
  { key: 'PUBLISHED', label: '已发布' },
  { key: 'REJECTED', label: '已拒绝' },
  { key: 'ARCHIVED', label: '已归档' },
]

const STATUS: Record<
  SkillStatus,
  { label: string; tone: 'neutral' | 'wait' | 'ok' | 'stop' | 'readonly' }
> = {
  DRAFT: { label: '草稿', tone: 'neutral' },
  PENDING_REVIEW: { label: '待审核', tone: 'wait' },
  PUBLISHED: { label: '已发布', tone: 'ok' },
  REJECTED: { label: '已拒绝', tone: 'stop' },
  ARCHIVED: { label: '已归档', tone: 'readonly' },
}

const VISIBILITY: Record<SkillVisibility, string> = {
  PRIVATE: '私有',
  PROJECT_SHARED: '项目共享',
}

/** 详情只展示正文，frontmatter 由上传时的完整文件保留。 */
function stripFrontmatter(content: string): string {
  const text = content.replace(/^\uFEFF/, '')
  const match = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(text)
  return match ? text.slice(match[0].length) : text
}

const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
}

/**
 * 项目 Skill：左侧列表按状态筛选，右侧看内容并完成审核。
 * 普通成员的申请是草稿/待审核，只有项目管理员批准后才对 Agent 生效。
 */
export default function SkillsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const { message } = App.useApp()
  const client = useQueryClient()
  const [filter, setFilter] = useState<FilterKey>('ALL')
  const [keyword, setKeyword] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ skill: Skill | null } | null>(null)
  const [confirm, setConfirm] = useState<{ skill: Skill; action: ConfirmAction } | null>(null)
  const [reason, setReason] = useState('')

  const skills = useQuery({
    queryKey: ['skills', projectId],
    queryFn: () => skillApi.list(projectId),
    enabled: Boolean(projectId),
  })
  const project = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: Boolean(projectId),
  })
  const admin = project.data?.role === 'PROJECT_ADMIN'

  const counts = useMemo(() => {
    const next: Record<FilterKey, number> = {
      ALL: 0,
      DRAFT: 0,
      PENDING_REVIEW: 0,
      PUBLISHED: 0,
      REJECTED: 0,
      ARCHIVED: 0,
    }
    for (const skill of skills.data ?? []) {
      next.ALL += 1
      next[skill.status] += 1
    }
    return next
  }, [skills.data])

  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return (skills.data ?? []).filter((skill) => {
      if (filter !== 'ALL' && skill.status !== filter) return false
      if (!normalized) return true
      return [skill.name, skill.description, skill.content, ...skill.tags]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    })
  }, [skills.data, filter, keyword])
  // 选中项可能被筛选掉，回落到当前列表第一条。
  const selected = filtered.find((skill) => skill.id === selectedId) ?? filtered[0] ?? null

  const review = useMutation({
    mutationFn: (input: { skill: Skill; action: ReviewAction; reason?: string }) => {
      const { skill, action } = input
      switch (action) {
        case 'reject':
          return skillApi.reject(projectId, skill.id, input.reason?.trim() ?? '')
        case 'submitReview':
          return skillApi.submitReview(projectId, skill.id)
        case 'approve':
          return skillApi.approve(projectId, skill.id)
        case 'archive':
          return skillApi.archive(projectId, skill.id)
      }
    },
    onSuccess: () => {
      setConfirm(null)
      setReason('')
      void client.invalidateQueries({ queryKey: ['skills', projectId] })
      void message.success('Skill 状态已更新')
    },
    onError: (error) => void message.error(formatApiError(error)),
  })

  const closeConfirm = () => {
    if (review.isPending) return
    setConfirm(null)
    setReason('')
  }
  const owns = (skill: Skill) => skill.creator.id === user?.id || admin
  const canEdit = selected ? owns(selected) && selected.status !== 'ARCHIVED' : false
  const canSubmit = selected
    ? owns(selected) && (selected.status === 'DRAFT' || selected.status === 'REJECTED')
    : false
  const canReview = selected ? admin && selected.status === 'PENDING_REVIEW' : false
  const canArchive = selected ? owns(selected) && selected.status === 'PUBLISHED' : false

  return (
    <main className="canvas">
      <Page>
        <PageHead
          title="Skill"
          actions={
            <Button
              variant="primary"
              icon={<Icon name="plus" size={16} aria-hidden />}
              onClick={() => setEditor({ skill: null })}
            >
              提交 Skill 申请
            </Button>
          }
        />

        {skills.isPending ? (
          <Skeleton rows={5} />
        ) : skills.isError ? (
          <EmptyState
            title="Skill 加载失败"
            description={formatApiError(skills.error)}
            action={
              <Button
                variant="link"
                onClick={() => void skills.refetch()}
                icon={<Icon name="refresh" size={15} />}
              >
                重试
              </Button>
            }
            stacked
          />
        ) : (
          <>
            <div className="tabs skill-tabs" role="tablist" aria-label="按状态筛选 Skill">
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  className="tab skill-tab"
                  aria-selected={filter === item.key}
                  onClick={() => setFilter(item.key)}
                >
                  {item.label}
                  <span className="skill-tab__count">{counts[item.key]}</span>
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={keyword.trim() ? 'search' : 'skill'}
                title={keyword.trim() ? '没有匹配的 Skill' : '还没有 Skill'}
                action={
                  keyword.trim() ? undefined : (
                    <Button
                      variant="quiet"
                      icon={<Icon name="plus" size={16} />}
                      onClick={() => setEditor({ skill: null })}
                    >
                      导入 Skill
                    </Button>
                  )
                }
                stacked
              />
            ) : (
              <div className="split skill-split">
                <div className="skill-master">
                  <label className="inline-search skill-search">
                    <span className="sr">搜索 Skill</span>
                    <Icon name="search" size={15} />
                    <input
                      type="search"
                      placeholder="搜索名称、内容或标签"
                      value={keyword}
                      onChange={(event) => setKeyword(event.target.value)}
                    />
                  </label>
                  <ul className="masterlist skill-masterlist">
                    {filtered.map((skill) => (
                      <li key={skill.id}>
                        <button
                          type="button"
                          className="masterrow"
                          aria-current={selected?.id === skill.id}
                          onClick={() => setSelectedId(skill.id)}
                        >
                          <span className="skill-master__top">
                            <span className="name">{skill.name}</span>
                            <Tag tone={STATUS[skill.status].tone}>
                              {STATUS[skill.status].label}
                            </Tag>
                          </span>
                          {skill.description ? (
                            <span className="meta skill-master__desc">{skill.description}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {selected ? (
                  <article className="panel skill-detail">
                    <header className="panel__head skill-detail__head">
                      <div className="skill-detail__title">
                        <h2 className="h2">{selected.name}</h2>
                        <p className="meta">
                          {selected.creator.displayName} · {VISIBILITY[selected.visibility]}
                        </p>
                      </div>
                      <Tag tone={STATUS[selected.status].tone}>{STATUS[selected.status].label}</Tag>
                    </header>

                    {selected.description ? (
                      <p className="panel__desc">{selected.description}</p>
                    ) : null}
                    {selected.tags.length ? (
                      <div className="skill-tags">
                        {selected.tags.map((tag) => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </div>
                    ) : null}

                    <div className="panel__block skill-body">
                      <h3 className="h3">内容</h3>
                      <div className="skill-content">
                        <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {stripFrontmatter(selected.content)}
                        </Markdown>
                      </div>
                    </div>

                    {selected.reviewer ? (
                      <p className="meta skill-reviewer">
                        <Icon name="check" size={13} />
                        审核 {selected.reviewer.displayName}
                        {selected.reviewedAt
                          ? ` · ${new Date(selected.reviewedAt).toLocaleDateString('zh-CN')}`
                          : ''}
                      </p>
                    ) : null}

                    {canEdit || canSubmit || canReview || canArchive ? (
                      <div className="panel__foot skill-actions">
                        {canEdit ? (
                          <Button
                            variant="quiet"
                            disabled={review.isPending}
                            onClick={() => setEditor({ skill: selected })}
                            icon={<Icon name="edit" size={15} />}
                          >
                            编辑
                          </Button>
                        ) : null}
                        {canSubmit ? (
                          <Button
                            variant="primary"
                            disabled={review.isPending}
                            onClick={() =>
                              review.mutate({ skill: selected, action: 'submitReview' })
                            }
                            icon={<Icon name="check" size={15} />}
                          >
                            提交审核
                          </Button>
                        ) : null}
                        {canReview ? (
                          <>
                            <Button
                              variant="quiet"
                              disabled={review.isPending}
                              onClick={() => setConfirm({ skill: selected, action: 'reject' })}
                              icon={<Icon name="close" size={15} />}
                            >
                              退回
                            </Button>
                            <Button
                              variant="primary"
                              disabled={review.isPending}
                              onClick={() => review.mutate({ skill: selected, action: 'approve' })}
                              icon={<Icon name="check" size={15} />}
                            >
                              通过
                            </Button>
                          </>
                        ) : null}
                        {canArchive ? (
                          <Button
                            variant="danger"
                            disabled={review.isPending}
                            onClick={() => setConfirm({ skill: selected, action: 'archive' })}
                            icon={<Icon name="archive" size={15} />}
                          >
                            归档
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                ) : null}
              </div>
            )}
          </>
        )}
      </Page>

      {editor ? (
        <SkillEditorDialog
          projectId={projectId}
          skill={editor.skill}
          onClose={() => setEditor(null)}
        />
      ) : null}

      <Dialog
        open={Boolean(confirm)}
        onClose={closeConfirm}
        title={confirm?.action === 'archive' ? '归档 Skill' : '退回 Skill'}
        danger={confirm?.action === 'archive'}
      >
        {confirm ? (
          <div className="skill-subject">
            <span className="skill-subject__icon" aria-hidden>
              <Icon name={confirm.action === 'archive' ? 'archive' : 'undo'} size={16} />
            </span>
            <span className="skill-subject__name">{confirm.skill.name}</span>
            <Tag tone={STATUS[confirm.skill.status].tone}>
              {STATUS[confirm.skill.status].label}
            </Tag>
          </div>
        ) : null}
        {confirm?.action === 'reject' ? (
          <div className="field">
            <label htmlFor="skill-reject-reason">退回原因</label>
            <TextAreaField
              id="skill-reject-reason"
              rows={3}
              value={reason}
              placeholder="说明需要修改的地方"
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        ) : null}
        <div className="dlg__foot">
          <Button variant="quiet" onClick={closeConfirm} icon={<Icon name="close" size={15} />}>
            取消
          </Button>
          <Button
            variant={confirm?.action === 'archive' ? 'danger' : 'primary'}
            icon={<Icon name={confirm?.action === 'archive' ? 'archive' : 'close'} size={15} />}
            disabled={review.isPending || (confirm?.action === 'reject' && !reason.trim())}
            onClick={() => {
              if (!confirm) return
              review.mutate({ skill: confirm.skill, action: confirm.action, reason })
            }}
          >
            {confirm?.action === 'archive' ? '归档' : '退回'}
          </Button>
        </div>
      </Dialog>
    </main>
  )
}

interface EditorValues {
  content?: string
  tags?: string
  visibility: SkillVisibility
}

/** 导入 SKILL.md 或编辑已有 Skill；创建时先预览文件解析结果再提交。 */
function SkillEditorDialog({
  projectId,
  skill,
  onClose,
}: {
  projectId: string
  skill: Skill | null
  onClose: () => void
}) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const [form] = Form.useForm<EditorValues>()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<SkillPreview | null>(null)
  const [error, setError] = useState('')

  const previewFile = useMutation({
    mutationFn: (selected: File) => skillApi.preview(projectId, selected),
    onSuccess: (result) => setPreview(result),
    onError: (err) => setError(formatApiError(err)),
  })
  const save = useMutation({
    mutationFn: (values: EditorValues) => {
      const tags = (values.tags ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
      if (skill) {
        return skillApi.patch(projectId, skill.id, {
          content: values.content?.trim() ?? '',
          tags,
        })
      }
      if (!file) throw new Error('请选择 SKILL.md 文件')
      return skillApi.create(projectId, { file, visibility: values.visibility, tags })
    },
    onSuccess: (saved) => {
      void client.invalidateQueries({ queryKey: ['skills', projectId] })
      void message.success(
        skill
          ? 'Skill 已更新'
          : saved.status === 'PUBLISHED'
            ? 'Skill 已创建并发布'
            : 'Skill 草稿已创建，提交审核后即可共享',
      )
      onClose()
    },
    onError: (err) => setError(formatApiError(err)),
  })

  const pickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null
    setFile(next)
    setPreview(null)
    setError('')
    if (next) previewFile.mutate(next)
  }
  const close = () => {
    if (save.isPending || previewFile.isPending) return
    onClose()
  }

  return (
    <Dialog open onClose={close} title={skill ? '编辑 Skill' : '导入 Skill'}>
      <Form
        className="form"
        form={form}
        layout="vertical"
        initialValues={{
          content: skill?.content,
          tags: skill?.tags.join(', ') ?? '',
          visibility: skill?.visibility ?? 'PRIVATE',
        }}
        onFinish={(values) => save.mutate(values)}
      >
        {skill ? (
          <>
            <div className="skill-editor__meta">
              <Tag tone="readonly" icon="lock">
                {VISIBILITY[skill.visibility]}
              </Tag>
            </div>
            <Form.Item
              name="content"
              label="SKILL.md 完整内容"
              rules={[{ required: true, message: '请输入完整文件内容' }]}
            >
              <TextAreaField rows={10} />
            </Form.Item>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="skill-file">SKILL.md 文件</label>
              <div
                className={`skill-upload${file ? ' skill-upload--picked' : ''}`}
                data-busy={previewFile.isPending ? 'true' : undefined}
              >
                <span className="skill-upload__icon" aria-hidden>
                  <Icon name={file ? 'file' : 'plus'} size={18} />
                </span>
                <span className="skill-upload__body">
                  <span className="skill-upload__title">
                    {file ? file.name : '选择 SKILL.md'}
                  </span>
                  {previewFile.isPending ? (
                    <span className="skill-upload__state" role="status">
                      解析中…
                    </span>
                  ) : null}
                </span>
                <span className="skill-upload__ext" aria-hidden>
                  MD
                </span>
                <input
                  id="skill-file"
                  className="skill-upload__input"
                  type="file"
                  accept=".md"
                  onChange={pickFile}
                />
              </div>
            </div>
            {preview ? (
              <div className="skill-preview">
                <div className="skill-preview__head">
                  <span className="name">{preview.name}</span>
                  <span className="mono skill-preview__file">SKILL.md</span>
                </div>
                {preview.description ? (
                  <p className="meta">{preview.description}</p>
                ) : null}
                <pre className="skill-preview__body">{preview.content}</pre>
              </div>
            ) : null}
            <Form.Item name="visibility" label="可见性" rules={[{ required: true }]}>
              <SelectField aria-label="可见性">
                <option value="PRIVATE">私有（仅自己可用）</option>
                <option value="PROJECT_SHARED">项目共享</option>
              </SelectField>
            </Form.Item>
          </>
        )}

        <Form.Item name="tags" label="标签（逗号分隔）">
          <TextField placeholder="如 java, backend" />
        </Form.Item>

        {error ? <p className="err">{error}</p> : null}

        <div className="dlg__foot">
          <Button variant="quiet" onClick={close} icon={<Icon name="close" size={15} />}>
            取消
          </Button>
          <Button
            variant="primary"
            type="submit"
            icon={<Icon name="check" size={15} />}
            disabled={save.isPending || previewFile.isPending || (!skill && !file)}
          >
            {save.isPending ? '保存中…' : skill ? '保存' : '确认创建'}
          </Button>
        </div>
      </Form>
    </Dialog>
  )
}
