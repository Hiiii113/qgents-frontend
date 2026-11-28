import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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

const ZOOM_STEPS = [1, 1.5, 2] as const

/**
 * 附件预览：图片采用全屏沉浸式大图 Lightbox（支持缩放、原图查看与下载）；
 * PDF / 代码 / 文本使用简洁弹窗预览，所有类型均支持下载。
 */
export function AttachmentPreview({
  open,
  projectId,
  attachmentId,
  fileName,
  isImage = false,
  onClose,
}: {
  open: boolean
  projectId: string
  attachmentId: string
  fileName?: string
  isImage?: boolean
  onClose: () => void
}) {
  const [text, setText] = useState<string | null>(null)
  const [loadingText, setLoadingText] = useState(false)
  const [zoomIndex, setZoomIndex] = useState(0)

  useEffect(() => {
    setZoomIndex(0)
  }, [open, attachmentId])

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
  const showLightbox = open && (type === 'IMAGE' || (isImage && !infoQuery.isError))

  useEffect(() => {
    if (!showLightbox) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === '+' || event.key === '=') {
        setZoomIndex((current) => Math.min(current + 1, ZOOM_STEPS.length - 1))
      } else if (event.key === '-') {
        setZoomIndex((current) => Math.max(current - 1, 0))
      } else if (event.key === '0') {
        setZoomIndex(0)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showLightbox, onClose])

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
  const scale = ZOOM_STEPS[zoomIndex]
  const zoomed = zoomIndex > 0

  if (showLightbox) {
    return createPortal(
      <div
        className="lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={`查看图片：${title}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <div className="lightbox__top">
          <div className="lightbox__meta">
            <span className="lightbox__name" title={title}>
              {title}
            </span>
            {info?.sizeBytes != null ? (
              <span className="lightbox__size mono">{formatSize(info.sizeBytes)}</span>
            ) : null}
          </div>
          <button
            type="button"
            className="lightbox__close"
            aria-label="关闭图片预览"
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div
          className={`lightbox__stage${zoomed ? ' is-zoomed' : ''}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          {infoQuery.isPending || !contentUrl ? (
            <div className="lightbox__loading">正在加载原图…</div>
          ) : (
            <img
              className="lightbox__img"
              src={contentUrl}
              alt={title}
              style={zoomed ? { transform: `scale(${scale})` } : undefined}
              onClick={() => setZoomIndex((current) => (current + 1) % ZOOM_STEPS.length)}
            />
          )}
        </div>

        <div className="lightbox__bar">
          <button
            type="button"
            className="lightbox__btn"
            disabled={zoomIndex === 0 || !contentUrl}
            aria-label="缩小"
            onClick={() => setZoomIndex((current) => Math.max(current - 1, 0))}
          >
            缩小
          </button>
          <span className="lightbox__zoom mono">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className="lightbox__btn"
            disabled={zoomIndex === ZOOM_STEPS.length - 1 || !contentUrl}
            aria-label="放大"
            onClick={() => setZoomIndex((current) => Math.min(current + 1, ZOOM_STEPS.length - 1))}
          >
            放大
          </button>
          <span className="lightbox__sep" aria-hidden />
          {contentUrl ? (
            <>
              <a
                className="lightbox__btn"
                href={contentUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                <Icon name="external" size={14} aria-hidden />
                新窗口打开
              </a>
              <a className="lightbox__btn lightbox__btn--primary" href={downloadUrl(contentUrl)} download={title}>
                <Icon name="file" size={14} aria-hidden />
                下载
              </a>
            </>
          ) : null}
        </div>
      </div>,
      document.body,
    )
  }

  const close = (
    <div className="dlg__foot">
      {contentUrl ? (
        <a className="btn btn--quiet" href={downloadUrl(contentUrl)} download={title}>
          <Icon name="file" size={14} aria-hidden />
          下载
        </a>
      ) : null}
      <Button variant="primary" onClick={onClose} icon={<Icon name="close" size={15} />}>
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
          <Button
            variant="quiet"
            onClick={() => void infoQuery.refetch()}
            icon={<Icon name="refresh" size={15} />}
          >
            重试
          </Button>
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
  if (bytes === null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
