import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, App, Button, Spin } from 'antd'
import { GithubOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { repositoriesApi } from '@/api/repositories'
import { teamApi } from '@/api/team'
import { WorkspacePage } from '@/components/WorkspacePage'
import { useCurrentTeamId } from '@/store/appUiStore'
import { formatApiError } from '@/utils/formatApiError'
import './GitHubIntegrationPage.css'

export function GitHubIntegrationPage() {
  const [params, setParams] = useSearchParams()
  const currentTeam = useCurrentTeamId()
  const teamId = params.get('teamId') || currentTeam || ''
  const { message } = App.useApp()
  const client = useQueryClient()
  const team = useQuery({
    queryKey: ['teams', teamId],
    queryFn: () => teamApi.getById(teamId),
    enabled: Boolean(teamId),
  })
  const connections = useQuery({
    queryKey: ['github', teamId, 'connections'],
    queryFn: () => repositoriesApi.connections(teamId),
    enabled: Boolean(teamId),
  })
  const owner = team.data?.role === 'TEAM_OWNER'
  useEffect(() => {
    if (!params.has('installed') || !teamId) return
    void client.invalidateQueries({ queryKey: ['github', teamId] })
    const next = new URLSearchParams(params)
    next.delete('installed')
    setParams(next, { replace: true })
  }, [params, setParams, teamId, client])
  const connect = useMutation({
    mutationFn: () => repositoriesApi.connect(teamId),
    onSuccess: (result) => window.location.assign(result.installationUrl),
    onError: (error) => void message.error(formatApiError(error)),
  })
  const action = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await repositoriesApi.sync(teamId, id)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['github', teamId] })
      void client.invalidateQueries({ queryKey: ['repositories'] })
    },
    onError: (error) => void message.error(formatApiError(error)),
  })
  return (
    <WorkspacePage
      title="GitHub 连接"
      description="团队连接 GitHub App 并授权仓库；项目导入后，Qgent 才能在聊天里使用。"
      action={
        owner && (
          <Button
            type="primary"
            icon={<GithubOutlined />}
            loading={connect.isPending}
            onClick={() => connect.mutate()}
          >
            连接 GitHub App
          </Button>
        )
      }
    >
      {!teamId ? (
        <p className="workspace-page__note">请先从团队或项目进入 GitHub 连接。</p>
      ) : connections.isPending ? (
        <Spin delay={180} />
      ) : connections.isError ? (
        <Alert
          type="error"
          showIcon
          title={formatApiError(connections.error)}
          action={<Button onClick={() => void connections.refetch()}>重试</Button>}
        />
      ) : !connections.data.length ? (
        <p className="github-empty">
          {owner
            ? '连接 GitHub App，授权团队需要使用的仓库。'
            : '团队尚未连接 GitHub，请联系团队所有者。'}
        </p>
      ) : (
        <ul className="github-connections">
          {connections.data.map((connection) => (
            <li className="github-connection" key={connection.id}>
              <span className="github-connection__name">
                <GithubOutlined aria-hidden /> {connection.accountLogin}
              </span>
              <span className="github-connection__meta">
                {connection.accountType === 'ORGANIZATION' ? '组织' : '个人'}账号
              </span>
              <span className={`github-pill${connection.suspended ? ' github-pill--paused' : ''}`}>
                {connection.suspended ? '已暂停' : '已连接'}
              </span>
              {owner && (
                <Button
                  type="text"
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={action.isPending && action.variables?.id === connection.id}
                  onClick={() => action.mutate({ id: connection.id })}
                >
                  刷新授权
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </WorkspacePage>
  )
}
export default GitHubIntegrationPage
