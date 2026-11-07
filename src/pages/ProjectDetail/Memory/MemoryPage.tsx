import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Input, Space, Spin, Typography } from 'antd'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { memoryApi } from '@/api'
import { formatApiError } from '@/utils/formatApiError'
import './MemoryPage.css'

const { Text, Paragraph } = Typography

/**
 * 项目共享知识：单个 memory.md。
 * 人工编辑和 Qgent 写入同一个文件；保存时用读取到的版本检测并发修改。
 */
export function MemoryPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const [draft, setDraft] = useState('')
  const [version, setVersion] = useState('')
  // 记住草稿所基于的服务端正文：没有本地修改时才跟随实时刷新替换
  const base = useRef<string | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['memory', projectId],
    queryFn: () => memoryApi.get(projectId),
    enabled: !!projectId,
  })

  useEffect(() => {
    if (!data) return
    setDraft((current) => (base.current === null || current === base.current ? data.content : current))
    base.current = data.content
    setVersion(data.version)
  }, [data])

  const save = useMutation({
    mutationFn: () => memoryApi.save(projectId, { content: draft, version }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['memory', projectId], saved)
      base.current = saved.content
      setVersion(saved.version)
      void message.success('项目记忆已保存')
    },
    onError: () => {
      // 版本冲突时重新拉取，避免继续基于旧内容编辑
      void refetch()
    },
  })

  if (isLoading) return <Spin />
  if (isError) return <Alert type="error" showIcon message={formatApiError(error)} />

  const dirty = draft !== (data?.content ?? '')

  return (
    <Card
      title="项目记忆"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void refetch()} disabled={save.isPending}>
            重新加载
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={save.isPending}
            disabled={!dirty}
            onClick={() => save.mutate()}
          >
            保存
          </Button>
        </Space>
      }
    >
      <Paragraph type="secondary">
        memory.md 是项目的长期记忆，Qgent 每次执行都会读取。Qgent 修改前会先说明拟改动的内容并征求同意；
        你也可以直接在这里编辑。
      </Paragraph>
      {save.isError && <Alert type="error" showIcon message={formatApiError(save.error)} />}
      <Input.TextArea
        className="memory-page__editor"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        autoSize={{ minRows: 18, maxRows: 28 }}
        placeholder="# 项目约定&#10;&#10;- 记录已确认、可长期复用的项目事实"
      />
      <div className="memory-page__footer">
        <Text type="secondary">{draft.length} 字符</Text>
        {data?.updatedAt && (
          <Text type="secondary">最后修改 {new Date(data.updatedAt).toLocaleString()}</Text>
        )}
      </div>
    </Card>
  )
}
