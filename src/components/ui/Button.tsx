import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'quiet' | 'danger' | 'link'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm'
  block?: boolean
  icon?: ReactNode
}

/** 主按钮墨实心；次按钮白底细线；文字按钮只有朱砂色，没有框。 */
export function Button({
  variant,
  size,
  block,
  icon,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant ? `btn--${variant}` : '',
    size ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={classes} {...rest}>
      {icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  square?: boolean
  label: string
  children: ReactNode
}

/** 顶栏、列表行的方形小按钮；必须带可读 label。 */
export function IconButton({ square, label, className = '', children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`iconbtn${square ? ' iconbtn--square' : ''} ${className}`.trim()}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  )
}
