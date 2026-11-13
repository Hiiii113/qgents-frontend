import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Input } from 'antd'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { memoryApi, projectApi } from '@/api'
import { ApiError } from '@/api/client'
import { formatApiError } from '@/utils/formatApiError'
import { ProjectPage } from '../ProjectPage'
import './MemoryPage.css'

/** 编辑开始时捕获的正文与版本；编辑期间后台刷新不替换这份基准。 */
type MemoryEdit = { content: string; version: string; original: string }

/**
 * 项目共享知识：单个 memory.md。
 * 阅读直接使用查询数据；点编辑后固定当次正文与版本，避免后台刷新换掉保存基准。
 */
export function MemoryPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const { message, modal } = App.useApp()
  const [edit, setEdit] = useState<MemoryEdit | null>(null)

  const project = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: !!projectId,
  })

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['memory', projectId],
    queryFn: () => memoryApi.get(projectId),
    enabled: !!projectId,
  })

  const save = useMutation({
    mutationFn: (draft: MemoryEdit) =>
      memoryApi.save(projectId, { content: draft.content, version: draft.version }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['memory', projectId], saved)
      setEdit(null)
      void message.success('项目记忆已保存')
    },
    // 409 时保留草稿和旧版本，由用户取消后基于最新内容重新编辑；不自动丢弃。
  })

  const conflict = save.error instanceof ApiError && save.error.status === 409
  const dirty = Boolean(edit && edit.content !== edit.original)
  // 后端只允许项目管理员写入项目记忆，其他项目成员保持只读。
  const canEdit = project.data?.role === 'PROJECT_ADMIN'

  function startEdit() {
    if (!data) return
    save.reset()
    setEdit({ content: data.content, version: data.version, original: data.content })
  }

  function cancelEdit() {
    save.reset()
    setEdit(null)
  }

  function reload() {
    const run = () => {
      save.reset()
      setEdit(null)
      void refetch()
    }
    if (!dirty) {
      run()
      return
    }
    modal.confirm({
      title: '放弃未保存的修改？',
      content: '重新加载会用服务端最新内容替换当前草稿。',
      okText: '重新加载',
      cancelText: '继续编辑',
      onOk: run,
    })
  }

  if (isError)
    return (
      <ProjectPage title="共享知识">
        <Alert type="error" showIcon message={formatApiError(error)} />
      </ProjectPage>
    )
  if (isLoading || !data)
    return (
      <ProjectPage title="共享知识">
        <p className="memory-page__hint">正在加载项目记忆…</p>
      </ProjectPage>
    )

  const content = edit ? edit.content : data.content

  return (
    <ProjectPage title="共享知识">
      <section className="memory-page">
        <div className="memory-page__bar">
          <p className="memory-page__description">
            memory.md 是项目的长期记忆，Qgent 每次执行都会读取，修改前会先说明并征求同意。
            {canEdit ? '你也可以在这里直接编辑。' : '项目记忆只有项目管理员可以编辑。'}
          </p>
          <div className="memory-page__actions">
            <Button icon={<ReloadOutlined />} onClick={reload} disabled={save.isPending}>
              重新加载
            </Button>
            {edit ? (
              <>
                <Button onClick={cancelEdit} disabled={save.isPending}>
                  取消
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={save.isPending}
                  disabled={!dirty}
                  onClick={() => save.mutate(edit)}
                >
                  保存
                </Button>
              </>
            ) : (
              canEdit && (
                <Button type="primary" onClick={startEdit}>
                  编辑
                </Button>
              )
            )}
          </div>
        </div>
        {conflict ? (
          <Alert
            type="warning"
            showIcon
            message="内容已被更新，草稿仍保留"
            description="保存使用了编辑开始时的版本。请取消编辑，重新加载最新内容后再基于新版本修改。"
            action={
              <Button size="small" onClick={cancelEdit}>
                取消编辑
              </Button>
            }
          />
        ) : (
          save.isError && <Alert type="error" showIcon message={formatApiError(save.error)} />
        )}
        {edit ? (
          <Input.TextArea
            className="memory-page__editor"
            aria-label="项目记忆内容"
            value={edit.content}
            onChange={(event) => setEdit({ ...edit, content: event.target.value })}
            autoSize={{ minRows: 18, maxRows: 28 }}
            placeholder="# 项目约定&#10;&#10;- 记录已确认、可长期复用的项目事实"
          />
        ) : data.content.trim() ? (
          <article className="memory-page__document">
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {data.content}
            </Markdown>
          </article>
        ) : (
          <p className="memory-page__empty">
            项目还没有记录共享知识。{canEdit ? '点击“编辑”开始记录。' : '项目管理员可以开始记录。'}
          </p>
        )}
        <div className="memory-page__footer">
          <span className="memory-page__meta">
            {edit ? (dirty ? '有未保存的修改' : '未修改') : '阅读模式'}
          </span>
          <span className="memory-page__meta">{content.length} 字符</span>
          {data.updatedAt && (
            <span className="memory-page__meta">
              最后修改 {new Date(data.updatedAt).toLocaleString()}
            </span>
          )}
        </div>
      </section>
    </ProjectPage>
  )
}
