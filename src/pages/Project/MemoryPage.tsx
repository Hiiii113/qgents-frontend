import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { memoryApi } from '@/api'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import { Button, EmptyState, Page, PageHead, Skeleton, Tag } from '@/components/ui'
import './memory.css'

/** 标题锚点用标题文本生成，目录与正文共用同一个 id。 */
function headingId(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return `mem-${slug || 'section'}`
}

function textOf(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(textOf).join('')
  return ''
}

const components: Components = {
  // 外链新窗口打开，不带回 opener。
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  // 只有标题带 id，目录锚点才能跳到正文。
  h2: ({ children }) => <h2 id={headingId(textOf(children))}>{children}</h2>,
  h3: ({ children }) => <h3 id={headingId(textOf(children))}>{children}</h3>,
}

/** 目录只收录二级标题，和原型的文档目录一致；代码块里的 # 不算标题。 */
function outlineOf(content: string): { id: string; label: string }[] {
  const items: { id: string; label: string }[] = []
  let inFence = false
  for (const line of content.split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      continue
    }
    const match = inFence ? null : /^##\s+(.+?)\s*#*\s*$/.exec(line)
    if (match) items.push({ id: headingId(match[1]), label: match[1] })
  }
  return items
}

/**
 * 项目记忆：只读展示 memory.md。
 * 写入只有一条路径——聊天中由项目管理员确认后，Qgent 调用 memory 工具完成。
 */
export default function MemoryPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const memory = useQuery({
    queryKey: ['memory', projectId],
    queryFn: () => memoryApi.get(projectId),
    enabled: Boolean(projectId),
  })
  const content = memory.data?.content.trim() ? memory.data.content : ''
  const outline = content ? outlineOf(content) : []

  return (
    <main className="canvas">
      <Page>
        <PageHead
          title="项目记忆"
          description={
            <>
              项目目录下的 <span className="mono">memory.md</span>，所有项目成员可读。
            </>
          }
          actions={<Tag tone="readonly">只读</Tag>}
        />

        {memory.isPending ? (
          <Skeleton rows={6} />
        ) : memory.isError ? (
          <EmptyState
            title="项目记忆加载失败"
            description={formatApiError(memory.error)}
            action={
              <Button variant="link" onClick={() => void memory.refetch()}>
                重试
              </Button>
            }
            stacked
          />
        ) : !content ? (
          <EmptyState
            icon="book"
            title="还没有项目记忆"
            description="在聊天里告诉 Qgent 需要长期保留的约定；项目管理员确认后由它写入 memory.md。"
            action={
              <Button variant="link" onClick={() => navigate(PATHS.projectChat(projectId))}>
                去群聊
              </Button>
            }
            stacked
          />
        ) : (
          <div className={outline.length ? 'split' : undefined}>
            {outline.length ? (
              <nav className="toc" aria-label="文档目录">
                <p className="toc__label">目录</p>
                <ul>
                  {outline.map((item) => (
                    <li key={item.id}>
                      <a className="toc__link" href={`#${item.id}`}>
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
            <article className="doc memory-doc">
              <Markdown remarkPlugins={[remarkGfm]} components={components}>
                {content}
              </Markdown>
              <footer className="memory-doc__foot">
                <span className="meta">{content.length} 字符</span>
                {memory.data?.updatedAt ? (
                  <span className="meta">
                    最后修改 {new Date(memory.data.updatedAt).toLocaleString('zh-CN')}
                  </span>
                ) : null}
              </footer>
            </article>
          </div>
        )}
      </Page>
    </main>
  )
}
