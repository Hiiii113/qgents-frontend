import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Skeleton } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { memoryApi } from '@/api'
import { formatApiError } from '@/utils/formatApiError'
import { PATHS } from '@/routes/paths'
import { ProjectPage } from '../ProjectPage'
import './MemoryPage.css'

/**
 * 项目共享知识：只读展示 memory.md。
 * 写入只有一条路径——聊天中由项目管理员确认后，Qgent 调用 memory 工具完成。
 */
export function MemoryPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['memory', projectId],
    queryFn: () => memoryApi.get(projectId),
    enabled: !!projectId,
  })

  // 当前群优先，其次交给聊天页解析项目默认群，不写死群 ID。
  const chatPath = PATHS.projectChat(projectId, undefined, params.get('groupId') ?? undefined)

  return (
    <ProjectPage
      title="共享知识"
      action={
        <>
          <Button type="primary" onClick={() => navigate(chatPath)}>
            去聊天
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => void refetch()}>
            重新加载
          </Button>
        </>
      }
    >
      <section className="memory-page">
        <p className="memory-page__description">
          memory.md 是项目长期记忆，Qgent 每次执行都会读取。修改请在聊天里说明，确认后由 Qgent
          写入。
        </p>
        {isError ? (
          <Alert
            type="error"
            showIcon
            title={formatApiError(error)}
            action={<Button onClick={() => void refetch()}>重试</Button>}
          />
        ) : isLoading || !data ? (
          <Skeleton active paragraph={{ rows: 6 }} />
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
            <footer className="memory-page__footer">
              <span className="memory-page__meta">{data.content.length} 字符</span>
              {data.updatedAt && (
                <span className="memory-page__meta">
                  最后修改 {new Date(data.updatedAt).toLocaleString()}
                </span>
              )}
            </footer>
          </article>
        ) : (
          <p className="memory-page__empty">
            项目还没有记录长期记忆。在聊天里告诉 Qgent 需要长期保留的约定。
          </p>
        )}
      </section>
    </ProjectPage>
  )
}
