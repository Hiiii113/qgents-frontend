import { describe, expect, it } from 'vitest'
import { stripFrontmatter } from './frontmatter'

describe('stripFrontmatter', () => {
  it('removes a closed YAML frontmatter block', () => {
    const content = '---\nname: 前端助手\ndescription: 负责实现\n---\n# 用法\n\n正文'
    expect(stripFrontmatter(content)).toBe('# 用法\n\n正文')
  })

  it('keeps an unclosed frontmatter untouched', () => {
    const content = '---\nname: 前端助手\n\n正文'
    expect(stripFrontmatter(content)).toBe(content)
  })

  it('handles a BOM and CRLF fences', () => {
    const content = '\uFEFF---\r\nname: 助手\r\n---\r\n正文\r\n---\r\n结尾'
    expect(stripFrontmatter(content)).toBe('正文\r\n---\r\n结尾')
  })

  it('keeps later horizontal rules in the body', () => {
    const content = '---\nname: 助手\n---\n\n正文\n\n---\n\n结尾'
    expect(stripFrontmatter(content)).toBe('\n正文\n\n---\n\n结尾')
  })

  it('leaves content without frontmatter unchanged', () => {
    expect(stripFrontmatter('# 正文\n\n---\n\n结尾')).toBe('# 正文\n\n---\n\n结尾')
  })
})
