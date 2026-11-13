/**
 * 设计 token 单一来源。
 *
 * 数值只在这里定义一次：`applyDesignTokens()` 把它们写成 :root 的 CSS 变量，
 * antd 主题从同一份对象取值，页面 CSS 只引用变量名。页面里不写死颜色、圆角、间距。
 */
export const T = {
  // 墨：正文与结构
  ink900: '#111312',
  ink700: '#3A3D38',
  ink500: '#6B6F66',
  ink400: '#8B8F86',
  ink300: '#A8ACA3',
  // 纸：背景与容器
  paper: '#FAFAF7',
  paperRaised: '#FFFFFF',
  paperSunken: '#F2F2EC',
  // 分隔线：1px 发丝线是这套设计的主要"阴影"
  rule: '#E3E4DE',
  ruleStrong: '#C9CBC2',
  // 唯一强调色（品牌绿）；其余状态色一律低饱和
  accent: '#4F7146',
  accentStrong: '#3F5C38',
  accentSoft: '#EDF1E9',
  success: '#2F7A4F',
  warning: '#8A5A00',
  danger: '#B3261E',
} as const

export const cssVars: Record<string, string> = {
  '--ink-900': T.ink900,
  '--ink-700': T.ink700,
  '--ink-500': T.ink500,
  '--ink-400': T.ink400,
  '--ink-300': T.ink300,
  '--paper': T.paper,
  '--paper-raised': T.paperRaised,
  '--paper-sunken': T.paperSunken,
  '--rule': T.rule,
  '--rule-strong': T.ruleStrong,
  '--accent': T.accent,
  '--accent-strong': T.accentStrong,
  '--accent-soft': T.accentSoft,
  '--success': T.success,
  '--warning': T.warning,
  '--danger': T.danger,

  // 间距：4 的倍数，页面只用这些档位
  '--space-1': '4px',
  '--space-2': '8px',
  '--space-3': '12px',
  '--space-4': '16px',
  '--space-6': '24px',
  '--space-8': '32px',
  '--space-12': '48px',
  '--space-16': '64px',
  '--space-24': '96px',

  // 圆角：2/4px 为主，只有标签用 pill；聊天气泡单独放宽
  '--radius-s': '2px',
  '--radius-m': '4px',
  '--radius-pill': '999px',
  '--radius-avatar': '8px',
  '--radius-bubble': '14px',
  '--radius-inset': '10px',
  '--radius-card': '12px',

  // 字号：正文 14px 起，最小可用字号 12px
  '--text-xs': '12px',
  '--text-sm': '13px',
  '--text-base': '14px',
  '--text-lead': '16px',
  '--text-h3': '20px',
  '--text-h2': '26px',
  '--text-h1': '34px',
  '--text-display': 'clamp(28px, 3.4vw, 44px)',

  // 等宽字体：代码块、行内代码与代码类消息
  '--font-mono': "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace",

  // 动效：短、克制、只动不透明度与颜色
  '--ease': 'cubic-bezier(0.2, 0, 0, 1)',
  '--dur-fast': '120ms',
  '--dur-base': '180ms',
  '--dur-slow': '240ms',
}

/** 在首次渲染前把 token 写进 :root；与 antd 主题共用同一份数值。 */
export function applyDesignTokens() {
  const root = document.documentElement
  for (const [name, value] of Object.entries(cssVars)) root.style.setProperty(name, value)
}
