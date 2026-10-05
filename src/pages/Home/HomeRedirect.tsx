import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button } from 'antd'
import { authApi } from '@/api/auth'
import { useAuth } from '@/context/AuthContext'
import { useAppUiStore, useCurrentTeamId } from '@/store/appUiStore'
import { PageLoader } from '@/components/PageLoader'
import { PATHS } from '@/routes/paths'

/** 首页直接进入当前团队的项目，无团队时提供创建或加入入口。 */
export function HomeRedirect() {
  const teamId = useCurrentTeamId()
  const { hasTeam, setHasTeam } = useAuth()
  const client = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: () => authApi.me(), enabled: hasTeam && !teamId, staleTime: 0 })
  useEffect(() => {
    if (teamId || !hasTeam || !me.data || me.isFetching) return
    client.setQueryData(['teams', 'mine'], me.data.teams)
    setHasTeam(me.data.teams.length > 0)
    useAppUiStore.getState().setCurrentTeam(me.data.currentTeamId)
  }, [teamId, hasTeam, me.data, me.isFetching, client, setHasTeam])
  if (teamId) return <Navigate to={PATHS.teamDetail(teamId)} replace />
  if (!hasTeam) return <Navigate to={PATHS.WELCOME} replace />
  if (me.isError) return <Alert type="error" title="首页加载失败" action={<Button onClick={() => void me.refetch()}>重试</Button>} />
  return <PageLoader />
}
