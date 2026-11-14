/**
 * 设计 token 单一来源 —— 「案头朱批」体系。
 *
 * 分三层：原始值（PRIMITIVES）→ 语义（T）→ CSS 变量（cssVars）。
 * 组件样式只引用 CSS 变量，页面不写死颜色、圆角、字号、间距。
 * 朱砂只标人的动作与所在位置，墨绿=完成，琥珀=等待，深红=不可逆。
 */

/** 原始色值。语义层从这里取，不在组件里直接使用。 */
const PRIMITIVES = {
  white: '#FFFFFF',
  gray50: '#FCFCFD',
  gray100: '#F6F7F8',
  gray150: '#EEF0F2',
  gray200: '#E3E6E9',
  gray300: '#CED4DA',
  gray400: '#9AA3AC',
  gray500: '#6E7780',
  gray600: '#59626B',
  gray700: '#333A41',
  gray900: '#14171A',
  red700: '#B03A2B',
  red800: '#8C2B1F',
  red050: '#F9EAE7',
  redLine: '#EFD8D3',
  green700: '#1F6B4A',
  green050: '#EAF3EE',
  amber700: '#8A5A00',
  amber050: '#F8F0DF',
  crimson700: '#A2261C',
  crimson800: '#8B1C14',
  crimson050: '#FBECEA',
  ink900: '#191D21',
  ink800: '#2B323A',
  black: '#000000',
} as const

/** 语义 token：按用途命名，不按明暗命名。 */
export const T = {
  // 面
  surface: PRIMITIVES.white,
  surfaceSoft: PRIMITIVES.gray100,
  surfaceSunken: PRIMITIVES.gray150,
  surfaceRail: PRIMITIVES.gray50,
  // 墨
  ink900: PRIMITIVES.gray900,
  ink700: PRIMITIVES.gray700,
  ink500: PRIMITIVES.gray600,
  ink400: PRIMITIVES.gray500,
  ink300: PRIMITIVES.gray400,
  // 线
  line: PRIMITIVES.gray200,
  lineStrong: PRIMITIVES.gray300,
  // 朱砂：只标记人的决定
  mark: PRIMITIVES.red700,
  markStrong: PRIMITIVES.red800,
  markSoft: PRIMITIVES.red050,
  markLine: PRIMITIVES.redLine,
  // 状态
  ok: PRIMITIVES.green700,
  okSoft: PRIMITIVES.green050,
  wait: PRIMITIVES.amber700,
  waitSoft: PRIMITIVES.amber050,
  danger: PRIMITIVES.crimson700,
  dangerStrong: PRIMITIVES.crimson800,
  dangerSoft: PRIMITIVES.crimson050,
  // 实心动作
  action: PRIMITIVES.ink900,
  actionHover: PRIMITIVES.ink800,
  onAction: PRIMITIVES.white,
} as const

/**
 * 品牌字体栈。Geist 不含汉字，中文回退必须写在 generic sans-serif 之前，
 * 否则 Windows 会用宋体画汉字。
 */
export const FONT_SANS =
  "'Geist', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif"

export const FONT_MONO =
  "'Geist Mono', ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, monospace"

/** 浮层与对话框唯一允许的阴影；页面本身不用阴影分层。 */
export const SHADOW = '0 12px 32px rgba(16, 20, 24, .12), 0 2px 6px rgba(16, 20, 24, .06)'

export const cssVars: Record<string, string> = {
  '--surface': T.surface,
  '--surface-soft': T.surfaceSoft,
  '--surface-sunken': T.surfaceSunken,
  '--surface-rail': T.surfaceRail,

  '--ink-900': T.ink900,
  '--ink-700': T.ink700,
  '--ink-500': T.ink500,
  '--ink-400': T.ink400,
  '--ink-300': T.ink300,

  '--line': T.line,
  '--line-strong': T.lineStrong,

  '--mark': T.mark,
  '--mark-strong': T.markStrong,
  '--mark-soft': T.markSoft,
  '--mark-line': T.markLine,

  '--ok': T.ok,
  '--ok-soft': T.okSoft,
  '--wait': T.wait,
  '--wait-soft': T.waitSoft,
  '--danger': T.danger,
  '--danger-strong': T.dangerStrong,
  '--danger-soft': T.dangerSoft,

  '--action': T.action,
  '--action-hover': T.actionHover,
  '--on-action': T.onAction,
  '--shadow': SHADOW,

  // 圆角：小件 3–4，控件 4，面板 6，对话框与头像 8，标签 3
  '--r-xs': '3px',
  '--r-sm': '4px',
  '--r-md': '6px',
  '--r-lg': '8px',
  '--r-pill': '999px',

  // 字号：正文 16，UI 14，最小 12
  '--t-xs': '12px',
  '--t-sm': '13px',
  '--t-ui': '14px',
  '--t-body': '16px',
  '--t-lead': '18px',
  '--t-h3': '20px',
  '--t-h2': '24px',
  '--t-h1': '30px',

  // 间距：4 的倍数
  '--s-1': '4px',
  '--s-2': '8px',
  '--s-3': '12px',
  '--s-4': '16px',
  '--s-5': '20px',
  '--s-6': '24px',
  '--s-8': '32px',
  '--s-10': '40px',

  '--ease': 'cubic-bezier(.2, .7, .2, 1)',
  '--d-fast': '120ms',
  '--d-base': '180ms',

  '--font': FONT_SANS,
  '--mono': FONT_MONO,
}

/** 在首屏渲染前把 token 写进 :root；antd 主题共用同一份数值。 */
export function applyDesignTokens() {
  const root = document.documentElement
  for (const [name, value] of Object.entries(cssVars)) root.style.setProperty(name, value)
}
