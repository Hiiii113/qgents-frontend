import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, App, Button, Empty, Popconfirm, Spin, Tag } from 'antd'
import { GithubOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { repositoriesApi } from '@/api/repositories'
import { teamApi } from '@/api/team'
import { WorkspacePage } from '@/components/WorkspacePage'
import { useCurrentTeamId } from '@/store/appUiStore'
import { formatApiError } from '@/utils/formatApiError'

export function GitHubIntegrationPage() {
  const [params, setParams] = useSearchParams()
  const currentTeam = useCurrentTeamId()
  const teamId = params.get('teamId') || currentTeam || ''
  const { message } = App.useApp()
  const client = useQueryClient()
  const team = useQuery({ queryKey: ['teams', teamId], queryFn: () => teamApi.getById(teamId), enabled: Boolean(teamId) })
  const connections = useQuery({ queryKey: ['github', teamId, 'connections'], queryFn: () => repositoriesApi.connections(teamId), enabled: Boolean(teamId) })
  const owner = team.data?.role === 'TEAM_OWNER'
  useEffect(() => {
    if (!params.has('installed') || !teamId) return
    void client.invalidateQueries({ queryKey: ['github', teamId] })
    const next = new URLSearchParams(params); next.delete('installed'); setParams(next, { replace: true })
  }, [params, setParams, teamId, client])
  const connect = useMutation({ mutationFn: () => repositoriesApi.connect(teamId),
    onSuccess: result => window.location.assign(result.installationUrl), onError: error => void message.error(formatApiError(error)),
  })
  const action = useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: 'sync' | 'disconnect' }) => {
      if (kind === 'sync') await repositoriesApi.sync(teamId, id)
      else await repositoriesApi.disconnect(teamId, id)
    },
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['github', teamId] }); void client.invalidateQueries({ queryKey: ['repositories'] }) },
    onError: error => void message.error(formatApiError(error)),
  })
  return <WorkspacePage title="GitHub 连接" description="团队通过 GitHub App 授权仓库。项目按需导入，Qgent 可在聊天中使用这些能力。"
    action={owner && <Button type="primary" icon={<GithubOutlined />} loading={connect.isPending} onClick={() => connect.mutate()}>连接 GitHub App</Button>}>
    {!teamId ? <Alert type="info" message="请先从团队或项目进入 GitHub 连接。" /> : connections.isPending ? <Spin delay={180} />
      : connections.isError ? <Alert type="error" showIcon message={formatApiError(connections.error)} action={<Button onClick={() => void connections.refetch()}>重试</Button>} />
        : !connections.data.length ? <Empty description={owner ? '连接 GitHub App，授权团队需要使用的仓库。' : '团队尚未连接 GitHub，请联系团队所有者。'} />
          : <div className="workspace-page__grid">{connections.data.map(connection => <article className="workspace-card" key={connection.id}>
            <h2><GithubOutlined /> {connection.accountLogin}</h2><Tag color={connection.suspended ? 'orange' : 'green'}>{connection.suspended ? '已暂停' : '已连接'}</Tag>
            <p>{connection.accountType === 'ORGANIZATION' ? '组织账号' : '个人账号'} · GitHub App</p>
            {owner && <div className="workspace-card__actions"><Button type="text" size="small" icon={<ReloadOutlined />} loading={action.isPending && action.variables?.id === connection.id} onClick={() => action.mutate({ id: connection.id, kind: 'sync' })}>刷新授权</Button>
              <Popconfirm title="解除团队的 GitHub 连接？" description="相关仓库会从项目导入列表移除，GitHub 仓库本身不会删除。" onConfirm={() => action.mutateAsync({ id: connection.id, kind: 'disconnect' })}><Button type="text" size="small" danger>解除连接</Button></Popconfirm></div>}
          </article>)}</div>}
    <p className="workspace-page__note">连接后，在项目仓库页导入 Qgent 可使用的仓库；Qgent 只使用团队 App 授权、且已导入当前项目的仓库。导入仓库不会自动执行代码操作。</p>
  </WorkspacePage>
}
export default GitHubIntegrationPage
