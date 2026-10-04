export const chatKeys = {
  groups: (projectId: string) => ['chat', 'projects', projectId, 'groups'] as const,
  allGroups: ['chat', 'groups'] as const,
  messages: (projectId: string, groupId: string) => ['chat', 'projects', projectId, 'groups', groupId, 'messages'] as const,
  members: (projectId: string, groupId: string) => ['chat', 'projects', projectId, 'members', groupId] as const,
}
