export const PATHS = {
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  WELCOME: '/welcome',
  APP: '/app',
  SETTINGS: '/app/settings',
  CREATE_TEAM: '/app/teams/create',
  JOIN_TEAM: '/app/teams/join',
  teamDetail: (teamId: string) => `/app/teams/${encodeURIComponent(teamId)}`,
  teamSettings: (teamId: string) => `/app/teams/${encodeURIComponent(teamId)}/settings`,
  projectDetail: (projectId: string) => `/app/projects/${encodeURIComponent(projectId)}`,
  projectChat: (projectId: string, messageId?: string, groupId?: string) => {
    const params = new URLSearchParams()
    if (messageId) params.set('messageId', messageId)
    if (groupId) params.set('groupId', groupId)
    return `/app/projects/${encodeURIComponent(projectId)}/chat${params.size ? '?' + params : ''}`
  },
  projectAgents: (id: string) => `/app/projects/${encodeURIComponent(id)}/agents`,
  projectSkills: (id: string) => `/app/projects/${encodeURIComponent(id)}/skills`,
  projectMemory: (id: string) => `/app/projects/${encodeURIComponent(id)}/memory`,
  projectCode: (id: string) => `/app/projects/${encodeURIComponent(id)}/code`,
  projectSettings: (id: string) => `/app/projects/${encodeURIComponent(id)}/settings`,
  GITHUB_INTEGRATION: '/app/integrations/github',
  githubIntegration: (teamId: string) =>
    `/app/integrations/github?teamId=${encodeURIComponent(teamId)}`,
} as const
