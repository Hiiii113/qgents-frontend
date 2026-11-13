---
version: 1
slug: "src-pages-projectdetail-chat-projectchatpage-tsx"
primary_target: "src/pages/ProjectDetail/Chat/ProjectChatPage.tsx"
related_targets: ["src/layouts/MainLayout"]
---

# 外壳 + 项目聊天

## 范围与模式

- 目标：`src/layouts/MainLayout`（顶栏、团队/项目上下文）+ 项目聊天页（群列表 + 聊天区 + 运行卡）。
- 模式：Operate。任务是"看清哪个项目哪个群、@ 了谁、它跑到哪一步"，不是表达。
- 后续页面按同一套 token 铺开，不在本次范围内。

## 受众与任务

- 使用者：把这个产品当日常工具的开发团队，桌面浏览器为主。
- 主要动作：找到项目里的群 → `@` 某个 Agent 派活 → 看它跑到哪一步 → 跑偏就停。
- 必须一眼读到：当前团队、当前项目、当前群、有哪些运行在跑、哪个刚变过。
- 约束：`@` 只列当前群成员；推送真实成员 ID；虚拟列表与分页游标不能动；antd 6 组件体系不能换。

## 选择与记忆点

- 选择：站台牌（出发板）方向，抽签手牌中的首选卡，本人确认。
- 记忆点：**变更的行原地重排并保持琥珀高亮，直到你看过。** 状态变动不是一条新消息，而是某一行换了位置还亮着。
- 待定：字体是否换成 Geist（需要新增依赖）；深色主题的具体取值（本轮只做浅色）。

## Direction contract

THESIS：把团队/项目/群和运行状态做成一班一班的出发板——一行一件事，按动静排序，改过的行留在原地发亮。拒绝的默认做法：左侧竖栏 + 圆角卡片 + 柔和投影的通用控制台。

OWN-WORLD：白底 `#FFFFFF`、深墨牌头带 `#14202B`、正文墨 `#16181A`、次级 `#7A858C`、分隔线只作行界 `#EDEFF0`；琥珀 `#B06A00` 只表示变更/进行中，红 `#A32020` 只表示失败或叫停。等宽数字承担时间与序号；正文 16px；圆角 10–14px；行高固定 48/56px。

STORY：进门先看到深墨带上的团队名与项目名，不需要找；左列一眼扫出哪个群刚动过；聊天里 @ 之后，运行出现在一张按时间排序的板上，改动的行亮着；停手就停那一班。

FIRST VIEWPORT：64px 深墨牌头带横贯全宽（左：团队名 / 分隔 / 项目名，右：成员数与运行数）；其下 380px 左列，每行 56px 固定高度，行内三栏（名称+预览 / 时间+相对时间），当前行 3px 琥珀左标；右侧聊天区 16px 正文、34px 方形头像、消息间距 22px；运行是一张表头 + 48px 固定行的板，列固定为 起 / 班次 / 任务 / 闸口 / 状态。主行动在底部输入条，深墨发送键。

FORM：站台牌，我方接地候选排序第 1 位。seed:3e6f4ab1e37c12c6

FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
