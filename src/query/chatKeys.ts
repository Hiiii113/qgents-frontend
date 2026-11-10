export const chatKeys = {
  groups: (projectId: string) => ['chat', 'projects', projectId, 'groups'] as const,
  messages: (projectId: string, groupId: string) => ['chat', 'projects', projectId, 'groups', groupId, 'messages'] as const,
  members: (projectId: string, groupId: string) => ['chat', 'projects', projectId, 'members', groupId] as const,
  // 建群只列出本项目已启用的 Agent，与项目设置共用同一份缓存。
  agents: (projectId: string) => ['projects', projectId, 'agents'] as const,
}
