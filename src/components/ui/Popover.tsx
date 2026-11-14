import { useEffect, useRef, type ReactNode } from 'react'

interface PopoverProps {
  open: boolean
  onClose: () => void
  label: string
  align?: 'start' | 'end'
  className?: string
  children: ReactNode
}

/**
 * 锚在触发按钮下方的小浮层。点击浮层外或按 Esc 关闭；
 * 点击触发按钮本身不在这里处理，交给按钮切换开关。
 */
export function Popover({
  open,
  onClose,
  label,
  align = 'end',
  className = '',
  children,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (ref.current?.contains(target)) return
      // 触发按钮在同一个锚点容器里：让按钮自己的 onClick 负责切换。
      if (ref.current?.parentElement?.contains(target)) return
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      ref={ref}
      className={`popover popover--${align} ${className}`.trim()}
      role="dialog"
      aria-modal="false"
      aria-label={label}
    >
      {children}
    </div>
  )
}
