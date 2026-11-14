import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { teamApi } from '@/api/team'
import { useAuth } from '@/context/AuthContext'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import { Button, EmptyState, Skeleton, TextField, Icon } from '@/components/ui'
import type { MyTeamInvitation } from '@/types'
import { Gate, GateAside, GateForm } from '../Auth/Gate'

interface Values {
  token: string
}

/** 加入团队：粘贴邀请令牌，或接受已收到的待处理邀请。 */
export default function JoinTeamPage() {
  const navigate = useNavigate()
  const client = useQueryClient()
  const { setHasTeam } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const invitations = useQuery({
    queryKey: ['team-invitations', 'mine'],
    queryFn: () => teamApi.listMyInvitations(),
  })
  const accept = useMutation({
    mutationFn: (invite: MyTeamInvitation) => teamApi.acceptInvitation(invite.id),
    onSuccess: (_result, invite) => {
      setHasTeam(true)
      void client.invalidateQueries({ queryKey: ['teams', 'mine'] })
      void client.invalidateQueries({ queryKey: ['team-invitations', 'mine'] })
      navigate(PATHS.teamDetail(invite.teamId), { replace: true })
    },
    onError: (failure) => setError(formatApiError(failure)),
  })

  async function handleFinish(values: Values) {
    setError(null)
    setSubmitting(true)
    try {
      await teamApi.acceptInvitation(values.token.trim())
      setHasTeam(true)
      void client.invalidateQueries({ queryKey: ['teams', 'mine'] })
      navigate(PATHS.APP, { replace: true })
    } catch (failure) {
      setError(formatApiError(failure))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Gate>
      <GateAside
        kicker="加入团队"
        title="用管理员给你的邀请"
        description="邀请码一次性有效，过期后由团队管理员重新生成。"
        rows={false}
      />
      <GateForm>
        <h1 className="gate__title">加入团队</h1>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        <Form
          layout="vertical"
          className="form"
          onFinish={(values: Values) => void handleFinish(values)}
          disabled={submitting}
          requiredMark={false}
        >
          <Form.Item
            name="token"
            label="邀请码"
            rules={[{ required: true, whitespace: true, message: '请输入邀请码' }]}
          >
            <TextField placeholder="例如：LIXING-8K3D" autoFocus />
          </Form.Item>
          <div className="form__foot">
            <Button
              variant="quiet"
              onClick={() => navigate(PATHS.WELCOME)}
              icon={<Icon name="close" size={15} />}
            >
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              icon={<Icon name="check" size={15} />}
              disabled={submitting}
            >
              {submitting ? '加入中…' : '加入'}
            </Button>
          </div>
        </Form>

        <section className="section">
          <h2 className="h3">待处理邀请</h2>
          {invitations.isPending ? (
            <Skeleton rows={2} />
          ) : invitations.isError ? (
            <EmptyState
              description="邀请列表加载失败。"
              action={
                <Button
                  variant="link"
                  onClick={() => void invitations.refetch()}
                  icon={<Icon name="refresh" size={15} />}
                >
                  重试
                </Button>
              }
            />
          ) : !invitations.data.data.length ? (
            <EmptyState description="暂时没有待处理邀请。" />
          ) : (
            <ul className="rows">
              {invitations.data.data.map((invite) => {
                const expired = invite.status === 'EXPIRED'
                return (
                  <li key={invite.id} className="rows__item">
                    <span className="od-fill">
                      <span className="name">{invite.teamName}</span>
                      <span className="meta">
                        邀请人：{invite.inviterDisplayName} · {formatDate(invite.createdAt)}
                      </span>
                    </span>
                    <Button
                      variant={expired ? 'quiet' : 'primary'}
                      size="sm"
                      disabled={expired || accept.isPending}
                      onClick={() => accept.mutate(invite)}
                      icon={<Icon name="check" size={15} />}
                    >
                      {expired ? '已过期' : '接受邀请'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </GateForm>
    </Gate>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString()
}
