import type { SVGProps } from 'react'

/** 全站图标：原型同款描边集合，统一 1.5px 线宽。 */
const PATHS = {
  chat: <path d="M4 5.5h16v10H9l-5 4z" />,
  agent: (
    <>
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <path d="M12 3v4M8.5 13v1.5M15.5 13v1.5" />
    </>
  ),
  book: <path d="M5 4h9a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM19 6v14" />,
  skill: <path d="M12 3l2.2 5.3 5.8.5-4.4 3.8 1.3 5.7L12 15.5 7.1 18.3l1.3-5.7L4 8.8l5.8-.5z" />,
  repo: (
    <>
      <path d="M6 4v13M6 17h12M18 17V9M6 8h6a3 3 0 0 0 3-3V4" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="6.5" r="2" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2.5h-15z" />
      <path d="M10 21h4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5L20 20" />
    </>
  ),
  chevron: <path d="M7 10l5 5 5-5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  people: (
    <>
      <circle cx="9" cy="9" r="3" />
      <path d="M4 19c0-3 2.5-4.5 5-4.5s5 1.5 5 4.5" />
      <path d="M16 7.5a2.8 2.8 0 0 1 0 5.5M17.5 14.8c1.6.5 2.5 1.9 2.5 4.2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  file: (
    <>
      <path d="M6 3h7l5 5v13H6z" />
      <path d="M13 3v5h5" />
    </>
  ),
  branch: (
    <>
      <circle cx="7" cy="5" r="2" />
      <circle cx="7" cy="19" r="2" />
      <circle cx="17" cy="9" r="2" />
      <path d="M7 7v10M17 11c0 4-4 3.5-6.5 5" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13l2.3-6.2A2 2 0 0 1 8.2 5.5h7.6a2 2 0 0 1 1.9 1.3L20 13v5.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M4 13h4.5l1 2.2h5l1-2.2H20" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.6-5.7" />
      <path d="M19.8 4.5v4.2h-4.2" />
    </>
  ),
  send: (
    <>
      <path d="M12 19V6" />
      <path d="M6.5 11.5L12 6l5.5 5.5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.5l8.3 14.5H3.7z" />
      <path d="M12 9.5v4" />
      <path d="M12 16.6v.4" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V5h5v2" />
      <path d="M6.5 7l1 12h9l1-12" />
    </>
  ),
  activity: <path d="M3 12h3.5L9 5.5l4 13 2.5-6.5H21" />,
  unlink: (
    <>
      <path d="M9.5 14.5L8 16a3.5 3.5 0 0 1-5-5l2.5-2.5" />
      <path d="M14.5 9.5L16 8a3.5 3.5 0 0 1 5 5l-2.5 2.5" />
      <path d="M4 4l16 16" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M4 4l16 16" />
    </>
  ),
  logout: (
    <>
      <path d="M9 4H5v16h4" />
      <path d="M14 8l4 4-4 4M18 12H9" />
    </>
  ),
  paperclip: <path d="M8 12.5l6.2-6.2a2.8 2.8 0 0 1 4 4L10 18.5a4 4 0 0 1-5.7-5.7l7.8-7.8" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  camera: (
    <>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.2-1.8A1 1 0 0 1 10.5 4h3a1 1 0 0 1 .8.4L15.5 6h2A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
} as const

export type IconName = keyof typeof PATHS

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
}

/** 用内联 symbol 引用，图标定义只出现一次。 */
export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg className="od-icon" style={{ '--od-icon-size': `${size}px` } as never} {...rest}>
      <use href={`#i-${name}`} />
    </svg>
  )
}

/** 图标定义挂在应用根部；页面不重复渲染。 */
export function IconSprite() {
  return (
    <svg className="sprite" width="0" height="0" aria-hidden focusable="false">
      {Object.entries(PATHS).map(([name, path]) => (
        <symbol key={name} id={`i-${name}`} viewBox="0 0 24 24">
          {path}
        </symbol>
      ))}
    </svg>
  )
}

/** 品牌标记：墨环 + 朱砂点。 */
export function Mark({ large = false }: { large?: boolean }) {
  return (
    <span className={`mark${large ? ' mark--lg' : ''}`} aria-hidden>
      <svg viewBox="0 0 32 32" className="mark__svg">
        <circle
          cx="15"
          cy="15"
          r="8.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={large ? 2.6 : 3}
        />
        <circle cx="26" cy="26" r={large ? 3.4 : 3.6} fill="var(--mark)" />
      </svg>
    </span>
  )
}
