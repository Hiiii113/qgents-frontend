import type { ReactNode } from 'react'
import { Icon, Mark } from '@/components/ui'
import './gate.css'

/**
 * 登录、注册与团队入口共用的双栏外壳。
 * 左侧是浅色工作台陈列：品牌、标题，以及一张纯 HTML/CSS 画出的
 * Qgent 协作预览（提问 → 工具执行 → PR 合并）；右侧是表单卡。
 */
export function GateAside({
  kicker,
  title = '团队与 Qgent，在同一个项目现场协作',
}: {
  kicker?: string
  title?: string
}) {
  return (
    <aside className="gate__aside">
      <div className="gate__stage">
        <div className="gate__brand">
          <Mark />
          <p className="gate__wordmark">Qgents</p>
        </div>
        <div className="gate__pitch">
          {kicker ? <p className="gate__kicker">{kicker}</p> : null}
          <h2 className="gate__statement">{title}</h2>
        </div>
        <StudioPreview />
      </div>
    </aside>
  )
}

/** 微型工作台预览：不接数据，只用排版表达一次完整的协作。 */
function StudioPreview() {
  return (
    <div
      className="studio"
      role="img"
      aria-label="Qgent 在项目群聊里执行任务：@Qgent 修掉登录页对比度问题，读取文件、改写三个文件，最后合并 PR #42"
    >
      <div className="studio__bar" aria-hidden>
        <span className="studio__repo">砺行科技 / 官网改版</span>
      </div>
      <div className="studio__body" aria-hidden>
        <div className="studio__ask">
          <span className="studio__avatar">何</span>
          <p className="studio__bubble">
            <span className="studio__mention">@Qgent</span> 修掉登录页的对比度问题，然后提个 PR
          </p>
        </div>

        <div className="studio__run">
          <p className="studio__run-head">
            <Icon name="sparkles" size={13} />
            <span>Qgent</span>
            <span className="studio__run-state">运行中</span>
            <span className="studio__run-steps">3 步</span>
          </p>
          <ol className="studio__tools">
            <li>
              <Icon name="check" size={12} />
              <span className="studio__tool-name">读取 gate.css</span>
              <b className="studio__tool-meta">0.2s</b>
            </li>
            <li>
              <Icon name="check" size={12} />
              <span className="studio__tool-name">改写 3 个文件</span>
              <b className="studio__tool-meta studio__diff">+42 −18</b>
            </li>
            <li className="studio__tools--live">
              <i className="dot dot--halt" />
              <span className="studio__tool-name">运行视觉回归</span>
              <b className="studio__tool-meta">…</b>
            </li>
          </ol>
        </div>

        <div className="studio__pr">
          <span className="studio__pr-icon">
            <Icon name="branch" size={13} />
          </span>
          <span className="studio__pr-name">
            PR <b className="mono">#42</b>
          </span>
          <span className="studio__pr-state">已合并</span>
        </div>
      </div>
    </div>
  )
}

/** 表单卡：右侧唯一的容器，标题与表单共用同一条内边距。 */
export function GateForm({ children }: { children: ReactNode }) {
  return (
    <div className="gate__form">
      <div className="gate__card">{children}</div>
    </div>
  )
}

export function Gate({ children }: { children: ReactNode }) {
  return <div className="gate">{children}</div>
}
