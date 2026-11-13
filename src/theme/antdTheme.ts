import type { ThemeConfig } from 'antd'
import { FONT_SANS, T } from './tokens'

/**
 * antd 主题：数值与 tokens.ts 同源。控件用深墨主色，圆角 10px，
 * 强调色只出现在主要动作与选中态，state 色只表示状态。
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
    colorTextTertiary: T.ink400,
    colorTextQuaternary: T.ink300,
    colorBorder: T.ruleStrong,
    colorBorderSecondary: T.rule,
    colorBgLayout: T.paper,
    colorBgContainer: T.paperRaised,
    colorBgElevated: T.paperRaised,
    colorFillQuaternary: T.paperSunken,
    borderRadius: 10,
    borderRadiusLG: 14,
    borderRadiusSM: 8,
    fontFamily: FONT_SANS,
    fontSize: 14,
    lineHeight: 1.6,
    controlHeight: 36,
    controlHeightSM: 30,
    controlHeightLG: 42,
    boxShadow: 'none',
    boxShadowSecondary: 'none',
    boxShadowTertiary: 'none',
    wireframe: false,
    motionDurationFast: '120ms',
    motionDurationMid: '180ms',
    motionEaseOut: 'cubic-bezier(0.2, 0, 0, 1)',
  },
  components: {
    Card: { borderRadiusLG: 14, paddingLG: 24, boxShadowTertiary: 'none' },
    Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none', fontWeight: 500 },
    Table: {
      headerBg: T.paperSunken,
      borderColor: T.rule,
      headerSplitColor: T.rule,
      rowHoverBg: T.paperSunken,
    },
    Modal: { contentBg: T.paperRaised, headerBg: T.paperRaised },
    Drawer: { colorBgElevated: T.paperRaised },
    Tag: { defaultBg: T.paperSunken, borderRadiusSM: 6 },
    Input: { activeShadow: 'none', hoverBorderColor: T.ink300 },
    Select: { optionSelectedBg: T.accentSoft },
    Menu: { itemSelectedBg: T.accentSoft, itemSelectedColor: T.accentStrong, itemBorderRadius: 8 },
    Tabs: { inkBarColor: T.accent, itemSelectedColor: T.ink900, itemColor: T.ink500 },
    // 表单规则集中在这里，页面不必再各写一份 label / 间距 / 错误字号。
    Form: {
      labelColor: T.ink700,
      labelFontSize: 13,
      verticalLabelPadding: '0 0 6px',
      itemMarginBottom: 16,
    },
    Segmented: {
      trackBg: T.paperSunken,
      itemColor: T.ink500,
      itemHoverColor: T.ink900,
      itemSelectedBg: T.paperRaised,
      itemSelectedColor: T.ink900,
    },
    Tooltip: { colorBgSpotlight: T.ink900 },
  },
}
