import { useParams, useSearchParams } from 'react-router-dom'
import { Alert, Button } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { chatApi } from '@/api/chat'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { chatKeys } from '@/components/chat/useChatMessages'
import { PageLoader } from '@/components/PageLoader'
import { formatApiError } from '@/utils/formatApiError'

export default function ProjectChatPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [params] = useSearchParams()
  const groups = useQuery({
    queryKey: chatKeys.groups(projectId),
    queryFn: () => chatApi.groups(projectId),
    enabled: Boolean(projectId),
  })
  if (groups.isPending)
    return (
      <div className="chat-panel__status">
        <PageLoader />
      </div>
    )
  if (groups.isError)
    return (
      <div className="chat-panel__status">
        <Alert
          type="error"
          showIcon
          message={formatApiError(groups.error)}
          action={<Button onClick={() => void groups.refetch()}>重试</Button>}
        />
      </div>
    )
  const groupId = params.get('groupId')
  const group = groupId
    ? groups.data.find((item) => item.id === groupId)
    : groups.data.find((item) => item.defaultGroup) || groups.data[0]
  if (!group)
    return (
      <div className="chat-panel__status">
        <Alert
          type="warning"
          showIcon
          message={groupId ? '你未加入该群聊，或群聊不存在' : '项目群聊尚未就绪'}
          action={<Button onClick={() => void groups.refetch()}>刷新</Button>}
        />
      </div>
    )
  return <ChatPanel key={group.id} projectId={projectId} groupId={group.id} />
}
