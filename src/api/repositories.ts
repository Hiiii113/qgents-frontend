import { request } from './client'
import { withQuery } from './requestHelpers'

export interface GithubConnection {
  id: string
  teamId: string
  providerInstallationId: number
  accountLogin: string
  accountType: string
  suspended: boolean
}
export interface AvailableRepository {
  installationId: string
  repositoryId: number
  fullName: string
  defaultBranch: string | null
  htmlUrl: string
  privateRepository: boolean
}
export interface ImportedRepository {
  id: string
  projectId: string
  installationId: string
  providerRepositoryId: number
  fullName: string
  defaultBranch: string | null
  htmlUrl: string
  privateRepository: boolean
}
export type ItemState = 'open' | 'closed' | 'all'

export interface PullRequestItem {
  repository: string
  number: number
  title: string
  state: 'open' | 'closed'
  merged: boolean
  author: string | null
  htmlUrl: string
  updatedAt: string
}

export interface IssueItem {
  repository: string
  number: number
  title: string
  state: 'open' | 'closed'
  author: string | null
  htmlUrl: string
  updatedAt: string
}

/** repositoryId 为 GitHub 仓库数字 ID；缺省时汇总项目内全部已导入仓库。 */
type ItemQuery = { state: ItemState; repositoryId?: number }
const itemsPath = (projectId: string, kind: 'pull-requests' | 'issues', query: ItemQuery) =>
  withQuery(`/projects/${encodeURIComponent(projectId)}/github/${kind}`, query)
const installationsPath = (teamId: string) =>
  `/teams/${encodeURIComponent(teamId)}/integrations/github/installations`
export const repositoriesApi = {
  connections: (teamId: string) => request<GithubConnection[]>(installationsPath(teamId)),
  connect: (teamId: string) =>
    request<{ installationUrl: string }>(`${installationsPath(teamId)}?client=WEB`, {
      method: 'POST',
    }),
  sync: (teamId: string, id: string) =>
    request<GithubConnection>(`${installationsPath(teamId)}/${encodeURIComponent(id)}/sync`, {
      method: 'POST',
    }),
  available: (teamId: string) =>
    request<AvailableRepository[]>(
      `/teams/${encodeURIComponent(teamId)}/integrations/github/repositories`,
    ),
  imported: (projectId: string) =>
    request<ImportedRepository[]>(`/projects/${encodeURIComponent(projectId)}/repositories`),
  import: (projectId: string, body: { installationId: string; repositoryId: number }) =>
    request<ImportedRepository>(`/projects/${encodeURIComponent(projectId)}/repositories`, {
      method: 'POST',
      body,
    }),
  pullRequests: (projectId: string, query: ItemQuery) =>
    request<PullRequestItem[]>(itemsPath(projectId, 'pull-requests', query)),
  issues: (projectId: string, query: ItemQuery) =>
    request<IssueItem[]>(itemsPath(projectId, 'issues', query)),
  remove: (projectId: string, id: string) =>
    request<void>(
      `/projects/${encodeURIComponent(projectId)}/repositories/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
}
