import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type Tone = 'neutral' | 'role' | 'agent' | 'ok' | 'wait' | 'stop' | 'readonly'

/** 22px 胶囊状态标签。颜色永远和文字一起出现，不用颜色单独表意。 */
export function Tag({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: Tone
  icon?: IconName
  children: ReactNode
}) {
  return (
    <span className={`tag${tone === 'neutral' ? '' : ` tag--${tone}`}`}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  )
}
