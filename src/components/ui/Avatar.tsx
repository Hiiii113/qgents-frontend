import { Mark } from './Icon'

interface AvatarProps {
  name: string
  src?: string | null
  /** Agent 用品牌标记，人用首字。 */
  type?: 'user' | 'agent'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/** 32px 方形头像；Agent 始终用品牌标记，不用首字母。 */
export function Avatar({ name, src, type = 'user', size = 'md', className = '' }: AvatarProps) {
  const classes = [
    'avatar',
    size === 'sm' ? 'avatar--sm' : '',
    size === 'lg' ? 'avatar--lg' : '',
    type === 'agent' ? 'avatar--agent' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  if (type === 'agent') {
    return (
      <span className={classes} title={name}>
        <Mark />
      </span>
    )
  }
  return (
    <span className={classes} title={name}>
      {src ? <img src={src} alt={name} /> : name.trim().slice(0, 1) || '?'}
    </span>
  )
}
