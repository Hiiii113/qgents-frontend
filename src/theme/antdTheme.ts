import type { ThemeConfig } from 'antd'
import { T } from './tokens'

/**
 * 品牌字体栈。Plus Jakarta Sans 不含汉字，必须把中文无衬线字体写在 generic sans-serif 之前，
 * 否则 Windows 会把卡片/按钮/标签里的中文回退成宋体或 Times。
 */
export const QG_FONT_FAMILY =
  "'Plus Jakarta Sans', 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', sans-serif"

/**
 * antd 主题：把组件外观压到与 DESIGN.md 一致的克制程度。
 * 不使用阴影、不使用大圆角、不使用渐变；强调色只出现在主要动作与选中态。
 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: T.accent,
    colorInfo: T.accent,
    colorSuccess: T.success,
    colorWarning: T.warning,
    colorError: T.danger,
    colorText: T.ink900,
    colorTextSecondary: T.ink500,
    colorTextTertiary: T.ink500,
    colorTextQuaternary: T.ink300,
    colorBorder: T.ruleStrong,
    colorBorderSecondary: T.rule,
    colorBgLayout: T.paper,
    colorBgContainer: T.paperRaised,
    colorBgElevated: T.paperRaised,
    colorFillQuaternary: T.paperSunken,
    borderRadius: 4,
    borderRadiusLG: 4,
    borderRadiusSM: 2,
    fontFamily: QG_FONT_FAMILY,
    fontSize: 14,
    lineHeight: 1.6,
    controlHeight: 34,
    controlHeightSM: 28,
    controlHeightLG: 40,
    boxShadow: 'none',
    boxShadowSecondary: 'none',
    boxShadowTertiary: 'none',
    wireframe: false,
    motionDurationFast: '120ms',
    motionDurationMid: '180ms',
    motionEaseOut: 'cubic-bezier(0.2, 0, 0, 1)',
  },
  components: {
    Card: { borderRadiusLG: 4, paddingLG: 24, boxShadowTertiary: 'none' },
    Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none', fontWeight: 500 },
    Table: { headerBg: T.paperSunken, borderColor: T.rule, headerSplitColor: T.rule, rowHoverBg: T.paperSunken },
    Modal: { contentBg: T.paperRaised, headerBg: T.paperRaised },
    Drawer: { colorBgElevated: T.paperRaised },
    Tag: { defaultBg: T.paperSunken, borderRadiusSM: 2 },
    Input: { activeShadow: 'none', hoverBorderColor: T.ink300 },
    Select: { optionSelectedBg: T.accentSoft },
    Menu: { itemSelectedBg: T.accentSoft, itemSelectedColor: T.accentStrong, itemBorderRadius: 2 },
    Tabs: { inkBarColor: T.accent, itemSelectedColor: T.ink900, itemColor: T.ink500 },
    Segmented: { itemSelectedBg: T.paperRaised, trackBg: T.paperSunken },
    Tooltip: { colorBgSpotlight: T.ink900 },
  },
}
