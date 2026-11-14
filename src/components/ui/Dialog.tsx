import { useEffect, useId, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  danger?: boolean
}

/**
 * 原生 dialog：焦点圈定、Esc 关闭、关闭后焦点回到触发按钮都由浏览器负责。
 * 组件常驻挂载，只切换内容：卸载 dialog 会丢掉原生焦点归还。
 */
export function Dialog({ open, onClose, title, description, children, danger }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) {
        restoreRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
        dialog.showModal()
      }
      return
    }
    if (dialog.open) dialog.close()
    const target = restoreRef.current
    if (target?.isConnected) target.focus()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`dlg${danger ? ' dlg--danger' : ''}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // 点击遮罩（dialog 本体而非内容）时关闭。
        if (event.target === ref.current) onClose()
      }}
    >
      {open ? (
        <>
          <h2 className="h2" id={titleId}>
            {title}
          </h2>
          {description ? (
            <p className="sub" id={descriptionId}>
              {description}
            </p>
          ) : null}
          {children}
        </>
      ) : null}
    </dialog>
  )
}
