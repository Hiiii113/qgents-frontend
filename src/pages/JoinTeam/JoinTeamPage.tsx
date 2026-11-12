import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { App, Button, Tag } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PATHS } from '@/routes/paths'
import { useAuth } from '@/context/AuthContext'
import { teamApi } from '@/api'
import { WorkspacePage } from '@/components/WorkspacePage'
import type { MyTeamInvitation, TeamRole } from '@/types'
import './JoinTeamPage.css'

const ROLE_LABEL: Record<TeamRole, string> = {
  TEAM_OWNER: '所有者',
  TEAM_ADMIN: '管理员',
  TEAM_MEMBER: '成员',
}

/**
 * 加入已有团队 —— 当前接口
 *
 * 用户粘贴邮件邀请中的邀请令牌，调 POST /team-invitations/{token}/accept
 */
export default function JoinTeamPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { setHasTeam } = useAuth()
  const queryClient = useQueryClient()
  const [token, setToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 待处理邀请列表（收件人视角，分页响应取 data）
  const {
    data: myInvitationsData,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['team-invitations', 'mine'],
    queryFn: () => teamApi.listMyInvitations(),
  })
  const myInvitations = myInvitationsData?.data ?? []

  const acceptMutation = useMutation({
    mutationFn: (inv: MyTeamInvitation) => teamApi.acceptInvitation(inv.id),
    onSuccess: (_result, inv) => {
      setHasTeam(true)
      setSuccess(`已成功加入「${inv.teamName}」`)
      queryClient.invalidateQueries({ queryKey: ['team-invitations', 'mine'] })
      queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] })
      queryClient.invalidateQueries({ queryKey: ['teams', inv.teamId, 'projects'] })
      void message.success(`已加入「${inv.teamName}」`)
      navigate(PATHS.teamDetail(inv.teamId), { replace: true })
    },
    onError: (err) => setError(err instanceof Error ? err.message : '接受邀请失败'),
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    try {
      await teamApi.acceptInvitation(token.trim())
      setHasTeam(true)
      setSuccess('已成功加入团队')
      void queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] })
      void message.success('已成功加入团队')
      // 令牌接受响应不含团队 ID，回首页恢复可用团队并展示项目。
      navigate(PATHS.APP, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入失败，邀请令牌可能已过期')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <WorkspacePage title="加入已有团队" description="输入团队邀请邮件中的邀请令牌，即可加入团队。">
      <form className="join-team__form" onSubmit={handleSubmit}>
        {error && (
          <p className="join-team__note join-team__note--error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="join-team__note" role="status">
            {success}
          </p>
        )}

        <div className="join-team__field">
          <label className="join-team__label" htmlFor="join-team-token">
            邀请令牌
          </label>
          <input
            id="join-team-token"
            className="join-team__input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="粘贴邀请邮件中的令牌"
            required
          />
        </div>

        <Button
          type="primary"
          htmlType="submit"
          autoInsertSpace={false}
          disabled={submitting || !token.trim()}
        >
          {submitting ? '加入中…' : '加入团队'}
        </Button>
      </form>

      <section className="join-team__pending">
        <h2 className="join-team__section-title">待处理邀请</h2>

        {isPending ? (
          <p className="join-team__placeholder">正在加载邀请…</p>
        ) : isError ? (
          <p className="join-team__placeholder">
            邀请列表加载失败。
            <button type="button" className="join-team__link" onClick={() => void refetch()}>
              重试
            </button>
          </p>
        ) : myInvitations.length === 0 ? (
          <div className="join-team__empty">
            <p>暂时没有待处理邀请。</p>
            <Link className="join-team__primary-link" to={PATHS.CREATE_TEAM}>
              创建一个团队
            </Link>
          </div>
        ) : (
          <ul className="join-team__list">
            {myInvitations.map((inv) => {
              // 过期状态由后端按 expires_at 计算，不落库
              const expired = inv.status === 'EXPIRED'
              return (
                <li key={inv.id} className="join-team__row">
                  <div className="join-team__row-main">
                    <div className="join-team__row-head">
                      <strong>{inv.teamName}</strong>
                      <Tag>{ROLE_LABEL[inv.role]}</Tag>
                      {expired && <span className="join-team__expired">已过期</span>}
                    </div>
                    <p className="join-team__row-meta">
                      邀请人：{inv.inviterDisplayName} · {inv.createdAt}
                    </p>
                  </div>
                  <Button
                    type="primary"
                    size="middle"
                    loading={acceptMutation.isPending}
                    disabled={expired}
                    onClick={() => acceptMutation.mutate(inv)}
                  >
                    {expired ? '已过期' : '接受邀请'}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </WorkspacePage>
  )
}
