import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectApi, teamApi } from '@/api'
import { useCurrentTeamId } from '@/store/appUiStore'
import { useRememberTeam } from '@/hooks/useRememberTeam'
import { useRealtimeEvents } from '@/realtime/useRealtimeEvents'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageLoader } from '@/components/PageLoader'
import { AppBar } from './AppBar'
import { Rail } from './Rail'
import { GithubBanner } from './GithubBanner'
import { Outlet, useLocation } from 'react-router-dom'
import { Suspense } from 'react'
import './shell.css'

/**
 * 应用外壳：左侧竖轨承担项目/团队业务导航，顶栏只放项目切换、搜索与通知。
 * 团队切换、建团队、加团队在产品设置里；项目切换不带上一个项目的群定位。
 */
export function AppShell() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const storeTeamId = useCurrentTeamId()
  const projectId = /^\/app\/projects\/([^/]+)/.exec(pathname)?.[1] ?? null
  const routeTeamId = /^\/app\/teams\/([^/]+)/.exec(pathname)?.[1] ?? null
  const isSettings = pathname.startsWith('/app/settings')
  const [meOpen, setMeOpen] = useState(false)

  useRealtimeEvents()

  const project = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId ?? ''),
    enabled: Boolean(projectId),
  })
  const teamId =
    project.data?.teamId ?? routeTeamId ?? params.get('teamId') ?? storeTeamId ?? null
  const team = useQuery({
    queryKey: ['teams', teamId],
    queryFn: () => teamApi.getById(teamId ?? ''),
    enabled: Boolean(teamId),
  })
  const projects = useQuery({
    queryKey: ['teams', teamId, 'projects'],
    queryFn: () => projectApi.listByTeam(teamId ?? ''),
    enabled: Boolean(teamId),
  })
  useRememberTeam(teamId ?? undefined)

  const mode = projectId ? 'project' : isSettings ? 'settings' : 'team'

  return (
    <div className="shell">
      <Rail
        mode={mode}
        teamId={teamId}
        projectId={projectId}
        onOpenMe={() => setMeOpen((open) => !open)}
        meOpen={meOpen}
        onCloseMe={() => setMeOpen(false)}
      />

      <section className="workspace">
        <AppBar
          mode={mode}
          team={team.data}
          projects={projects.data}
          projectsPending={projects.isPending}
          project={project.data}
          projectId={projectId}
          chatEnabled={Boolean(projectId)}
        />
        {teamId ? (
          <GithubBanner key={teamId} teamId={teamId} />
        ) : null}
        <ErrorBoundary resetKey={pathname}>
          <Suspense
            fallback={
              <div className="canvas-status">
                <PageLoader />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </section>
    </div>
  )
}
