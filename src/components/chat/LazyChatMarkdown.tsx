import { lazy, Suspense } from 'react'

/**
 * Markdown 正文按需加载：消息先以纯文本出现，react-markdown / remark-gfm
 * 到真正需要排版的时侯才下载，聊天首屏不被它们拖住。
 */
const ChatMarkdown = lazy(async () => ({
  default: (await import('./ChatMarkdown')).ChatMarkdown,
}))

export function LazyChatMarkdown({ text }: { text: string }) {
  return (
    <Suspense fallback={<p className="chat-panel__markdown-pending">{text}</p>}>
      <ChatMarkdown text={text} />
    </Suspense>
  )
}
