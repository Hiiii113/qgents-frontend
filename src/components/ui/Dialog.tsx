import { useEffect, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  danger?: boolean
}

/**
 * 原生 dialog：焦点圈定、Esc 关闭由浏览器负责，关闭后焦点自动回到触发按钮。
 * 内容自己决定是表单还是说明列表。
 */
export function Dialog({ open, onClose, title, description, children, danger }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  if (!open) return null
  return (
    <dialog
      ref={ref}
      className={`dlg${danger ? ' dlg--danger' : ''}`}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // 点击遮罩（dialog 本体而非内容）时关闭。
        if (event.target === ref.current) onClose()
      }}
    >
      <h2 className="h2">{title}</h2>
      {description ? <p className="sub">{description}</p> : null}
      {children}
    </dialog>
  )
}
