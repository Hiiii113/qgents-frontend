import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { attachmentApi, resolvePreviewUrl } from '@/api/attachment'
import type { AttachmentInfo, AttachmentPreviewType } from '@/api/attachment'
import { Button, Dialog, Icon, Skeleton } from '@/components/ui'

function typeLabel(type: AttachmentPreviewType | undefined) {
  switch (type) {
    case 'IMAGE':
      return '图片'
    case 'PDF':
      return 'PDF'
    case 'CODE':
      return '代码'
    case 'TEXT':
      return '文本'
    default:
      return '文件'
  }
}

/** 统一内容接口通过 download=1 切换为附件下载。 */
function downloadUrl(contentUrl: string) {
  return `${contentUrl}${contentUrl.includes('?') ? '&' : '?'}download=1`
}

/**
 * 附件预览：图片页内放大，PDF 内联，文本/代码拉原文，所有类型都能下载。
 * 每次打开重新获取短期内容地址，不做跨会话缓存。
 */
export function AttachmentPreview({
  open,
  projectId,
  attachmentId,
  fileName,
  onClose,
}: {
  open: boolean
  projectId: string
  attachmentId: string
  fileName?: string
  onClose: () => void
}) {
  const [text, setText] = useState<string | null>(null)
  const [loadingText, setLoadingText] = useState(false)
  const infoQuery = useQuery({
    queryKey: ['attachments', projectId, attachmentId, 'info'],
    queryFn: () => attachmentApi.info(projectId, attachmentId),
    enabled: Boolean(open && projectId && attachmentId),
    gcTime: 0,
    staleTime: 0,
  })
  const info: AttachmentInfo | null = infoQuery.data ?? null
  const contentUrl = info?.contentUrl ? resolvePreviewUrl(info.contentUrl) : null
  const type = info?.previewType

  useEffect(() => {
    if (!open || !contentUrl || (type !== 'TEXT' && type !== 'CODE')) {
      setText(null)
      return
    }
    const controller = new AbortController()
    setLoadingText(true)
    setText(null)
    fetch(contentUrl, { signal: controller.signal })
      .then((response) => (response.ok ? response.text() : Promise.reject(response.status)))
      .then((value) => {
        if (!controller.signal.aborted) setText(value)
      })
      .catch(() => {
        if (!controller.signal.aborted) setText(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingText(false)
      })
    return () => controller.abort()
  }, [open, contentUrl, type, infoQuery.dataUpdatedAt])

  const title = fileName || info?.fileName || '附件'
  const close = (
    <div className="dlg__foot">
      {contentUrl ? (
        <a className="btn btn--quiet" href={downloadUrl(contentUrl)} download={title}>
          <Icon name="file" size={14} aria-hidden />
          下载
        </a>
      ) : null}
      <Button variant="primary" onClick={onClose}>
        关闭
      </Button>
    </div>
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={info ? `${typeLabel(type)} · ${formatSize(info.sizeBytes)}` : undefined}
    >
      {infoQuery.isPending ? <Skeleton rows={3} /> : null}
      {infoQuery.isError ? (
        <div className="block">
          <p className="h3">附件无法读取</p>
          <p className="sub">文件可能已被移除，或当前账号没有访问权限。</p>
          <Button variant="quiet" onClick={() => void infoQuery.refetch()}>
            重试
          </Button>
        </div>
      ) : null}
      {type === 'IMAGE' && contentUrl ? (
        <div className="dlg__body-image">
          <img src={contentUrl} alt={title} />
        </div>
      ) : null}
      {type === 'PDF' && contentUrl ? (
        <iframe className="dlg__frame" src={contentUrl} title={title} />
      ) : null}
      {type === 'TEXT' || type === 'CODE' ? (
        loadingText ? (
          <Skeleton rows={4} />
        ) : text !== null ? (
          <pre className="dlg__body-text">{text}</pre>
        ) : (
          <p className="note">无法加载文件内容。</p>
        )
      ) : null}
      {info && !info.previewable && type !== 'IMAGE' ? (
        <p className="note">这种文件不支持页内预览，可下载后查看。</p>
      ) : null}
      {close}
    </Dialog>
  )
}

function formatSize(bytes: number | null) {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
