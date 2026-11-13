import type { ReactNode } from 'react'
import './ProjectPage.css'

/**
 * 项目工具页的紧凑页头。项目一级导航已经标出当前位置，
 * 这里只保留一个 20px 标题和主操作，避免每个工具页都重复大标题与介绍。
 */
export function ProjectPage({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="project-page">
      <header className="project-page__header">
        <h1 className="project-page__title">{title}</h1>
        {action && <div className="project-page__action">{action}</div>}
      </header>
      <hr className="qg-rule" />
      <div className="project-page__content">{children}</div>
    </section>
  )
}
