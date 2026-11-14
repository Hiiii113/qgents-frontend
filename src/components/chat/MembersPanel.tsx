import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import type { ChatMember } from '@/types/chat'
import { formatApiError } from '@/utils/formatApiError'
import { Avatar, Button, Icon, IconButton, Skeleton, Tag } from '@/components/ui'

/** 群成员侧栏：只看当前群的人与 Agent，邀请仍走原来的成员选择弹窗。 */
export function MembersPanel({
  groupTitle,
  members,
  pending,
  error,
  onRetry,
  onClose,
  onInvite,
  inviteDisabled,
}: {
  groupTitle: string
  members: ChatMember[] | undefined
  pending: boolean
  error: unknown
  onRetry: () => void
  onClose: () => void
  onInvite: () => void
  inviteDisabled: boolean
}) {
  const { user } = useAuth()
  const users = (members ?? []).filter((member) => member.memberType === 'USER')
  const agents = (members ?? []).filter((member) => member.memberType === 'AGENT')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // 邀请成员弹窗打开时，Esc 先交给原生 dialog。
      if (document.querySelector('dialog[open]')) return
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <aside
      id="group-members-panel"
      className="sidepanel members-panel is-open"
      aria-label="群成员"
    >
      <header className="sidepanel__head">
        <div>
          <p className="sidepanel__kicker">群成员</p>
          <p className="sidepanel__title od-truncate">{groupTitle}</p>
          <p className="meta">
            {pending ? '正在加载成员…' : `${members?.length ?? 0} 名成员 · ${agents.length} 个 Agent`}
          </p>
        </div>
        <IconButton label="收起成员列表" square onClick={onClose}>
          <Icon name="close" size={18} />
        </IconButton>
      </header>

      <div className="members-panel__body">
        {pending ? <Skeleton rows={4} /> : null}
        {!pending && error ? (
          <div className="members-panel__error">
            <p className="err">{formatApiError(error)}</p>
            <Button variant="quiet" size="sm" onClick={onRetry}>
              重试
            </Button>
          </div>
        ) : null}
        {!pending && !error ? (
          users.length || agents.length ? (
            <>
              {users.length ? (
                <MemberGroup label="成员" members={users} selfId={user?.id} />
              ) : null}
              {agents.length ? <MemberGroup label="Agent" members={agents} agent /> : null}
            </>
          ) : (
            <p className="meta">这个群还没有成员。</p>
          )
        ) : null}
      </div>

      <footer className="sidepanel__foot">
        <Button
          variant="quiet"
          block
          icon={<Icon name="plus" size={14} />}
          disabled={inviteDisabled}
          onClick={onInvite}
        >
          邀请成员 / Agent
        </Button>
      </footer>
    </aside>
  )
}

function MemberGroup({
  label,
  members,
  agent,
  selfId,
}: {
  label: string
  members: ChatMember[]
  agent?: boolean
  selfId?: string
}) {
  return (
    <section className="members-panel__group" aria-label={label}>
      <p className="members-panel__label">
        {label}
        <span className="meta">{members.length}</span>
      </p>
      <ul className="members-panel__list">
        {members.map((member) => (
          <li className="member-row" key={`${member.memberType}:${member.id}`}>
            <Avatar
              name={member.displayName}
              src={member.avatarUrl}
              type={agent ? 'agent' : 'user'}
              size="sm"
            />
            <span className="od-fill member-row__body">
              <span className="member-row__name">{member.displayName}</span>
              <span className="meta od-truncate">
                {agent ? '项目 Agent' : member.email || '成员'}
              </span>
            </span>
            {agent ? (
              <Tag tone="agent">Agent</Tag>
            ) : member.id === selfId ? (
              <Tag tone="readonly">你</Tag>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
