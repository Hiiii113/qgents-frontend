export const queryKeys = {
  agents: {
    all: (teamId: string) => ['teams', teamId, 'agents'] as const,
    list: (teamId: string) => ['teams', teamId, 'agents', 'list'] as const,
  },
}
