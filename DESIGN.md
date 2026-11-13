---
name: Qgents
description: 团队协作的云端 Agent 工作台：深墨牌头带、中性纸面、同族蓝强调的 Operate 界面。
colors:
  ink-900: '#16181A'
  ink-700: '#3A4046'
  ink-500: '#5E666D'
  ink-400: '#68717A'
  ink-300: '#A7AEB3'
  paper: '#FAFAF9'
  paper-raised: '#FFFFFF'
  paper-sunken: '#F4F6F6'
  rule: '#EDEFF0'
  rule-strong: '#DDE1E3'
  band: '#14202B'
  band-ink: '#F4F6F7'
  band-ink-muted: '#B9C2C8'
  band-ink-strong: '#FFFFFF'
  accent: '#2A5D8F'
  accent-strong: '#1E4770'
  accent-soft: '#EAF1F7'
  success: '#0F7A6B'
  warning: '#8A5200'
  danger: '#A32020'
typography:
  display:
    fontFamily: "Geist, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', sans-serif"
    fontSize: '32px'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '-0.02em'
  title:
    fontFamily: "Geist, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: '20px'
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: '-0.02em'
  body:
    fontFamily: "Geist, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: '16px'
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: "Geist, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: '13px'
    fontWeight: 400
    lineHeight: 1.6
  meta:
    fontFamily: "'Geist Mono', ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, monospace"
    fontSize: '12px'
    fontWeight: 400
    lineHeight: 1.5
rounded:
  s: '8px'
  m: '10px'
  card: '14px'
  bubble: '14px'
  avatar: '10px'
  tag: '6px'
  checkbox: '4px'
  pill: '999px'
spacing:
  space-1: '4px'
  space-2: '8px'
  space-3: '12px'
  space-4: '16px'
  space-6: '24px'
  space-8: '32px'
  space-12: '48px'
  space-16: '64px'
  space-24: '96px'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.paper-raised}'
    typography: '{typography.label}'
    rounded: '{rounded.m}'
    height: '36px'
    padding: '0 16px'
  button-primary-hover:
    backgroundColor: '{colors.accent-strong}'
    textColor: '{colors.paper-raised}'
  button-default:
    backgroundColor: '{colors.paper-raised}'
    textColor: '{colors.ink-700}'
    rounded: '{rounded.m}'
    height: '36px'
    padding: '0 16px'
  search-field:
    backgroundColor: '{colors.paper-sunken}'
    textColor: '{colors.ink-900}'
    rounded: '{rounded.m}'
    height: '36px'
  field:
    backgroundColor: '{colors.paper-raised}'
    textColor: '{colors.ink-900}'
    rounded: '{rounded.m}'
    height: '36px'
  status-tag:
    backgroundColor: '{colors.paper-sunken}'
    textColor: '{colors.ink-700}'
    rounded: '{rounded.tag}'
  message-bubble:
    backgroundColor: '{colors.paper-raised}'
    textColor: '{colors.ink-900}'
    typography: '{typography.body}'
    rounded: '{rounded.bubble}'
    padding: '10px 14px'
  run-card:
    backgroundColor: '{colors.paper-sunken}'
    textColor: '{colors.ink-700}'
    rounded: '{rounded.card}'
    padding: '12px 14px'
---

# Design System: Qgents

## Overview

**Creative North Star: "出发板（站台牌）"**

深墨牌头带写死「你在哪个团队、哪个项目」，其下每页一件事，按动静排序；改过的行留在原地发亮。中性灰纸面、同族蓝强调，阴影和渐变不参与分层。目标是**清晰、舒适、易用**：靠结构、留白和层级让人看懂，而不是靠说明文字。密度随任务变化——聊天宽松，表格紧凑。

导航分工是当前界面策略：团队与账号动作在头像菜单，项目在当前团队内于顶栏切换，群在聊天页左侧列表。团队与项目都可切换，界面只负责让三层先后关系一眼可见。

**Key Characteristics:**

- 深墨牌头带是唯一的深色面，其余全部为纸白与浅凹陷面。
- 蓝色只出现在主要动作与选中态；琥珀只表示变更/进行中，红只表示失败或叫停。
- 无阴影、无渐变、无玻璃；深度靠底色面与 1px 行界。
- 标题 32px 固定，正文 16px，最小 12px。

## Colors

**The Three Meanings Rule.** 颜色只有三种含义：牌头带说明你在哪，琥珀说明刚变过，红说明出错了。其余一律用墨与面。

### Primary

- **牌头墨（#14202B）**：横贯顶部的团队/项目带，白字（#F4F6F7），次要信息用 #B9C2C8。
- **牌头同族蓝（#2A5D8F）**：主按钮、选中态、焦点环、`::selection` 底；hover 到 #1E4770，浅底用 #EAF1F7。

### Neutral

- **墨 900 / 700（#16181A / #3A4046）**：正文、标题、表单标签。
- **墨 500 / 400（#5E666D / #68717A）**：说明、时间、占位；占位不降到 300。
- **墨 300（#A7AEB3）**：图标与禁用态，**不承载文字**。
- **纸 / 浮起 / 凹陷（#FAFAF9 / #FFFFFF / #F4F6F6）**：页面底、容器、运行卡/搜索框/表头的凹陷面。
- **行界 / 强界（#EDEFF0 / #DDE1E3）**：1px 行界、滚动条、输入框静默边框。

### Status

- **琥珀（#8A5200）**：群行时间与变更标记、运行中状态。
- **红（#A32020）**：失败、叫停。**完成（#0F7A6B）**：仅状态文字与圆点。

## Typography

**Display Font:** Geist（中文回落 PingFang SC / Microsoft YaHei，必须写在 generic sans-serif 之前）
**Label/Mono Font:** Geist Mono（只给时间、序号、代码、计数，开 `tabular-nums`）

**Character:** 一套无衬线贯穿界面，字重只用 400/500/600；靠字号和字距拉层级，中文不做大写变形。

### Hierarchy

- **Display**（600，32px，行高 1.2，字距 -0.02em）：页面标题，一屏一次；固定 32px，不随视口放大。
- **Title**（600，20px / 26px）：区块标题与设置区段。
- **Body**（400，16px，行高 1.6–1.7）：正文；聊天正文按 68ch 折行。
- **Label**（400/500，14px）：控件、菜单、表格单元、按钮。
- **Caption / Meta**（13px / 12px）：表单标签与辅助说明；时间、编号、计数用等宽字体。

**The 12px Floor Rule.** 不出现小于 12px 的文字；小于 14px 只用于元信息与辅助说明。

## Layout

- 顶栏固定 64px，三段网格（品牌 / 团队名 + 可搜索项目选择 / 通知 + 头像），段间靠留白不画竖线。
- 项目业务导航 52px，纸底无边框，五个业务入口加设置；选中项 2px 强调色下划线。
- 群列表只在聊天页左侧出现；聊天正文列最大 1120px 居中，宽屏不挤成窄栏。
- 断点按内容切换：620 / 700 / 800 / 860 / 1000；≤700 群列表与业务页签收进可键盘操作的 Drawer，项目选择保留可用宽度；800 是聊天阅读样式的断点。
- 产品设置路由 `/app/settings`，分区为账户 / 团队 / 安全，`?tab=` 记住位置；窄屏分区变横向滚动条。
- 间距只用 4 的倍数档位：区块 24–32，卡片内 16–24，相邻控件 8–12；堆叠用 flex `gap`，不用 margin 拼接。

## Elevation & Depth

系统是平的：全局阴影 token 均为 `none`，不用渐变、玻璃或投影分层。深度由三层底色（纸底 / 白容器 / 浅凹陷）与 1px 行界表达；凹陷面用于运行卡、搜索框、表格头与选中行。

弹层沿用 Ant Design 6 的 container/section 结构，去掉阴影后换 1px `--rule` 边线分层；Popover 的 filter 阴影已关闭，Drawer 的 wrapper 投影也压平。Tooltip 用墨底白字，不加边线。

## Shapes

圆角只有四档：控件 10、卡片与气泡 14、小件与滚动条把手 8、头像 10。标签 6 或 pill 999，复选框 4。超过 14px 的圆角只允许出现在气泡与 pill 上。边框统一 1px，用行界色，不做双线、不做虚线装饰。

## Components

| 组件     | 规则                                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 牌头带   | 高 64，`--band` 底；团队名可点回团队首页；团队与账户动作从头像菜单进入，项目在带内就地切换。                                                                       |
| 项目导航 | 高 52，纸底；选中 2px 强调下划线，未选中 `--ink-500`；窄屏收进 Drawer。                                                                                            |
| 群行     | 高 56，圆角 10，当前项 `--paper-sunken` 底 + 左侧 6px 琥珀圆点；有变更时时间与标记转 `--warning`；行间不画分隔线。                                                 |
| 消息气泡 | 他人白底 + 1px 行界，本人 `--accent-soft` 配 18% 蓝边；圆角 14，内边距 10/14，无尾巴无阴影；正文 16px，长段落 68ch。                                               |
| 运行卡   | `--paper-sunken` 凹陷面，圆角 14，无边框；挂在触发消息下方并缩进到正文列，停止只在运行中出现一次。                                                                 |
| 表单     | antd `Form` + 校验：自由内容 `Input`，离散选项 `Select`，少量多选 `Checkbox`，长列表用可搜索多选；标签 13px/600，字段间距 16。                                     |
| 主按钮   | 实心 `--accent` 白字，高 36，圆角 10；hover 只变 `--accent-strong`，不位移不加影。                                                                                 |
| 次按钮   | 白底 + 1px 边线；纯文字按钮只变底色。                                                                                                                              |
| 搜索框   | `--paper-sunken` 底、无边框、高 36、圆角 10；聚焦转白底并出 2px 焦点环。                                                                                           |
| 成员表   | 团队设置按邮箱邀请，角色用 `Select`（36px，只读态用等高文本容器，不用 `Tag` 顶替）；项目成员用多选弹窗添加，角色在行内显式操作。两处各自独立，不合并成同一套表单。 |
| 设置项   | 一行一件事，按钮与说明同基线，行间单条行界，不做卡片套卡片。                                                                                                       |

## Do's and Don'ts

### Do:

- **Do** 用 `src/theme/tokens.ts` 的数值，页面只引用 CSS 变量。
- **Do** 用底色面、留白与 1px 行界分组；一屏只出现一套线条语言。
- **Do** 分清团队、项目、群三层切换层级，并显示当前值。
- **Do** 状态只用语义色与 6–8px 圆点，整块底色不承载状态。
- **Do** 保留聊天 32px 头像列、12px 列距、同人 12 / 跨人 28 / 日期后 36 的节奏。

### Don't:

- **Don't** 硬编码颜色、圆角、字号、间距，或引入第三套 UI 组件库与工具类框架。
- **Don't** 用阴影、渐变、玻璃或大于 14px 的卡片圆角（气泡与 pill 除外）分层。
- **Don't** 用 `--ink-300` 承载文字，或让任何文字小于 12px。
- **Don't** 用标签顶替可编辑控件造成同行高度不一，或把表单说明堆在控件旁边。
- **Don't** 把颜色用于装饰：琥珀只有「变了/在跑」，红只有「失败/叫停」。
- **Don't** 在项目记忆页提供编辑入口；写入只由聊天中的 Agent 工具执行。
