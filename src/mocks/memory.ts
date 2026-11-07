import { http, HttpResponse } from 'msw'
import type { ProjectMemory } from '@/types'

/** 每个项目的 memory.md 正文；version 用递增修订号模拟内容版本。 */
const documents = new Map<string, { content: string; revision: number; updatedAt: string }>()

const SEED = `# 项目约定

## 工程决策

- 密码仅存储 bcrypt 哈希，登录时使用 bcrypt.compare 校验，不得明文存储或日志输出。
- 所有接口统一返回 { data, requestId }，错误返回 { error, requestId }。
- 登录失败统一返回 401 + INVALID_CREDENTIALS，不区分「用户不存在」和「密码错误」。
`

function document(projectId: string) {
  let doc = documents.get(projectId)
  if (!doc) {
    doc = { content: projectId === '2' ? SEED : '', revision: 1, updatedAt: new Date().toISOString() }
    documents.set(projectId, doc)
  }
  return doc
}

function response(projectId: string, doc: { content: string; revision: number; updatedAt: string }): ProjectMemory {
  return { projectId, content: doc.content, version: String(doc.revision), updatedAt: doc.updatedAt }
}

export const memoryHandlers = [
  http.get('/api/projects/:projectId/memory', ({ params }) => {
    const projectId = params.projectId as string
    return HttpResponse.json({ data: response(projectId, document(projectId)) })
  }),

  http.put('/api/projects/:projectId/memory', async ({ params, request }) => {
    const projectId = params.projectId as string
    const body = (await request.json()) as { content: string; version: string }
    const current = document(projectId)
    if (body.version !== String(current.revision)) {
      return HttpResponse.json(
        { error: { code: 'MEMORY_VERSION_CONFLICT', message: '项目记忆已被修改，请重新读取后再保存' } },
        { status: 409 },
      )
    }
    current.content = body.content
    current.revision += 1
    current.updatedAt = new Date().toISOString()
    return HttpResponse.json({ data: response(projectId, current) })
  }),
]
