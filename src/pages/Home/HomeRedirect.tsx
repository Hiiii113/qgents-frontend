import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { useAuth } from '@/context/AuthContext'
import { useAppUiStore, useCurrentTeamId } from '@/store/appUiStore'
import { PageLoader } from '@/components/PageLoader'
import { PATHS } from '@/routes/paths'
import { Button, EmptyState, Icon } from '@/components/ui'

/** 首页直接进入最近团队，无团队时进入欢迎页。 */
export function HomeRedirect() {
  const teamId = useCurrentTeamId()
  const { hasTeam, setHasTeam } = useAuth()
  const client = useQueryClient()
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me(),
    enabled: hasTeam && !teamId,
    staleTime: 0,
  })
  useEffect(() => {
    if (teamId || !hasTeam || !me.data || me.isFetching) return
    client.setQueryData(['teams', 'mine'], me.data.teams)
    setHasTeam(me.data.teams.length > 0)
    useAppUiStore.getState().setCurrentTeam(me.data.currentTeamId)
  }, [teamId, hasTeam, me.data, me.isFetching, client, setHasTeam])
  if (teamId) return <Navigate to={PATHS.teamDetail(teamId)} replace />
  if (!hasTeam) return <Navigate to={PATHS.WELCOME} replace />
  if (me.isError)
    return (
      <main className="canvas">
        <div className="sk">
          <EmptyState
            title="首页加载失败"
            description={me.error instanceof Error ? me.error.message : undefined}
            action={
              <Button
                variant="link"
                onClick={() => void me.refetch()}
                icon={<Icon name="refresh" size={15} />}
              >
                重试
              </Button>
            }
            stacked
          />
        </div>
      </main>
    )
  return (
    <main className="canvas">
      <PageLoader />
    </main>
  )
}
