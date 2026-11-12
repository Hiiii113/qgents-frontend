import type { ReactNode } from 'react'
import './EmptyState.css'

interface EmptyStateProps {
  /** 主标题 */
  title?: string
  /** 副标题说明 */
  description?: string
  /** 操作按钮区域 */
  action?: ReactNode
}

/**
 * 空状态占位 —— 列表/搜索无结果等场景复用。
 * 不用插画与图标，一行说明 + 一个主按钮即可。
 */
export function EmptyState({ title = '暂无数据', description, action }: EmptyStateProps) {
  return (
    <div className="qg-empty">
      <p className="qg-empty__title">{title}</p>
      {description != null && <p className="qg-empty__description">{description}</p>}
      {action != null && <div className="qg-empty__action">{action}</div>}
    </div>
  )
}
