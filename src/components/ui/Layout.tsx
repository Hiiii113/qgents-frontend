import { useEffect, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

/** 页面画布：统一的左右留白与最大宽度。 */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`view ${className}`.trim()}>{children}</div>
}

interface PageHeadProps {
  kicker?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  aside?: ReactNode
}

export function PageHead({ kicker, title, description, actions, aside }: PageHeadProps) {
  return (
    <header className="pagehead">
      <div>
        {kicker ? <p className="kicker">{kicker}</p> : null}
        <h1 className="h1">{title}</h1>
        {description ? <p className="sub">{description}</p> : null}
      </div>
      {actions ? <div className="pagehead__actions">{actions}</div> : null}
      {aside}
    </header>
  )
}

interface SectionProps {
  title?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
}

export function Section({ title, aside, children, className = '' }: SectionProps) {
  return (
    <section className={`section ${className}`.trim()}>
      {title || aside ? (
        <div className="section__head">
          {typeof title === 'string' ? <h2 className="h2">{title}</h2> : title}
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  )
}

interface EmptyStateProps {
  icon?: IconName
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  stacked?: boolean
}

/** 一句话空态，贴着它替代的列表位置，不画空盒子。 */
export function EmptyState({ icon, title, description, action, stacked }: EmptyStateProps) {
  return (
    <div className={stacked ? 'empty empty--stacked' : 'empty'}>
      {icon ? <Icon name={icon} /> : null}
      <div>
        {title ? <p className={stacked ? 'row-empty__title' : undefined}>{title}</p> : null}
        {description ? (
          <p className={stacked ? 'row-empty__desc' : 'meta'}>{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  // 300ms 内返回的请求不闪骨架；再慢才出现。
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 300)
    return () => window.clearTimeout(timer)
  }, [])
  if (!visible) return null
  return (
    <div className="sk" role="status" aria-label="正在加载">
      <div className="sk__bar sk__bar--title" />
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={`sk__bar${index % 3 === 1 ? ' sk__bar--short' : ''}${index % 4 === 3 ? ' sk__bar--tiny' : ''}`}
        />
      ))}
    </div>
  )
}
