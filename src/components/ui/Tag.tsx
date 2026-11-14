import type { ReactNode } from 'react'

type Tone = 'neutral' | 'role' | 'agent' | 'ok' | 'wait' | 'stop' | 'readonly'

/** 20px 状态标签。颜色永远和文字一起出现，不用颜色单独表意。 */
export function Tag({
  tone = 'neutral',
  children,
}: {
  tone?: Tone
  children: ReactNode
}) {
  return <span className={`tag${tone === 'neutral' ? '' : ` tag--${tone}`}`}>{children}</span>
}
