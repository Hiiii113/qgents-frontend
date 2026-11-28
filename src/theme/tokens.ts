/**
 * 设计 token 单一来源 —— 极简中性桌面工作台（对标 Proma / Linear / Claude Desktop：
 * 纯净中性灰、低透明头发丝细线、克制低饱和强调色、去多余边框）。
 *
 * 分三层：原始值（PRIMITIVES）→ 语义（T）→ CSS 变量（cssVars）。
 */

const PRIMITIVES = {
  white: '#FFFFFF',
  zinc50: '#FAFAFA',
  zinc75: '#F7F7F8',
  zinc100: '#F2F2F4',
  zinc300: '#D4D4D8',
  zinc400: '#A1A1AA',
  zinc500: '#71717A',
  zinc600: '#52525B',
  zinc700: '#3F3F46',
  zinc800: '#27272A',
  zinc900: '#18181B',
  hairline: 'rgba(24, 24, 27, 0.075)',
  hairlineStrong: 'rgba(24, 24, 27, 0.13)',
  accent: '#27272A',
  accentStrong: '#18181B',
  accentSoft: 'rgba(24, 24, 27, 0.055)',
  accentLine: 'rgba(24, 24, 27, 0.14)',
  green: '#16794B',
  greenSoft: 'rgba(22, 121, 75, 0.08)',
  amber: '#A16207',
  amberSoft: 'rgba(161, 98, 7, 0.08)',
  red: '#C83737',
  redStrong: '#A82A2A',
  redSoft: 'rgba(200, 55, 55, 0.08)',
} as const

export const T = {
  // 面
  surface: PRIMITIVES.white,
  surfaceSoft: PRIMITIVES.zinc50,
  surfaceElevated: PRIMITIVES.white,
  surfaceSunken: PRIMITIVES.zinc100,
  surfaceRail: PRIMITIVES.zinc75,
  // 墨（保证正文与次级标签 >= 4.5:1 对比度）
  ink900: PRIMITIVES.zinc900,
  ink700: PRIMITIVES.zinc700,
  ink500: PRIMITIVES.zinc600,
  ink400: PRIMITIVES.zinc500,
  ink300: PRIMITIVES.zinc400,
  // 线：低透明头发丝细线
  line: PRIMITIVES.hairline,
  lineStrong: PRIMITIVES.hairlineStrong,
  // 焦点与链接：低饱和石板蓝，不铺大面积
  mark: PRIMITIVES.accent,
  markStrong: PRIMITIVES.accentStrong,
  markSoft: PRIMITIVES.accentSoft,
  markLine: PRIMITIVES.accentLine,
  // 语义状态：柔化降饱和
  ok: PRIMITIVES.green,
  okSoft: PRIMITIVES.greenSoft,
  wait: PRIMITIVES.amber,
  waitSoft: PRIMITIVES.amberSoft,
  danger: PRIMITIVES.red,
  dangerStrong: PRIMITIVES.redStrong,
  dangerSoft: PRIMITIVES.redSoft,
  // 实心主动作
  action: PRIMITIVES.zinc900,
  actionHover: PRIMITIVES.zinc800,
  onAction: PRIMITIVES.white,
} as const

export const FONT_SANS =
  "'Geist Sans', 'Noto Sans SC Variable', 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei UI', system-ui, sans-serif"

export const FONT_MONO =
  "'Geist Mono', ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, 'Noto Sans SC Variable', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei UI', monospace"

/** 浮层与对话框使用极轻中性弥散投影；主体靠浅底面与低透明细线分层。 */
export const SHADOW = '0 12px 32px rgba(24, 24, 27, 0.07), 0 2px 6px rgba(24, 24, 27, 0.03)'
export const SHADOW_SM = '0 1px 2px rgba(24, 24, 27, 0.04)'

export const cssVars: Record<string, string> = {
  '--surface': T.surface,
  '--surface-soft': T.surfaceSoft,
  '--surface-elevated': T.surfaceElevated,
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
  '--shadow-sm': SHADOW_SM,
  '--scrim': 'rgba(24, 24, 27, 0.24)',

  // 圆角：现代柔和几何
  '--r-xs': '4px',
  '--r-sm': '6px',
  '--r-md': '8px',
  '--r-lg': '12px',
  '--r-pill': '999px',

  // 字号：正文 15，UI 14，页面主标题收敛到 22px 保持桌面工作台精致感
  '--t-xs': '12px',
  '--t-sm': '13px',
  '--t-ui': '14px',
  '--t-body': '15px',
  '--t-lead': '17px',
  '--t-h3': '18px',
  '--t-h2': '20px',
  '--t-h1': '22px',

  // 间距：4 的倍数
  '--s-1': '4px',
  '--s-2': '8px',
  '--s-3': '12px',
  '--s-4': '16px',
  '--s-5': '20px',
  '--s-6': '24px',
  '--s-8': '32px',
  '--s-10': '40px',

  '--ease': 'cubic-bezier(0.2, 0.7, 0.2, 1)',
  '--d-fast': '120ms',
  '--d-base': '180ms',

  '--font': FONT_SANS,
  '--mono': FONT_MONO,
}

export function applyDesignTokens(): void {
  const root = document.documentElement
  for (const [name, value] of Object.entries(cssVars)) {
    root.style.setProperty(name, value)
  }
}
