import type { MyTeamInvitation, Project, Team, TeamRole } from '@/types'
import { MOCK_CURRENT_USER } from './currentUser'
export const MOCK_USER: { id: string; email: string; displayName: string; avatarChar: string; avatarUrl?: string } = {
  ...MOCK_CURRENT_USER,
}

export const MOCK_TEAMS: Team[] = [
  {
    id: '1',
    name: '星河工作室',
    description: '全栈开发团队，专注内部工具与开源项目',
    createdAt: '2026-06-01T08:00:00Z',
    role: 'TEAM_OWNER' as const,
    memberCount: 5,
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=星河工作室',
  },
  {
    id: '2',
    name: '广工创新团队',
    description: '校园技术团队，AI 与 Web 方向',
    createdAt: '2026-05-15T08:00:00Z',
    role: 'TEAM_MEMBER' as const,
    memberCount: 8,
  },
]

type MockTeamMember = { userId: string; displayName: string; email: string; role: TeamRole; avatarUrl?: string }

export const MOCK_TEAM_MEMBERS: MockTeamMember[] = [
  { userId: '1', displayName: '陈同学', email: 'demo@qgents.dev', role: 'TEAM_OWNER' as const, avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=陈同学' },
  { userId: '2', displayName: '张工', email: 'zhang@example.com', role: 'TEAM_ADMIN' as const, avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=张工' },
  { userId: '3', displayName: '李设计', email: 'li@example.com', role: 'TEAM_MEMBER' as const, avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=李设计' },
  { userId: '4', displayName: '王测试', email: 'wang@example.com', role: 'TEAM_MEMBER' as const, avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=王测试' },
  { userId: '5', displayName: '赵架构', email: 'zhao@example.com', role: 'TEAM_MEMBER' as const, avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=赵架构' },
]

export const MOCK_PROJECTS: Record<string, Project[]> = {
  '1': [
    { id: '1', teamId: '1', name: 'Demo Project', description: 'Demo project for Mock acceptance', createdAt: '2026-08-13T00:00:00Z', role: 'PROJECT_ADMIN', repositoryCount: 1, memberCount: 2, status: 'ACTIVE' },
    { id: '2', teamId: '1', name: 'Qgents', description: '团队成员与 Qgent 云端协作开发平台', createdAt: '2026-07-01T08:00:00Z', role: 'PROJECT_ADMIN', repositoryCount: 3, memberCount: 5, status: 'ACTIVE' },
    { id: '3', teamId: '1', name: '宠影记', description: '宠物健康管理小程序', createdAt: '2026-07-15T08:00:00Z', role: 'PROJECT_ADMIN', repositoryCount: 1, memberCount: 4, status: 'ACTIVE' },
  ],
  '2': [
    { id: '4', teamId: '2', name: 'AI 决策系统', description: '校园选课推荐与学业规划', createdAt: '2026-06-10T08:00:00Z', role: 'PROJECT_MEMBER', repositoryCount: 2, memberCount: 6, status: 'ACTIVE' },
    { id: '5', teamId: '2', name: '校园助手', description: '课表、成绩、图书馆一站式查询', createdAt: '2026-08-01T08:00:00Z', role: 'PROJECT_MEMBER', repositoryCount: 1, memberCount: 3, status: 'ARCHIVED' },
  ],
}




// 当前用户收到的待处理团队邀请（演示用样例，对齐后端1对接文档：无 token）
export const MOCK_MY_INVITATIONS: MyTeamInvitation[] = [
  {
    id: '1',
    teamId: '2',
    teamName: '广工创新团队',
    role: 'TEAM_MEMBER',
    inviterDisplayName: '陈同学',
    status: 'PENDING',
    expiresAt: '2026-08-21T00:00:00Z',
    createdAt: '2026-08-14T10:00:00Z',
  },
]

// ══════════════════════════════════════════════
// 群聊（Group / Message）Mock 数据 —— 当前接口
// ══════════════════════════════════════════════

interface MockProjectMember {
  userId: string
  displayName: string
  email: string
  role: 'PROJECT_ADMIN' | 'PROJECT_MEMBER'
  avatarUrl?: string
}

// 项目成员（按项目隔离，作为群 USER 成员来源；同时供 GET /projects/:id/members 复用）
export const MOCK_PROJECT_MEMBERS: Record<string, MockProjectMember[]> = {
  '2': [
    { userId: '1', displayName: '陈同学', email: 'demo@qgents.dev', role: 'PROJECT_ADMIN', avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=陈同学' },
    { userId: '2', displayName: '张工', email: 'zhang@example.com', role: 'PROJECT_MEMBER', avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=张工' },
    { userId: '3', displayName: '李设计', email: 'li@example.com', role: 'PROJECT_MEMBER', avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=李设计' },
  ],
}

// 未单独配置成员的项目按团队前 3 名成员补齐，并同步项目成员数。
for (const project of Object.values(MOCK_PROJECTS).flat()) {
  MOCK_PROJECT_MEMBERS[project.id] ??= MOCK_TEAM_MEMBERS.slice(0, 3).map(member => ({ ...member, role: member.userId === MOCK_USER.id ? project.role ?? 'PROJECT_MEMBER' : 'PROJECT_MEMBER' }))
  project.memberCount = MOCK_PROJECT_MEMBERS[project.id].length
}
