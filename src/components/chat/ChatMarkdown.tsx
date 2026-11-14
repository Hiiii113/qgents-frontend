import { useEffect, useRef, useState, type ReactNode } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button, Icon } from '@/components/ui'

/** 代码文本只可能是文本节点；嵌套时展平，供复制使用。 */
function plainText(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(plainText).join('')
  return ''
}

type CopyState = 'idle' | 'copied' | 'failed'
const COPY_LABEL: Record<CopyState, string> = { idle: '复制', copied: '已复制', failed: '复制失败' }

/** 围栏代码块：语言标签 + 复制；横向溢出不撑破消息列。 */
export function ChatCodeBlock({ language, code }: { language?: string; code: string }) {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy() {
    window.clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(code)
      setState('copied')
    } catch {
      setState('failed')
    }
    timer.current = window.setTimeout(() => setState('idle'), 1600)
  }

  return (
    <div className="chat-md__code">
      <div className="chat-md__code-head">
        <span>{language || '代码'}</span>
        <Button
          variant="link"
          size="sm"
          icon={<Icon name={state === 'copied' ? 'check' : 'copy'} size={14} />}
          onClick={() => void copy()}
        >
          {COPY_LABEL[state]}
        </Button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

const components: Components = {
  // 外链一律新窗口打开，且不带回 opener。
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  // 代码块自带外壳，去掉 <pre> 以免双层边框与嵌套滚动。
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const text = plainText(children)
    const language = /language-([\w+#.-]+)/.exec(className ?? '')?.[1]
    if (!language && !text.includes('\n')) return <code>{children}</code>
    return <ChatCodeBlock language={language} code={text.replace(/\n$/, '')} />
  },
  // GFM 表格在窄屏局部横向滚动，不压缩字号也不撑破消息列。
  table: ({ children }) => (
    <div className="chat-md__table">
      <table>{children}</table>
    </div>
  ),
}

/**
 * Agent 正文按 Markdown 渲染：不启用 raw HTML，链接沿用 react-markdown 的默认
 * urlTransform（javascript: 等协议被清空）。流式半截内容按普通文本/未闭合围栏渲染。
 */
export function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="chat-md">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </Markdown>
    </div>
  )
}

export function MarkdownPending({ text }: { text: string }) {
  return (
    <div className="chat-md">
      <p className="chat-md__pending">{text}</p>
    </div>
  )
}
