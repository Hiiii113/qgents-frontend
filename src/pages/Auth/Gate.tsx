import type { ReactNode } from 'react'
import { Mark } from '@/components/ui'
import './gate.css'

/** 登录/注册类页面的左侧品牌栏：纯排版，一行一条协作方式。 */
export function GateAside({
  kicker,
  title = '团队与 Qgent，在同一个项目现场协作',
  description,
  rows = true,
}: {
  kicker?: string
  title?: string
  description?: ReactNode
  rows?: boolean
}) {
  return (
    <aside className="gate__aside">
      <div className="gate__brand">
        <Mark />
        <p className="gate__wordmark">Qgents</p>
      </div>
      {kicker ? <p className="gate__kicker">{kicker}</p> : null}
      <h2 className={kicker ? 'gate__side-title' : 'gate__statement'}>{title}</h2>
      {description ? <p className="sub">{description}</p> : null}
      {rows ? (
        <div className="gate__rows">
          <div className="gate__row">
            <p className="gate__row-title">从项目聊天开始</p>
            <p className="gate__row-desc">成员共同讨论，@Qgent 协助分析与执行</p>
          </div>
          <div className="gate__row">
            <p className="gate__row-title">按需使用 Qgent</p>
            <p className="gate__row-desc">在群聊中 @Qgent 发起协作，保留上下文与成果</p>
          </div>
          <div className="gate__row">
            <p className="gate__row-title">产出进入 GitHub</p>
            <p className="gate__row-desc">执行完成后推送分支到仓库，在群聊里审阅与合并</p>
          </div>
        </div>
      ) : null}
    </aside>
  )
}

export function GateForm({ children }: { children: ReactNode }) {
  return <div className="gate__form">{children}</div>
}

export function Gate({ children }: { children: ReactNode }) {
  return <div className="gate">{children}</div>
}
