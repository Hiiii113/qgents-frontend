/**
 * 设计 token 单一来源。
 *
 * 数值只在这里定义一次：`applyDesignTokens()` 把它们写成 :root 的 CSS 变量，
 * antd 主题从同一份对象取值，页面 CSS 只引用变量名。页面里不写死颜色、圆角、间距。
 *
 * 变量按语义命名（面 / 墨 / 线 / 状态），不按明暗命名：后续加深色主题时只换值，
 * 不换结构，页面不用改一行。
 */
/**
 * 品牌字体栈。Geist 不含汉字，必须把中文无衬线字体写在 generic sans-serif 之前，
 * 否则 Windows 会把中文回退成宋体。antd 主题与 CSS 变量共用同一串。
 */
export const FONT_SANS =
  "Geist, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', sans-serif"

export const T = {
  // 墨：正文与结构
  ink900: '#16181A',
  ink700: '#3A4046',
  ink500: '#5E666D',
  ink400: '#68717A',
  ink300: '#A7AEB3',
  // 面：页面底、容器、凹陷区
  paper: '#FAFAF9',
  paperRaised: '#FFFFFF',
  paperSunken: '#F4F6F6',
  // 线：只作行界，不做装饰
  rule: '#EDEFF0',
  ruleStrong: '#DDE1E3',
  // 牌头带：深墨横贯顶栏，承担「你在哪个团队、哪个项目」
  band: '#14202B',
  bandInk: '#F4F6F7',
  bandInkMuted: '#B9C2C8',
  // 强调：牌头同族的蓝，只出现在主要动作与选中态
  accent: '#2A5D8F',
  accentStrong: '#1E4770',
  accentSoft: '#EAF1F7',
  // 状态：琥珀只表示变更/进行中，红只表示失败或叫停，完成用墨
  success: '#0F7A6B',
  warning: '#8A5200',
  danger: '#A32020',
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
  '--band': T.band,
  '--band-ink': T.bandInk,
  '--band-ink-muted': T.bandInkMuted,
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

  // 圆角：控件 10–14px，只有标签用 pill
  '--radius-s': '8px',
  '--radius-m': '10px',
  '--radius-pill': '999px',
  '--radius-avatar': '10px',
  '--radius-bubble': '14px',
  '--radius-inset': '10px',
  '--radius-card': '14px',

  // 字号：正文 16px，控件 14px，最小可用字号 12px
  '--text-xs': '12px',
  '--text-sm': '13px',
  '--text-ui': '14px',
  '--text-base': '16px',
  '--text-lead': '18px',
  '--text-h3': '20px',
  '--text-h2': '26px',
  '--text-h1': '32px',
  '--text-display': 'clamp(30px, 3.2vw, 42px)',

  '--qg-font': FONT_SANS,

  // 等宽字体：时间、序号、代码 —— 出发板的数字列靠它对齐
  '--font-mono': "'Geist Mono', ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, monospace",

  // 动效：短、克制，只动不透明度与颜色
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
