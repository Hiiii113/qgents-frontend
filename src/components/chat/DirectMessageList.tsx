import { Avatar } from '@/components/ui'
import { chatPreview } from '@/types/chat'
import { directActivityAt, directPreviewPrefix, type DirectConversation } from '@/types/directMessage'
import { formatRelativeTime } from '@/utils/formatRelativeTime'

/** 私聊会话行：头像区分人和 Agent，未读数只在有内容时出现。 */
export function DirectMessageList({
  conversations,
  selectedId,
  keyword,
  pending = false,
  onSelect,
}: {
  conversations: DirectConversation[]
  selectedId: string | null
  keyword: string
  pending?: boolean
  onSelect: (conversation: DirectConversation) => void
}) {
  const visible = conversations
    .filter((item) => {
      if (!keyword) return true
      return (
        item.peer.displayName.toLowerCase().includes(keyword) ||
        (item.lastMessage?.text ?? '').toLowerCase().includes(keyword)
      )
    })
    .sort((a, b) => directActivityAt(b) - directActivityAt(a))

  if (!visible.length && pending) return <p className="context__empty">正在加载私聊…</p>

  if (!visible.length)
    return (
      <p className="context__empty">
        {keyword ? `没有匹配「${keyword}」的私聊。` : '还没有私聊，用右上角的按钮发起一个。'}
      </p>
    )

  return (
    <ul className="dmlist">
      {visible.map((item) => {
        const unread = item.unreadCount ?? 0
        const preview = chatPreview(item.lastMessage?.text ?? '')
        const at = item.latestActivityAt ?? item.lastMessageAt
        return (
          <li key={item.id}>
            <button
              type="button"
              className="dmrow"
              aria-current={item.id === selectedId}
              data-unread={unread ? 'true' : undefined}
              onClick={() => onSelect(item)}
            >
              <Avatar
                name={item.peer.displayName}
                src={item.peer.avatarUrl}
                type={item.peer.type === 'AGENT' ? 'agent' : 'user'}
                size="sm"
              />
              <span className="dmrow__main">
                <span className="dmrow__name">{item.peer.displayName}</span>
                <span className="dmrow__meta">
                  <span className="dmrow__preview">
                    {preview ? `${directPreviewPrefix(item)}${preview}` : '还没有消息'}
                  </span>
                  <time data-fresh={unread ? true : undefined}>
                    {at ? formatRelativeTime(at) : ''}
                  </time>
                </span>
              </span>
              {unread ? (
                <span className="dmrow__count" aria-label={`${unread} 条未读`}>
                  {unread > 99 ? '99+' : unread}
                </span>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
