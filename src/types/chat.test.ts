import { describe, expect, it } from 'vitest'
import { chatPreview } from './chat'

describe('chatPreview', () => {
  it('strips markdown markers so the group list shows readable text', () => {
    expect(chatPreview('**已完成**：先按 `runId` 渲染临时气泡。')).toBe(
      '已完成：先按 runId 渲染临时气泡。',
    )
  })

  it('replaces code blocks and images instead of leaking their source', () => {
    expect(chatPreview('看这里\n```ts\nconst a = 1\n```\n![截图](http://x/a.png)')).toBe(
      '看这里 代码块 图片',
    )
    expect(chatPreview('[文档](http://x/doc) 更新了')).toBe('文档 更新了')
  })

  it('keeps one line and respects the limit', () => {
    expect(chatPreview('第一行\n第二行')).toBe('第一行 第二行')
    expect(chatPreview('字'.repeat(20), 5)).toHaveLength(5)
  })
})
