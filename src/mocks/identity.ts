import { http, HttpResponse } from 'msw'
import {
  MOCK_USER,
  MOCK_TEAMS,
  MOCK_TEAM_MEMBERS,
  MOCK_PROJECTS,
  MOCK_MY_INVITATIONS,
} from './state'
import { nextMockId } from './ids'
const registerCodeByEmail = new Map<string, string>()
let nextTeamId = 10
let currentTeamId: string | null = MOCK_TEAMS[0]?.id ?? null
export const identityHandlers = [
  http.get('/api/health', () => HttpResponse.json({ status: 'ok', source: 'msw' })),

  // ── Auth ──
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string }
    if (!body.email?.includes('@')) {
      return HttpResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误' } },
        { status: 401 },
      )
    }
    return HttpResponse.json({
      data: {
        accessToken: 'mock-access-token-' + Date.now(),
        accessTokenExpiresIn: 900,
        refreshToken: 'mock-refresh-token-' + Date.now(),
        refreshTokenExpiresIn: 2592000,
        user: { ...MOCK_USER, email: body.email },
      },
    })
  }),

  // ── 注册邮箱验证码（先发验证码、再带码注册）──
  http.post('/api/auth/register/verification-codes', async ({ request }) => {
    const body = (await request.json()) as { email?: string }
    if (!body.email?.includes('@')) {
      return HttpResponse.json(
        { error: { code: 'INVALID_INPUT', message: '邮箱格式不正确' } },
        { status: 400 },
      )
    }
    // 演示固定码，方便 mock 模式下直接注册；真实环境码由邮件送达
    registerCodeByEmail.set(body.email, '483920')
    return HttpResponse.json(
      { data: { message: '验证码已发送到邮箱，10 分钟内有效' }, requestId: 'mock-register-code' },
      { status: 202 },
    )
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as {
      email?: string
      displayName?: string
      verificationCode?: string
    }
    if (!body.email?.includes('@')) {
      return HttpResponse.json(
        { error: { code: 'INVALID_INPUT', message: '邮箱格式不正确' } },
        { status: 400 },
      )
    }
    // ：verificationCode 必填、长度固定 6 位数字
    const code = body.verificationCode?.trim() ?? ''
    if (!/^\d{6}$/.test(code)) {
      return HttpResponse.json(
        { error: { code: 'INVALID_VERIFICATION_CODE', message: '验证码无效或已过期' } },
        { status: 422 },
      )
    }
    if (registerCodeByEmail.get(body.email) !== code) {
      return HttpResponse.json(
        { error: { code: 'INVALID_VERIFICATION_CODE', message: '验证码无效或已过期' } },
        { status: 422 },
      )
    }
    // 验证码一次性：校验通过后消费掉，重试需重新获取
    registerCodeByEmail.delete(body.email)
    return HttpResponse.json({
      data: {
        accessToken: 'mock-access-token-' + Date.now(),
        accessTokenExpiresIn: 900,
        refreshToken: 'mock-refresh-token-' + Date.now(),
        refreshTokenExpiresIn: 2592000,
        user: {
          id: String(Date.now()),
          email: body.email!,
          displayName: body.displayName || body.email!.split('@')[0],
          avatarChar: (body.displayName || '用')[0],
        },
      },
    })
  }),

  http.post('/api/auth/refresh', async ({ request }) => {
    const body = (await request.json()) as { refreshToken?: string }
    if (!body.refreshToken) {
      return HttpResponse.json(
        { error: { code: 'INVALID_REFRESH_TOKEN', message: '刷新令牌无效' } },
        { status: 401 },
      )
    }
    return HttpResponse.json({
      data: {
        accessToken: 'mock-access-token-' + Date.now(),
        accessTokenExpiresIn: 900,
        refreshToken: 'mock-refresh-token-' + Date.now(),
        refreshTokenExpiresIn: 2592000,
      },
    })
  }),

  // ── 忘记密码（发起找回密码邮件 / 用重置令牌设置新密码）──
  http.post('/api/auth/password-reset-requests', async ({ request }) => {
    const body = (await request.json()) as { email?: string }
    if (!body.email?.includes('@')) {
      return HttpResponse.json(
        { error: { code: 'INVALID_INPUT', message: '邮箱格式不正确' } },
        { status: 400 },
      )
    }
    // 模拟邮件已发送（演示环境无真实邮件网关；重置令牌即「验证码」）
    return HttpResponse.json({ data: { sent: true, expiresIn: 1800 } })
  }),

  http.post('/api/auth/password-resets', async ({ request }) => {
    const body = (await request.json()) as { email?: string; token?: string; newPassword?: string }
    // 与注册一致：邮箱 + 6 位数字验证码，校验失败返回 422
    if (
      !body.email?.includes('@') ||
      !/^\d{6}$/.test(body.token?.trim() ?? '') ||
      !body.newPassword
    ) {
      return HttpResponse.json(
        { error: { code: 'INVALID_VERIFICATION_CODE', message: '验证码无效或已过期' } },
        { status: 422 },
      )
    }
    return HttpResponse.json({ data: { reset: true } })
  }),

  http.get('/api/me', () =>
    HttpResponse.json({
      data: {
        user: MOCK_USER,
        teams: MOCK_TEAMS,
        currentTeamId: MOCK_TEAMS.some((team) => team.id === currentTeamId)
          ? currentTeamId
          : (MOCK_TEAMS[0]?.id ?? null),
        projects: Object.values(MOCK_PROJECTS)
          .flat()
          .map((p) => ({ id: p.id, teamId: p.teamId, name: p.name, role: p.role })),
      },
    }),
  ),

  http.put('/api/me/current-team', async ({ request }) => {
    const body = (await request.json()) as { teamId: string }
    if (!MOCK_TEAMS.some((team) => team.id === body.teamId)) {
      return HttpResponse.json(
        { error: { code: 'TEAM_ACCESS_DENIED', message: '暂无团队访问权限' } },
        { status: 403 },
      )
    }
    currentTeamId = body.teamId
    return HttpResponse.json({ data: {} })
  }),

  http.patch('/api/me', async ({ request }) => {
    const body = (await request.json()) as { displayName?: string; avatarUrl?: string }
    if (typeof body.displayName === 'string' && body.displayName.trim()) {
      MOCK_USER.displayName = body.displayName.trim()
      MOCK_USER.avatarChar = MOCK_USER.displayName.slice(0, 1)
    }
    if (typeof body.avatarUrl === 'string' && body.avatarUrl.trim()) {
      MOCK_USER.avatarUrl = body.avatarUrl.trim()
    }
    return HttpResponse.json({ data: { ...MOCK_USER } })
  }),

  // 签发头像直传凭证（模拟 OSS，uploadUrl 指向本机路径供 MSW 拦截 PUT）
  http.post('/api/me/avatar/credential', async ({ request }) => {
    const body = (await request.json()) as { mediaType?: string; sizeBytes?: number }
    const mediaType = body.mediaType ?? ''
    if (!mediaType.startsWith('image/')) {
      return HttpResponse.json(
        { error: { code: 'INVALID_MEDIA_TYPE', message: '仅支持图片格式' } },
        { status: 400 },
      )
    }
    if (
      typeof body.sizeBytes !== 'number' ||
      body.sizeBytes <= 0 ||
      body.sizeBytes > 5 * 1024 * 1024
    ) {
      return HttpResponse.json(
        { error: { code: 'AVATAR_SIZE_EXCEEDED', message: '头像大小需 ≤ 5MB' } },
        { status: 400 },
      )
    }
    const ext = mediaType.split('/')[1] ?? 'png'
    const objectKey = `avatars/${MOCK_USER.id}/mock-${Date.now()}.${ext}`
    return HttpResponse.json({
      data: {
        objectKey,
        uploadUrl: `/api/mock-avatar-upload/${objectKey}`,
        method: 'PUT',
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
        headers: {},
      },
    })
  }),

  // 直传落盘（MSW 拦截预签名 PUT，模拟 OSS 接收文件字节）
  http.put('/api/mock-avatar-upload/:objectKey', () => HttpResponse.json(null, { status: 200 })),

  // 确认头像上传，写入 users.avatar_url 并返回公共读 URL
  http.post('/api/me/avatar/confirm', async ({ request }) => {
    const body = (await request.json()) as { objectKey?: string }
    const objectKey = body.objectKey ?? ''
    if (!objectKey.startsWith(`avatars/${MOCK_USER.id}/`)) {
      return HttpResponse.json(
        { error: { code: 'AVATAR_OBJECT_FORBIDDEN', message: '头像对象不属于当前用户' } },
        { status: 403 },
      )
    }
    const avatarUrl = `https://mock-cdn.example.com/${objectKey}`
    MOCK_USER.avatarUrl = avatarUrl
    return HttpResponse.json({ data: { avatarUrl } })
  }),

  // ── 团队头像：credential → PUT → confirm，与用户头像同构 ──
  http.post('/api/teams/:teamId/avatar/credential', async ({ request }) => {
    const team = MOCK_TEAMS.find((t) => t.id === request.url.split('/teams/')[1]?.split('/')[0])
    if (!team)
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: '团队不存在' } },
        { status: 404 },
      )
    const body = (await request.json()) as { mediaType?: string; sizeBytes?: number }
    const mediaType = body.mediaType ?? ''
    if (!mediaType.startsWith('image/')) {
      return HttpResponse.json(
        { error: { code: 'INVALID_MEDIA_TYPE', message: '仅支持图片格式' } },
        { status: 400 },
      )
    }
    const ext = mediaType.split('/')[1] ?? 'png'
    const objectKey = `teams/${team.id}/mock-${Date.now()}.${ext}`
    return HttpResponse.json({
      data: {
        objectKey,
        uploadUrl: `/api/mock-team-avatar-upload/${objectKey}`,
        method: 'PUT',
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
        headers: {},
      },
    })
  }),

  // 直传落盘（模拟 OSS 接收团队头像字节）
  http.put('/api/mock-team-avatar-upload/:objectKey', () =>
    HttpResponse.json(null, { status: 200 }),
  ),

  // 确认团队头像上传，写入 teams.avatar_url 并返回公共读 URL
  http.post('/api/teams/:teamId/avatar/confirm', async ({ request }) => {
    const teamId = request.url.split('/teams/')[1]?.split('/')[0]
    const team = MOCK_TEAMS.find((t) => t.id === teamId)
    if (!team)
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: '团队不存在' } },
        { status: 404 },
      )
    const body = (await request.json()) as { objectKey?: string }
    const objectKey = body.objectKey ?? ''
    // ：对象键前缀必须匹配 teams/{teamId}/，否则 403
    if (!objectKey.startsWith(`teams/${teamId}/`)) {
      return HttpResponse.json(
        { error: { code: 'AVATAR_OBJECT_KEY_FORBIDDEN', message: '头像对象前缀不匹配' } },
        { status: 403 },
      )
    }
    const avatarUrl = `https://mock-cdn.example.com/${objectKey}`
    team.avatarUrl = avatarUrl
    return HttpResponse.json({ data: { avatarUrl } })
  }),

  http.post('/api/auth/logout', () => HttpResponse.json({ data: null })),

  // ── Teams ──
  http.get('/api/teams', () => HttpResponse.json({ data: MOCK_TEAMS })),

  http.post('/api/teams', async ({ request }) => {
    const body = (await request.json()) as { name?: string; description?: string }
    const newTeam = {
      id: String(nextTeamId++),
      name: body.name || '未命名团队',
      description: body.description || '',
      createdAt: new Date().toISOString(),
      role: 'TEAM_OWNER' as const,
      memberCount: 1,
    }
    MOCK_TEAMS.push(newTeam)
    MOCK_PROJECTS[newTeam.id] = []
    return HttpResponse.json({ data: newTeam }, { status: 201 })
  }),

  http.get('/api/teams/:teamId', ({ params }) => {
    const team = MOCK_TEAMS.find((t) => t.id === params.teamId)
    if (!team)
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: '团队不存在' } },
        { status: 404 },
      )
    return HttpResponse.json({ data: team })
  }),

  http.patch('/api/teams/:teamId', async ({ params, request }) => {
    const body = (await request.json()) as {
      name?: string
      description?: string
      avatarUrl?: string
    }
    const team = MOCK_TEAMS.find((t) => t.id === params.teamId)
    if (!team)
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: '团队不存在' } },
        { status: 404 },
      )
    // ：avatarUrl 空串清空，null 保留原值
    if (body.avatarUrl === '') {
      delete body.avatarUrl
      team.avatarUrl = undefined
    }
    Object.assign(team, body)
    return HttpResponse.json({ data: team })
  }),

  http.get('/api/teams/:teamId/members', ({ params }) => {
    const members =
      Number(params.teamId) >= 10
        ? MOCK_TEAM_MEMBERS.filter((member) => member.userId === MOCK_USER.id)
        : params.teamId === '2'
          ? MOCK_TEAM_MEMBERS.map((m) =>
              m.userId === '1' ? { ...m, role: 'TEAM_MEMBER' as const } : m,
            )
          : MOCK_TEAM_MEMBERS
    return HttpResponse.json({ data: members })
  }),

  http.patch('/api/teams/:teamId/members/:userId', async ({ params, request }) => {
    const member = MOCK_TEAM_MEMBERS.find((item) => item.userId === params.userId)
    if (!member)
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: '成员不存在' } },
        { status: 404 },
      )
    const { role } = (await request.json()) as { role: 'TEAM_ADMIN' | 'TEAM_MEMBER' }
    member.role = role
    return HttpResponse.json({ data: member })
  }),

  http.delete('/api/teams/:teamId/members/:userId', ({ params }) => {
    const index = MOCK_TEAM_MEMBERS.findIndex((item) => item.userId === params.userId)
    if (index >= 0) MOCK_TEAM_MEMBERS.splice(index, 1)
    return HttpResponse.json({ data: null })
  }),

  http.post('/api/teams/:teamId/invitations', async ({ request }) => {
    const body = (await request.json()) as { email?: string; role?: string }
    return HttpResponse.json(
      {
        data: {
          id: nextMockId(),
          email: body.email || '',
          role: body.role || 'TEAM_MEMBER',
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        },
      },
      { status: 201 },
    )
  }),

  http.get('/api/teams/:teamId/invitations', () => HttpResponse.json({ data: [] })),

  // GET /team-invitations —— 当前用户收到的待处理邀请（收件人视角，分页包装）
  http.get('/api/team-invitations', () =>
    HttpResponse.json({ data: MOCK_MY_INVITATIONS, page: { nextCursor: null, hasMore: false } }),
  ),

  http.post('/api/team-invitations/:reference/accept', () =>
    HttpResponse.json({
      data: {
        userId: '1',
        displayName: '陈同学',
        role: 'TEAM_MEMBER',
        joinedAt: '2026-08-15T10:00:00Z',
      },
    }),
  ),
]
