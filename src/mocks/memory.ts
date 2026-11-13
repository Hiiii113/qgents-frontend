import { http, HttpResponse } from 'msw'
import type { ProjectMemory } from '@/types'

/** 每个项目的 memory.md 正文；后端只提供读取接口，写入由聊天中的 Qgent 完成。 */
const documents = new Map<string, { content: string; updatedAt: string }>()

const SEED = `# 项目约定

## 工程决策

- 密码仅存储 bcrypt 哈希，登录时使用 bcrypt.compare 校验，不得明文存储或日志输出。
- 所有接口统一返回 { data, requestId }，错误返回 { error, requestId }。
- 登录失败统一返回 401 + INVALID_CREDENTIALS，不区分「用户不存在」和「密码错误」。
`

function document(projectId: string): ProjectMemory {
  let doc = documents.get(projectId)
  if (!doc) {
    doc = {
      content: projectId === '2' ? SEED : '',
      updatedAt: new Date().toISOString(),
    }
    documents.set(projectId, doc)
  }
  // 未写入过内容时与后端一致：updatedAt 为空。
  return {
    projectId,
    content: doc.content,
    updatedAt: doc.content ? doc.updatedAt : null,
  }
}

export const memoryHandlers = [
  http.get('/api/projects/:projectId/memory', ({ params }) => {
    const projectId = params.projectId as string
    return HttpResponse.json({ data: document(projectId) })
  }),
]
