import { useEffect, useState } from 'react'
import { Button, Empty, Modal, Spin, Typography } from 'antd'
import {
  FilePdfOutlined,
  FileTextOutlined,
  CodeOutlined,
  FileOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { attachmentApi, resolvePreviewUrl } from '@/api/attachment'
import type { AttachmentPreview, AttachmentPreviewType } from '@/api/attachment'

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
 * 附件内联预览弹窗；每次打开获取新的预览和下载链接。
 * - IMAGE：使用签发链接在页内放大展示
 * - PDF：iframe 内联预览（previewUrl 带短期 token，后端支持 Range 分页）
 * - TEXT/CODE：拉 ?raw=1 原文，页内 <pre> 展示（支持复制）
 * - UNSUPPORTED / 无 previewUrl：显示下载按钮（downloadUrl 优先）
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

  // 弹窗关闭后不缓存短期链接，再次打开重新获取。
  const previewQuery = useQuery({
    queryKey: ['attachments', projectId, attachmentId, 'preview'],
    queryFn: () => attachmentApi.previewUrl(projectId, attachmentId),
    enabled: Boolean(open && projectId && attachmentId),
    gcTime: 0,
    staleTime: 0,
  })
  const preview: AttachmentPreview | null = previewQuery.data ?? null

  const previewUrl = preview?.previewUrl
    ? resolvePreviewUrl(preview.previewUrl)
    : null
  const previewType = preview?.previewType
  const downloadUrl = preview?.downloadUrl ?? null
  const previewable = preview?.previewable ?? false

  // TEXT/CODE：读取签发链接的原文，切换附件或刷新链接时取消旧请求。
  useEffect(() => {
    if (!open || !previewUrl || (previewType !== 'TEXT' && previewType !== 'CODE')) {
      setRawText(null)
      return
    }
    const controller = new AbortController()
    setRawLoading(true)
    setRawText(null)
    const rawUrl = `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}raw=1`
    fetch(rawUrl, { signal: controller.signal })
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
  }, [open, previewUrl, previewType, previewQuery.dataUpdatedAt])

  const title = fileName ?? (preview?.fileName ?? '附件预览')
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
      {previewType === 'IMAGE' && previewUrl ? (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          {/* 签发链接包含短期访问凭证，可直接用于图片加载。 */}
          <img
            src={previewUrl}
            alt={title}
            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, objectFit: 'contain' }}
          />
        </div>
      ) : previewType === 'PDF' && previewUrl ? (
        <iframe
          src={previewUrl}
          title={title}
          style={{ width: '100%', height: '70vh', border: '1px solid #e5e7eb', borderRadius: 8 }}
        />
      ) : (previewType === 'TEXT' || previewType === 'CODE') && previewUrl ? (
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
            <Empty description="无法加载文本内容"><Button onClick={() => void previewQuery.refetch()}>重试</Button></Empty>
          )}
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            {rawText != null ? (
              <Button
                size="small"
                onClick={() => void navigator.clipboard?.writeText(rawText)}
              >
                复制内容
              </Button>
            ) : null}
          </div>
        </div>
      ) : previewQuery.isError ? (
        <Empty description="预览信息加载失败">
          <Button onClick={() => void previewQuery.refetch()}>重试</Button>
          {downloadUrl ? (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
            >
              下载文件
            </Button>
          ) : null}
        </Empty>
      ) : previewUrl && previewable ? (
        <Empty description="该文件类型不支持页内预览">
          {previewUrl ? (
            <Button type="primary" href={previewUrl} target="_blank" rel="noreferrer">
              打开预览
            </Button>
          ) : null}
        </Empty>
      ) : (
        <Empty description={previewQuery.isLoading ? '正在获取预览信息…' : '该文件不支持内联预览，请下载查看'}>
          {!previewQuery.isLoading && downloadUrl ? (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
            >
              下载文件
            </Button>
          ) : null}
        </Empty>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <Text type="secondary">无法加载时，可刷新预览链接后重试。</Text>
        <Button size="small" loading={previewQuery.isFetching} onClick={() => void previewQuery.refetch()}>刷新预览</Button>
      </div>
    </Modal>
  )
}
