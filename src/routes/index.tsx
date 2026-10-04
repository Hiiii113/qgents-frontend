import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PageLoader } from '@/components/PageLoader'
import { MainLayout } from '@/layouts/MainLayout'
import { PATHS } from './paths'
import { RedirectIfAuthed, RequireAuth, RequireTeam } from './guards'
import { LoginPage } from '@/pages/Login/LoginPage'

const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPassword/ForgotPasswordPage'))
const WelcomePage = lazy(() => import('@/pages/Welcome/WelcomePage'))
const CreateTeamPage = lazy(() => import('@/pages/CreateTeam/CreateTeamPage'))
const JoinTeamPage = lazy(() => import('@/pages/JoinTeam/JoinTeamPage'))
const MyTeamsPage = lazy(() => import('@/pages/MyTeams/MyTeamsPage'))
const ChatWorkspacePage = lazy(() => import('@/pages/ChatWorkspace/ChatWorkspacePage'))
const GitHubIntegrationPage = lazy(() => import('@/pages/GitHubIntegration/GitHubIntegrationPage'))
const TeamDetailPage = lazy(() => import('@/pages/TeamDetail/TeamDetailPage'))
const TeamSettingsPage = lazy(() => import('@/pages/TeamDetail/TeamSettingsPage'))
const TeamActivitiesPage = lazy(() => import('@/pages/TeamDetail/TeamActivitiesPage'))
const CreateProjectPage = lazy(() => import('@/pages/CreateProject/CreateProjectPage'))
const ProjectDetailLayout = lazy(() => import('@/pages/ProjectDetail/ProjectDetailLayout'))
const ProjectChatPage = lazy(() => import('@/pages/ProjectDetail/Chat/ProjectChatPage'))
const AgentTeamPage = lazy(() => import('@/pages/ProjectDetail/AgentTeam/AgentTeamPage'))
const CodePage = lazy(async () => ({ default: (await import('@/pages/ProjectDetail/Code/CodePage')).CodePage }))
const SkillPage = lazy(async () => ({ default: (await import('@/pages/ProjectDetail/Skill/SkillPage')).SkillPage }))
const MemoryPage = lazy(async () => ({ default: (await import('@/pages/ProjectDetail/Memory/MemoryPage')).MemoryPage }))
const MembersPage = lazy(async () => ({ default: (await import('@/pages/ProjectDetail/Members/MembersPage')).MembersPage }))
const SettingsPage = lazy(async () => ({ default: (await import('@/pages/ProjectDetail/Settings/SettingsPage')).SettingsPage }))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const ForbiddenPage = lazy(() => import('@/pages/ForbiddenPage'))

export function AppRouter() {
  return <BrowserRouter><Suspense fallback={<PageLoader />}><Routes>
    <Route path={PATHS.LOGIN} element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
    <Route path={PATHS.FORGOT_PASSWORD} element={<RedirectIfAuthed><ForgotPasswordPage /></RedirectIfAuthed>} />
    <Route element={<RequireAuth />}>
      <Route path={PATHS.WELCOME} element={<WelcomePage />} />
      <Route path={PATHS.APP} element={<MainLayout />}>
        <Route index element={<Navigate to={PATHS.MY_TEAMS} replace />} />
        <Route path="teams" element={<MyTeamsPage />} />
        <Route path="teams/create" element={<CreateTeamPage />} />
        <Route path="teams/join" element={<JoinTeamPage />} />
        <Route element={<RequireTeam />}>
          <Route path="teams/:teamId" element={<TeamDetailPage />}><Route path="settings" element={<TeamSettingsPage />} /></Route>
          <Route path="teams/:teamId/activities" element={<TeamActivitiesPage />} />
          <Route path="teams/:teamId/projects/create" element={<CreateProjectPage />} />
          <Route path="chat" element={<ChatWorkspacePage />} />
          <Route path="integrations/github" element={<GitHubIntegrationPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailLayout />}>
            <Route index element={<Navigate to="chat" replace />} />
            <Route path="chat" element={<ProjectChatPage />} />
            <Route path="agents" element={<AgentTeamPage />} />
            <Route path="skills" element={<SkillPage />} />
            <Route path="memory" element={<MemoryPage />} />
            <Route path="code" element={<CodePage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="/403" element={<ForbiddenPage />} />
    </Route>
    <Route path="/" element={<Navigate to={PATHS.LOGIN} replace />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes></Suspense></BrowserRouter>
}
