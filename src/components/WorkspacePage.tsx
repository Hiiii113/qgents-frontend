import type { ReactNode } from 'react'
import './WorkspacePage.css'

/**
 * 工作区页面骨架。大标题 + 一句说明 + 一条发丝线，内容区固定节奏。
 * 页面不自己写 padding 和标题层级，避免每页一套留白。
 */
export function WorkspacePage({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="workspace-page">
      <header className="workspace-page__header">
        <div className="workspace-page__heading">
          <h1 className="workspace-page__title">{title}</h1>
          {description && <p className="workspace-page__description">{description}</p>}
        </div>
        {action && <div className="workspace-page__action">{action}</div>}
      </header>
      <hr className="qg-rule workspace-page__rule" />
      <div className="workspace-page__content">{children}</div>
    </section>
  )
}
