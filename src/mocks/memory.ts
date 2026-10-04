let nextMemoryId = 20
import { http, HttpResponse } from 'msw'
import type { Memory } from '@/types'
import { MOCK_PROJECTS } from './state'
const MOCK_MEMORIES: Record<string, Memory[]> = {
  'proj-001': [
    {
      id: 'mem-1',
      projectId: 'proj-001',
      title: '密码存储约定',
      content: '密码仅存储 bcrypt 哈希，登录时使用 bcrypt.compare 校验，不得明文存储或日志输出。',
      category: 'ENGINEERING_DECISION',
      tags: ['auth', 'security'],
      status: 'APPROVED',
      creator: { id: 'user-001', displayName: '陈同学' },
      reviewer: { id: 'user-002', displayName: '张工' },
      reviewedAt: '2026-08-12T11:00:00Z',
      createdAt: '2026-08-12T10:30:00Z',
      updatedAt: '2026-08-12T11:00:00Z',
    },
    {
      id: 'mem-2',
      projectId: 'proj-001',
      title: 'API 响应统一信封',
      content: '所有接口统一返回 { data, requestId }，错误返回 { error, requestId }，前端 client.ts 已按此解包。',
      category: 'ENGINEERING_DECISION',
      tags: ['api', 'convention'],
      status: 'APPROVED',
      creator: { id: 'user-001', displayName: '陈同学' },
      reviewer: { id: 'user-002', displayName: '张工' },
      reviewedAt: '2026-08-11T15:00:00Z',
      createdAt: '2026-08-11T14:00:00Z',
      updatedAt: '2026-08-11T15:00:00Z',
    },
    {
      id: 'mem-3',
      projectId: 'proj-001',
      title: '支付回调幂等处理',
      content: '支付回调需带 Idempotency-Key，重复通知返回首次结果，避免重复入账。',
      category: 'ENGINEERING_DECISION',
      tags: ['pay', 'idempotency'],
      status: 'PENDING_REVIEW',
      creator: { id: 'user-002', displayName: '张工' },
      reviewer: null,
      reviewedAt: null,
      createdAt: '2026-08-13T00:30:00Z',
      updatedAt: '2026-08-13T00:30:00Z',
    },
    {
      id: 'mem-4',
      projectId: 'proj-001',
      title: '登录错误码约定',
      content: '登录失败统一返回 401 + INVALID_CREDENTIALS，不区分"用户不存在"和"密码错误"以免泄露账号信息。',
      category: 'ENGINEERING_DECISION',
      tags: ['auth'],
      status: 'DRAFT',
      creator: { id: 'user-001', displayName: '陈同学' },
      reviewer: null,
      reviewedAt: null,
      createdAt: '2026-08-13T01:00:00Z',
      updatedAt: '2026-08-13T01:00:00Z',
    },
    {
      id: 'mem-5',
      projectId: 'proj-001',
      title: '旧版 token 存储方案',
      content: '早期曾讨论将 token 存 cookie，后废弃改用 localStorage + Bearer 头。',
      category: 'DEPRECATED',
      tags: ['auth'],
      status: 'REJECTED',
      creator: { id: 'user-003', displayName: '李设计' },
      reviewer: { id: 'user-002', displayName: '张工' },
      reviewedAt: '2026-08-10T10:00:00Z',
      createdAt: '2026-08-10T09:00:00Z',
      updatedAt: '2026-08-10T10:00:00Z',
    },
    {
      id: 'mem-6',
      projectId: 'proj-001',
      title: '初版部署流程',
      content: '旧版手工部署流程，已被自动化 CI 取代，归档留存。',
      category: 'PROCESS',
      tags: ['deploy'],
      status: 'ARCHIVED',
      creator: { id: 'user-001', displayName: '陈同学' },
      reviewer: { id: 'user-002', displayName: '张工' },
      reviewedAt: '2026-07-20T12:00:00Z',
      createdAt: '2026-07-20T11:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    },
  ],
}

// ══════════════════════════════════════════════
// GitHub 集成 Mock 数据
// ══════════════════════════════════════════════

export const memoryHandlers = [
  http.get('/api/projects/:projectId/memories', ({ params }) => {
    const list = MOCK_MEMORIES[params.projectId as string] ?? []
    // 文档：默认仅返回 APPROVED；此处返回全量供前端按状态筛选演示
    return HttpResponse.json({ data: list })
  }),

  http.post('/api/projects/:projectId/memories', async ({ params, request }) => {
    const projectId = params.projectId as string
    const body = (await request.json()) as {
      title?: string
      content?: string
      category?: string
      tags?: string[]
    }
    const memory: Memory = {
      id: 'mem-' + nextMemoryId++,
      projectId,
      title: body.title || '未命名 Memory',
      content: body.content || '',
      category: body.category || 'GENERAL',
      tags: body.tags ?? [],
      status: Object.values(MOCK_PROJECTS).flat().find(project => project.id === projectId)?.role === 'PROJECT_ADMIN' ? 'APPROVED' : 'DRAFT',
      creator: { id: 'user-001', displayName: '陈同学' },
      reviewer: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
      ; (MOCK_MEMORIES[projectId] ??= []).push(memory)
    return HttpResponse.json({ data: memory }, { status: 201 })
  }),

  http.patch('/api/projects/:projectId/memories/:memoryId', async ({ params, request }) => {
    const list = MOCK_MEMORIES[params.projectId as string] ?? []
    const memory = list.find((m) => m.id === params.memoryId)
    if (!memory) {
      return HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Memory 不存在' } }, { status: 404 })
    }
    const body = (await request.json()) as Partial<Memory>
    Object.assign(memory, body, { updatedAt: new Date().toISOString() })
    return HttpResponse.json({ data: memory })
  }),

  http.post('/api/projects/:projectId/memories/:memoryId/submit-review', ({ params }) => {
    const memory = (MOCK_MEMORIES[params.projectId as string] ?? []).find(
      (m) => m.id === params.memoryId,
    )
    if (memory) {
      memory.status = 'PENDING_REVIEW'
      memory.updatedAt = new Date().toISOString()
    }
    return HttpResponse.json({ data: memory })
  }),

  http.post('/api/projects/:projectId/memories/:memoryId/approve', ({ params }) => {
    const memory = (MOCK_MEMORIES[params.projectId as string] ?? []).find(
      (m) => m.id === params.memoryId,
    )
    if (memory) {
      memory.status = 'APPROVED'
      memory.reviewer = { id: 'user-002', displayName: '张工' }
      memory.reviewedAt = new Date().toISOString()
      memory.updatedAt = new Date().toISOString()
    }
    return HttpResponse.json({ data: memory })
  }),

  http.post('/api/projects/:projectId/memories/:memoryId/reject', async ({ params, request }) => {
    const memory = (MOCK_MEMORIES[params.projectId as string] ?? []).find(
      (m) => m.id === params.memoryId,
    )
    if (memory) {
      memory.status = 'REJECTED'
      memory.reviewer = { id: 'user-002', displayName: '张工' }
      memory.reviewedAt = new Date().toISOString()
      memory.updatedAt = new Date().toISOString()
      await request.json().catch(() => ({}))
    }
    return HttpResponse.json({ data: memory })
  }),

  http.post('/api/projects/:projectId/memories/:memoryId/archive', ({ params }) => {
    const memory = (MOCK_MEMORIES[params.projectId as string] ?? []).find(
      (m) => m.id === params.memoryId,
    )
    if (memory) {
      memory.status = 'ARCHIVED'
      memory.updatedAt = new Date().toISOString()
    }
    return HttpResponse.json({ data: memory })
  }),
]
