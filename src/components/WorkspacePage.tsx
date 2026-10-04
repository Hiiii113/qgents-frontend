import type { ReactNode } from 'react'
import './WorkspacePage.css'

export function WorkspacePage({ title, description, action, children }: {
  title: string; description: string; action?: ReactNode; children: ReactNode
}) {
  return <section className="workspace-page"><header className="workspace-page__header"><div>
    <span className="workspace-page__eyebrow">协作空间</span><h1>{title}</h1><p>{description}</p>
  </div>{action && <div className="workspace-page__action">{action}</div>}</header>
    <div className="workspace-page__content">{children}</div>
  </section>
}
