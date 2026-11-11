import { request } from './client'

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
  disconnect: (teamId: string, id: string) =>
    request<void>(`${installationsPath(teamId)}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
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
  remove: (projectId: string, id: string) =>
    request<void>(
      `/projects/${encodeURIComponent(projectId)}/repositories/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
}
