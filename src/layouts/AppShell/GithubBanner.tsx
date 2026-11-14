import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { repositoriesApi } from '@/api'
import { PATHS } from '@/routes/paths'
import { Button, Icon, IconButton, Tag } from '@/components/ui'

/**
 * GitHub App 断开时才出现的公告条：说明后果、给一个重连动作、可关闭。
 * 从未连接过 GitHub 的团队不打扰。
 */
export function GithubBanner({ teamId }: { teamId: string }) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)
  const connections = useQuery({
    queryKey: ['github', 'connections', teamId],
    queryFn: () => repositoriesApi.connections(teamId),
    staleTime: 60_000,
  })

  useEffect(() => setDismissed(false), [teamId])

  if (dismissed) return null
  const list = connections.data ?? []
  const disconnected = list.length > 0 && list.every((item) => item.suspended)
  if (!disconnected) return null

  return (
    <div className="banner-bar" role="status">
      <div className="banner-bar__main">
        <Icon name="alert" size={16} aria-hidden />
        <Tag tone="stop">GitHub 已断开</Tag>
        <p className="banner-bar__text">团队 GitHub App 连接已失效，仓库同步与派活暂停。</p>
      </div>
      <div className="banner-bar__actions">
        <Button
          variant="quiet"
          size="sm"
          icon={<Icon name="refresh" size={14} aria-hidden />}
          onClick={() => navigate(PATHS.githubIntegration(teamId))}
        >
          重新连接
        </Button>
        <IconButton label="关闭提示" square onClick={() => setDismissed(true)}>
          <Icon name="close" size={16} />
        </IconButton>
      </div>
    </div>
  )
}
