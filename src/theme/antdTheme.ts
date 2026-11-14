import type { ThemeConfig } from 'antd'
import { FONT_SANS, SHADOW, T } from './tokens'

/**
 * antd 主题：只服务 Form 校验、message 与少量基础控件。
 * 数值与 tokens.ts 同源；页面控件用 src/components/ui 的设计系统组件。
 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: T.mark,
    colorInfo: T.mark,
    colorSuccess: T.ok,
    colorWarning: T.wait,
    colorError: T.danger,
    colorText: T.ink900,
    colorTextSecondary: T.ink500,
    colorTextTertiary: T.ink400,
    colorTextQuaternary: T.ink300,
    colorTextPlaceholder: T.ink400,
    colorBorder: T.lineStrong,
    colorBorderSecondary: T.line,
    colorBgLayout: T.surface,
    colorBgContainer: T.surface,
    colorBgElevated: T.surface,
    colorBgSpotlight: T.ink900,
    colorFillQuaternary: T.surfaceSunken,
    colorLink: T.mark,
    borderRadius: 4,
    borderRadiusLG: 8,
    borderRadiusSM: 3,
    fontFamily: FONT_SANS,
    fontSize: 14,
    lineHeight: 1.55,
    controlHeight: 34,
    controlHeightSM: 28,
    controlHeightLG: 38,
    boxShadow: SHADOW,
    boxShadowSecondary: SHADOW,
    boxShadowTertiary: 'none',
    motionDurationFast: '120ms',
    motionDurationMid: '180ms',
    motionEaseOut: 'cubic-bezier(.2,.7,.2,1)',
  },
  components: {
    Checkbox: { borderRadiusSM: 3 },
    Form: {
      labelColor: T.ink700,
      labelFontSize: 13,
      verticalLabelPadding: '0 0 8px',
      itemMarginBottom: 16,
    },
  },
}
