import { http, HttpResponse } from 'msw'
import type { Skill, SkillPreview, SkillVisibility, UpdateSkillPayload } from '@/types/skill'
import type { AvailableRepository, GithubConnection, ImportedRepository } from '@/api/repositories'
import { MOCK_PROJECTS, MOCK_USER } from './state'
import { nextMockId } from './ids'

const skills: Skill[] = []
const connections: GithubConnection[] = [
  {
    id: '1',
    teamId: '1',
    providerInstallationId: 1001,
    accountLogin: 'qgents-demo',
    accountType: 'Organization',
    suspended: false,
  },
]
const available: AvailableRepository[] = [
  {
    installationId: '1',
    repositoryId: 10001,
    fullName: 'qgents-demo/web',
    defaultBranch: 'main',
    htmlUrl: 'https://github.com/qgents-demo/web',
    privateRepository: false,
  },
]
const imported = new Map<string, ImportedRepository[]>()
const notFound = () =>
  HttpResponse.json({ error: { code: 'NOT_FOUND', message: '资源不存在' } }, { status: 404 })
const skillPath = '/api/projects/:projectId/skills'
const githubPath = '/api/teams/:teamId/integrations/github'
// shortcut: Mock 只解析简单的单行 frontmatter，完整 YAML 校验以服务端为准。
function parseSkill(content: string): SkillPreview | null {
  const parts = content.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!parts || !parts[2].trim()) return null
  const name = parts[1]
    .match(/^name:\s*(.+)$/m)?.[1]
    .trim()
    .replace(/^['"]|['"]$/g, '')
  const description = parts[1]
    .match(/^description:\s*(.+)$/m)?.[1]
    .trim()
    .replace(/^['"]|['"]$/g, '')
  return name && description ? { name, description, content } : null
}
const invalidSkill = () =>
  HttpResponse.json(
    { error: { message: 'SKILL.md 格式无效，请检查名称、描述和正文' } },
    { status: 400 },
  )
async function readSkillFile(form: FormData) {
  const file = form.get('file')
  if (!(file instanceof File) || file.name !== 'SKILL.md' || file.size > 256 * 1024) return null
  return parseSkill(await file.text())
}
export const capabilityHandlers = [
  http.get(skillPath, ({ params }) =>
    HttpResponse.json({ data: skills.filter((skill) => skill.projectId === params.projectId) }),
  ),
  http.get(`${skillPath}/:skillId`, ({ params }) =>
    HttpResponse.json({ data: skills.find((skill) => skill.id === params.skillId) }),
  ),
  http.post(`${skillPath}/preview`, async ({ request }) => {
    const document = await readSkillFile(await request.formData())
    return document ? HttpResponse.json({ data: document }) : invalidSkill()
  }),
  http.post(skillPath, async ({ params, request }) => {
    const body = await request.formData()
    const document = await readSkillFile(body)
    if (!document) return invalidSkill()
    const visibility = body.get('visibility') as SkillVisibility
    const tags = JSON.parse(String(body.get('tags'))) as string[]
    const now = new Date().toISOString()
    const projectId = String(params.projectId)
    const autoPublish =
      visibility === 'PRIVATE' ||
      Object.values(MOCK_PROJECTS)
        .flat()
        .find((project) => project.id === projectId)?.role === 'PROJECT_ADMIN'
    const skill: Skill = {
      ...document,
      visibility,
      tags,
      id: nextMockId(),
      projectId,
      status: autoPublish ? 'PUBLISHED' : 'DRAFT',
      creator: MOCK_USER,
      reviewer: autoPublish ? MOCK_USER : null,
      reviewedAt: autoPublish ? now : null,
      createdAt: now,
      updatedAt: now,
    }
    skills.push(skill)
    return HttpResponse.json({ data: skill }, { status: 201 })
  }),
  http.patch(`${skillPath}/:skillId`, async ({ params, request }) => {
    const skill = skills.find((item) => item.id === params.skillId)
    if (!skill) return notFound()
    const body = (await request.json()) as UpdateSkillPayload
    const document = body.content === undefined ? null : parseSkill(body.content)
    if (body.content !== undefined && !document) return invalidSkill()
    Object.assign(skill, body, document, { updatedAt: new Date().toISOString() })
    return HttpResponse.json({ data: skill })
  }),
  ...(['submit-review', 'approve', 'reject', 'archive'] as const).map((action) =>
    http.post(`${skillPath}/:skillId/${action}`, ({ params }) => {
      const skill = skills.find((item) => item.id === params.skillId)
      if (!skill) return notFound()
      skill.status =
        action === 'submit-review'
          ? 'PENDING_REVIEW'
          : action === 'approve'
            ? 'PUBLISHED'
            : action === 'reject'
              ? 'REJECTED'
              : 'ARCHIVED'
      return HttpResponse.json({ data: skill })
    }),
  ),
  http.get(`${githubPath}/installations`, ({ params }) =>
    HttpResponse.json({ data: connections.filter((item) => item.teamId === params.teamId) }),
  ),
  http.get(`${githubPath}/repositories`, ({ params }) =>
    HttpResponse.json({
      data: available.filter((item) =>
        connections.some(
          (connection) =>
            connection.id === item.installationId && connection.teamId === params.teamId,
        ),
      ),
    }),
  ),
  http.post(`${githubPath}/installations`, () =>
    HttpResponse.json({
      data: { installationUrl: 'https://github.com/apps/qgents/installations/new' },
    }),
  ),
  http.post(`${githubPath}/installations/:installationId/sync`, () =>
    HttpResponse.json({ data: null }),
  ),
  http.delete(`${githubPath}/installations/:installationId`, ({ params }) => {
    const index = connections.findIndex((item) => item.id === params.installationId)
    if (index >= 0) connections.splice(index, 1)
    return HttpResponse.json({ data: null })
  }),
  http.get('/api/projects/:projectId/repositories', ({ params }) =>
    HttpResponse.json({ data: imported.get(String(params.projectId)) ?? [] }),
  ),
  http.post('/api/projects/:projectId/repositories', async ({ params, request }) => {
    const { installationId, repositoryId } = (await request.json()) as {
      installationId: string
      repositoryId: number
    }
    const repository = available.find(
      (item) => item.installationId === installationId && item.repositoryId === repositoryId,
    )
    if (!repository) return notFound()
    const projectId = String(params.projectId)
    const item: ImportedRepository = {
      ...repository,
      id: nextMockId(),
      projectId,
      providerRepositoryId: repositoryId,
    }
    const list = imported.get(projectId) ?? []
    list.push(item)
    imported.set(projectId, list)
    return HttpResponse.json({ data: item }, { status: 201 })
  }),
  http.delete('/api/projects/:projectId/repositories/:repositoryId', ({ params }) => {
    const projectId = String(params.projectId)
    imported.set(
      projectId,
      (imported.get(projectId) ?? []).filter((item) => item.id !== params.repositoryId),
    )
    return HttpResponse.json({ data: null })
  }),
  http.get('/api/notifications', () =>
    HttpResponse.json({ data: [], page: { hasMore: false, nextCursor: null } }),
  ),
  http.post('/api/notifications/read-all', () => HttpResponse.json({ data: null })),
  http.post('/api/notifications/:id/read', () => HttpResponse.json({ data: null })),
  http.post('/api/projects/:projectId/avatar/credential', () =>
    HttpResponse.json(
      { error: { code: 'AVATAR_STORAGE_NOT_CONFIGURED', message: '演示环境未配置头像存储' } },
      { status: 501 },
    ),
  ),
  http.post('/api/projects/:projectId/attachments', () =>
    HttpResponse.json(
      { error: { code: 'ATTACHMENT_STORAGE_NOT_CONFIGURED', message: '演示环境未配置附件存储' } },
      { status: 501 },
    ),
  ),
]
