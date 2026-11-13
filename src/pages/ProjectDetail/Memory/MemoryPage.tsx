import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Skeleton } from 'antd'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { memoryApi } from '@/api'
import { formatApiError } from '@/utils/formatApiError'
import { ProjectPage } from '../ProjectPage'
import './MemoryPage.css'

/**
 * 项目记忆：只读展示 memory.md。
 * 写入只有一条路径——聊天中由项目管理员确认后，Qgent 调用 memory 工具完成。
 */
export function MemoryPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['memory', projectId],
    queryFn: () => memoryApi.get(projectId),
    enabled: !!projectId,
  })

  return (
    <ProjectPage title="项目记忆">
      <section className="memory-page">
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
