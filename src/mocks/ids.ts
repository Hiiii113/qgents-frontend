// Mock 实体主键与后端一致：无前缀十进制字符串。
let next = 1000

export function nextMockId(): string {
  return String(next++)
}
