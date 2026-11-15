import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PageLoader } from '@/components/PageLoader'
import { AppShell } from '@/layouts/AppShell/AppShell'
import { HomeRedirect } from '@/pages/Home/HomeRedirect'
import { LoginPage } from '@/pages/Auth/LoginPage'
import { RegisterPage } from '@/pages/Auth/RegisterPage'
import { PATHS } from './paths'
import { RedirectIfAuthed, RequireAuth, RequireTeam } from './guards'

const ForgotPasswordPage = lazy(() => import('@/pages/Auth/ForgotPasswordPage'))
const WelcomePage = lazy(() => import('@/pages/Welcome/WelcomePage'))
const CreateTeamPage = lazy(() => import('@/pages/Team/CreateTeamPage'))
const JoinTeamPage = lazy(() => import('@/pages/Team/JoinTeamPage'))
const TeamHomePage = lazy(() => import('@/pages/Team/TeamHomePage'))
const TeamSettingsPage = lazy(() => import('@/pages/Team/TeamSettingsPage'))
const GithubPage = lazy(() => import('@/pages/Team/GithubPage'))
const ChatWorkspace = lazy(() => import('@/pages/Project/ChatWorkspace'))
const AgentsPage = lazy(() => import('@/pages/Project/AgentsPage'))
const MemoryPage = lazy(() => import('@/pages/Project/MemoryPage'))
const SkillsPage = lazy(() => import('@/pages/Project/SkillsPage'))
const ReposPage = lazy(() => import('@/pages/Project/ReposPage'))
const ProjectSettingsPage = lazy(() => import('@/pages/Project/ProjectSettingsPage'))
const ProductSettingsPage = lazy(() => import('@/pages/Settings/ProductSettingsPage'))
const ForbiddenPage = lazy(() => import('@/pages/ForbiddenPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

/**
 * 路由：进入页（登录/注册/找回/欢迎/建团队/加团队）全屏，
 * 工作台统一由 AppShell 承载，项目与团队各自保留直达路由。
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader fullscreen />}>
        <Routes>
          <Route
            path={PATHS.LOGIN}
            element={
              <RedirectIfAuthed>
                <LoginPage />
              </RedirectIfAuthed>
            }
          />
          <Route
            path={PATHS.REGISTER}
            element={
              <RedirectIfAuthed>
                <RegisterPage />
              </RedirectIfAuthed>
            }
          />
          <Route
            path={PATHS.FORGOT_PASSWORD}
            element={<ForgotPasswordPage />}
          />

          <Route element={<RequireAuth />}>
            <Route path={PATHS.WELCOME} element={<WelcomePage />} />
            <Route path={PATHS.CREATE_TEAM} element={<CreateTeamPage />} />
            <Route path={PATHS.JOIN_TEAM} element={<JoinTeamPage />} />
            <Route path="/403" element={<ForbiddenPage />} />

            <Route path={PATHS.APP} element={<AppShell />}>
              <Route index element={<HomeRedirect />} />
              <Route path="settings" element={<ProductSettingsPage />} />
              <Route element={<RequireTeam />}>
                <Route path="teams/:teamId" element={<TeamHomePage />} />
                <Route path="teams/:teamId/settings" element={<TeamSettingsPage />} />
                <Route path="integrations/github" element={<GithubPage />} />
                <Route path="projects/:projectId">
                  <Route index element={<Navigate to="chat" replace />} />
                  <Route path="chat" element={<ChatWorkspace />} />
                  <Route path="agents" element={<AgentsPage />} />
                  <Route path="memory" element={<MemoryPage />} />
                  <Route path="skills" element={<SkillsPage />} />
                  <Route path="code" element={<ReposPage />} />
                  <Route path="settings" element={<ProjectSettingsPage />} />
                  <Route path="*" element={<Navigate to="chat" replace />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to={PATHS.LOGIN} replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
