// 详情略过元数据；上传和编辑仍保留完整 SKILL.md。
export function stripFrontmatter(content: string): string {
  const text = content.replace(/^\uFEFF/, '')
  const match = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(text)
  return match ? text.slice(match[0].length) : text
}
