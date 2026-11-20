import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agentApi } from '@/api/agent'
import { directMessageApi } from '@/api/directMessage'
import { projectApi } from '@/api/project'
import { teamApi } from '@/api/team'
import { useAuth } from '@/context/AuthContext'
import { chatKeys } from '@/query/chatKeys'
import type { DirectConversation, DirectPeerType } from '@/types/directMessage'
import { formatApiError } from '@/utils/formatApiError'
import { Avatar, Button, Dialog, Icon, Skeleton } from '@/components/ui'

interface PickerRow {
  type: DirectPeerType
  id: string
  name: string
  meta: string
  avatarUrl?: string | null
}

/**
 * 发起私聊：只能挑同一个项目里的另一位成员或已启用的 Agent。
 * 已有会话时后端返回同一个会话，不会出现两条重复的私聊。
 */
export function StartDirectMessageDialog({
  projectId,
  teamId,
  open,
  onClose,
  onOpened,
}: {
  projectId: string
  teamId: string
  open: boolean
  onClose: () => void
  onOpened: (conversation: DirectConversation) => void
}) {
  const { user } = useAuth()
  const client = useQueryClient()
  const [error, setError] = useState('')
  const enabled = open && Boolean(projectId) && Boolean(teamId)

  const members = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => projectApi.listMembers(projectId),
    enabled,
  })
  const teamMembers = useQuery({
    queryKey: ['teams', teamId, 'members'],
    queryFn: () => teamApi.listMembers(teamId),
    enabled,
  })
  const agents = useQuery({
    queryKey: chatKeys.agents(projectId),
    queryFn: () => agentApi.list(projectId),
    enabled,
  })

  const users: PickerRow[] = (members.data ?? [])
    .filter((member) => member.userId !== user?.id)
    .map((member) => {
      const detail = teamMembers.data?.find((item) => item.userId === member.userId)
      return {
        type: 'USER',
        id: member.userId,
        name: detail?.displayName || member.displayName || member.email || member.userId,
        meta: detail?.email || member.email || '成员',
        avatarUrl: detail?.avatarUrl || member.avatarUrl,
      }
    })
  const agentRows: PickerRow[] = (agents.data ?? [])
    .filter((agent) => agent.status === 'ACTIVE')
    .map((agent) => ({
      type: 'AGENT',
      id: agent.id,
      name: agent.name,
      meta: agent.description || 'Agent',
      avatarUrl: agent.avatarUrl,
    }))

  const start = useMutation({
    mutationFn: (row: PickerRow) =>
      directMessageApi.open(projectId, { peerType: row.type, peerId: row.id }),
    onSuccess: (conversation) => {
      client.setQueryData<DirectConversation[]>(
        chatKeys.conversations(projectId),
        (current) => [...(current ?? []).filter((item) => item.id !== conversation.id), conversation],
      )
      void client.invalidateQueries({
        queryKey: chatKeys.conversations(projectId),
        exact: true,
      })
      setError('')
      onOpened(conversation)
      onClose()
    },
    onError: (failure) => setError(formatApiError(failure)),
  })

  const loading = members.isPending || teamMembers.isPending || agents.isPending
  const failed = members.isError || teamMembers.isError || agents.isError

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="发起私聊"
      description="只列出本项目的成员和已启用的 Agent。私聊记录只有你和对方能看，项目管理员也没有查看权。"
    >
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <Skeleton rows={3} /> : null}
      {failed ? (
        <p className="err">
          成员列表加载失败。
          <Button
            variant="link"
            size="sm"
            icon={<Icon name="refresh" size={15} />}
            onClick={() => {
              void members.refetch()
              void teamMembers.refetch()
              void agents.refetch()
            }}
          >
            重试
          </Button>
        </p>
      ) : null}
      {!loading && !failed ? (
        <div className="picklist-groups">
          <section>
            <p className="dialog-checks__label">项目成员</p>
            <Picker
              rows={users}
              empty="项目里没有其他成员。"
              busy={start.isPending}
              onPick={(row) => start.mutate(row)}
            />
          </section>
          <section>
            <p className="dialog-checks__label">已启用的 Agent</p>
            <Picker
              rows={agentRows}
              empty="本项目还没有已启用的 Agent。"
              busy={start.isPending}
              onPick={(row) => start.mutate(row)}
            />
          </section>
        </div>
      ) : null}
      {start.isPending ? (
        <p className="meta" role="status">
          正在打开会话…
        </p>
      ) : null}
      <div className="dlg__foot">
        <Button variant="quiet" onClick={onClose} icon={<Icon name="close" size={15} />}>
          取消
        </Button>
      </div>
    </Dialog>
  )
}

function Picker({
  rows,
  empty,
  busy,
  onPick,
}: {
  rows: PickerRow[]
  empty: string
  busy: boolean
  onPick: (row: PickerRow) => void
}) {
  if (!rows.length) return <p className="meta">{empty}</p>
  return (
    <div className="picklist">
      {rows.map((row) => (
        <button
          key={`${row.type}:${row.id}`}
          type="button"
          className="pickrow"
          disabled={busy}
          onClick={() => onPick(row)}
        >
          <Avatar
            name={row.name}
            src={row.avatarUrl}
            type={row.type === 'AGENT' ? 'agent' : 'user'}
            size="sm"
          />
          <span className="pickrow__name">{row.name}</span>
          <span className="pickrow__meta">{row.meta}</span>
        </button>
      ))}
    </div>
  )
}
