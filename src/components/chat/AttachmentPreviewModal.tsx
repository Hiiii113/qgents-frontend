import { useEffect, useState } from 'react'
import { Button, Empty, Modal, Space, Spin, Typography } from 'antd'
import {
  FilePdfOutlined,
  FileTextOutlined,
  CodeOutlined,
  FileOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { attachmentApi, resolvePreviewUrl } from '@/api/attachment'
import type { AttachmentInfo, AttachmentPreviewType } from '@/api/attachment'

const { Text } = Typography

/** 附件预览类型对应的图标和标签。 */
function attachmentTypeMeta(type: AttachmentPreviewType | undefined): {
  icon: React.ReactNode
  label: string
} {
  switch (type) {
    case 'IMAGE':
      return { icon: <FileOutlined />, label: '图片' }
    case 'PDF':
      return { icon: <FilePdfOutlined style={{ color: '#ef4444' }} />, label: 'PDF' }
    case 'CODE':
      return { icon: <CodeOutlined style={{ color: '#3b82f6' }} />, label: '代码' }
    case 'TEXT':
      return { icon: <FileTextOutlined style={{ color: '#64748b' }} />, label: '文本' }
    default:
      return { icon: <FileOutlined />, label: '文件' }
  }
}

/** 统一内容接口通过 download=1 切换为附件下载。 */
function downloadUrl(contentUrl: string): string {
  return `${contentUrl}${contentUrl.includes('?') ? '&' : '?'}download=1`
}

interface AttachmentPreviewModalProps {
  open: boolean
  projectId: string
  /** 消息 content 中的附件 ID。 */
  attachmentId: string
  /** 展示用文件名（消息 content.name，可能缺失） */
  fileName?: string
  onClose: () => void
}

/**
 * 附件预览弹窗；每次打开重新获取短期内容地址。
 * - IMAGE：使用 contentUrl 在页内放大展示
 * - PDF：iframe 内联预览（contentUrl 带短期 token，后端支持 Range 分页）
 * - TEXT/CODE：拉取 contentUrl 原文，页内 <pre> 展示（支持复制）
 * - 所有附件均可通过 contentUrl + download=1 下载
 */
export function AttachmentPreviewModal({
  open,
  projectId,
  attachmentId,
  fileName,
  onClose,
}: AttachmentPreviewModalProps) {
  const [rawText, setRawText] = useState<string | null>(null)
  const [rawLoading, setRawLoading] = useState(false)

  // 弹窗关闭后不缓存短期地址，再次打开重新获取。
  const infoQuery = useQuery({
    queryKey: ['attachments', projectId, attachmentId, 'info'],
    queryFn: () => attachmentApi.info(projectId, attachmentId),
    enabled: Boolean(open && projectId && attachmentId),
    gcTime: 0,
    staleTime: 0,
  })
  const info: AttachmentInfo | null = infoQuery.data ?? null

  const contentUrl = info?.contentUrl ? resolvePreviewUrl(info.contentUrl) : null
  const previewType = info?.previewType
  const previewable = info?.previewable ?? false
  const fileDownloadUrl = contentUrl ? downloadUrl(contentUrl) : null

  // TEXT/CODE：读取统一内容地址原文，切换附件或刷新地址时取消旧请求。
  useEffect(() => {
    if (!open || !contentUrl || (previewType !== 'TEXT' && previewType !== 'CODE')) {
      setRawText(null)
      return
    }
    const controller = new AbortController()
    setRawLoading(true)
    setRawText(null)
    fetch(contentUrl, { signal: controller.signal })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((text) => {
        if (!controller.signal.aborted) setRawText(text)
      })
      .catch(() => {
        if (!controller.signal.aborted) setRawText(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setRawLoading(false)
      })
    return () => {
      controller.abort()
    }
  }, [open, contentUrl, previewType, infoQuery.dataUpdatedAt])

  const title = fileName ?? info?.fileName ?? '附件预览'
  const { icon } = attachmentTypeMeta(previewType)

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={previewType === 'IMAGE' ? 720 : 860}
      destroyOnHidden
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {icon} {title}
        </span>
      }
    >
      {previewType === 'IMAGE' && contentUrl ? (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <img
            src={contentUrl}
            alt={title}
            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, objectFit: 'contain' }}
          />
        </div>
      ) : previewType === 'PDF' && contentUrl ? (
        <iframe
          src={contentUrl}
          title={title}
          style={{ width: '100%', height: '70vh', border: '1px solid #e5e7eb', borderRadius: 8 }}
        />
      ) : (previewType === 'TEXT' || previewType === 'CODE') && contentUrl ? (
        <div style={{ position: 'relative' }}>
          {rawLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin delay={180} />
            </div>
          ) : rawText != null ? (
            <pre
              style={{
                margin: 0,
                maxHeight: '65vh',
                overflow: 'auto',
                padding: 16,
                background: '#0f172a',
                color: '#e2e8f0',
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {rawText}
            </pre>
          ) : (
            <Empty description="无法加载文本内容">
              <Button onClick={() => void infoQuery.refetch()}>重新获取</Button>
            </Empty>
          )}
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            {rawText != null ? (
              <Button size="small" onClick={() => void navigator.clipboard?.writeText(rawText)}>
                复制内容
              </Button>
            ) : null}
          </div>
        </div>
      ) : infoQuery.isError ? (
        <Empty description="预览信息加载失败">
          <Button onClick={() => void infoQuery.refetch()}>重试</Button>
        </Empty>
      ) : contentUrl && previewable ? (
        <Empty description="该文件类型不支持页内预览" />
      ) : (
        <Empty
          description={
            infoQuery.isLoading ? '正在获取预览信息…' : '该文件不支持内联预览，请下载查看'
          }
        />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 12,
        }}
      >
        <Text type="secondary">无法加载时，可刷新内容地址后重试。</Text>
        <Space>
          {fileDownloadUrl ? (
            <Button
              icon={<DownloadOutlined />}
              href={fileDownloadUrl}
              target="_blank"
              rel="noreferrer"
            >
              下载文件
            </Button>
          ) : null}
          <Button
            size="small"
            loading={infoQuery.isFetching}
            onClick={() => void infoQuery.refetch()}
          >
            刷新预览
          </Button>
        </Space>
      </div>
    </Modal>
  )
}
