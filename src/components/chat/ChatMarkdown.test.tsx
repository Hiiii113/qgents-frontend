import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ChatMarkdown } from './ChatMarkdown'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('renders headings, lists, links, quotes and inline code', () => {
  const view = render(
    <ChatMarkdown
      text={[
        '## 排版结论',
        '',
        '先给结论：**头像列 + 作者行**，正文再长也不挤。',
        '',
        '- 头像固定在左上角',
        '- 正文限宽 62ch',
        '',
        '> 人类消息保持纯文本。',
        '',
        '见 `ChatMessageRow.tsx` 与 [可访问性指南](https://www.w3.org/WAI/tutorials/)。',
      ].join('\n')}
    />,
  )
  expect(screen.getByRole('heading', { name: '排版结论' })).toBeInTheDocument()
  expect(view.container.querySelectorAll('li')).toHaveLength(2)
  expect(view.container.querySelector('blockquote')).toHaveTextContent('人类消息保持纯文本。')
  expect(view.container.querySelector('code')).toHaveTextContent('ChatMessageRow.tsx')
  const link = screen.getByRole('link', { name: '可访问性指南' })
  expect(link).toHaveAttribute('href', 'https://www.w3.org/WAI/tutorials/')
  expect(link).toHaveAttribute('target', '_blank')
  expect(link.getAttribute('rel')).toContain('noreferrer')
  expect(link.getAttribute('rel')).toContain('noopener')
})

it('wraps a GFM table in its own scroll container', () => {
  const view = render(
    <ChatMarkdown
      text={['| 方案 | 头像 |', '| --- | --- |', '| 气泡 | 左侧 |', '| 头像列 | 左上角 |'].join(
        '\n',
      )}
    />,
  )
  const wrapper = view.container.querySelector('.chat-md__table')
  expect(wrapper).not.toBeNull()
  expect(wrapper?.querySelector('table')).not.toBeNull()
  expect(screen.getAllByRole('cell')).toHaveLength(4)
})

it('shows a language label and copies fenced code', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  // userEvent 会替换 navigator.clipboard，这里用 fireEvent 保持对复制内容的真实断言。
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  render(<ChatMarkdown text={['```ts', 'const answer = 42', '```'].join('\n')} />)
  const code = screen.getByText('const answer = 42')
  expect(code.closest('pre')).not.toBeNull()
  expect(screen.getByText('ts')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /复制/ }))
  expect(writeText).toHaveBeenCalledWith('const answer = 42')
  expect(await screen.findByRole('button', { name: /已复制/ })).toBeInTheDocument()
})

it('strips dangerous link protocols and never renders raw HTML', () => {
  const view = render(
    <ChatMarkdown
      text={[
        '[点我](javascript:alert(1))',
        '',
        '<script>window.hacked = true</script>',
        '<img src="x" onerror="window.hacked = true">',
      ].join('\n')}
    />,
  )
  // 危险协议被清空（空 href 的 <a> 没有 link role，因此直接取元素）。
  const link = view.container.querySelector('a')
  expect(link).not.toBeNull()
  expect(link?.getAttribute('href') ?? '').not.toContain('javascript')
  expect(view.container.querySelector('script')).toBeNull()
  expect(view.container.querySelector('img')).toBeNull()
  expect((window as unknown as { hacked?: boolean }).hacked).toBeUndefined()
})

it('renders a half-streamed answer without breaking', () => {
  const view = render(
    <ChatMarkdown
      text={[
        '### 正在分析',
        '',
        '- 第一点已经确定',
        '- 第二点还在补充',
        '',
        '```ts',
        'const pending',
      ].join('\n')}
    />,
  )
  expect(screen.getByRole('heading', { name: '正在分析' })).toBeInTheDocument()
  expect(view.container.querySelectorAll('li')).toHaveLength(2)
  // 未闭合围栏按代码块渲染，而不是把后半段当正文。
  expect(view.container.querySelector('.chat-md__code')).not.toBeNull()
  expect(screen.getByText('const pending')).toBeInTheDocument()
})
