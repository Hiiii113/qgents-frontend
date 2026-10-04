import { useQuery } from '@tanstack/react-query'
import { agentApi } from '@/api/agent'
import { queryKeys } from '@/query/queryKeys'
export function useAgents(teamId?: string) {
  return useQuery({ queryKey: queryKeys.agents.list(teamId ?? ''), queryFn: () => agentApi.list(teamId ?? ''), enabled: Boolean(teamId) })
}
