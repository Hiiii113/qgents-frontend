---
version: 1
slug: 'src-pages-projectdetail-chat-projectchatpage-tsx'
primary_target: 'src/pages/ProjectDetail/Chat/ProjectChatPage.tsx'
related_targets: ['src/layouts/MainLayout', 'src/pages/ProjectDetail/ProjectDetailLayout.tsx']
---

# 工作区导航与聊天

## 范围与模式

目标：MainLayout 顶栏与头像菜单、项目外壳、群聊消息与输入器。模式：Operate。用户在团队与项目之间切换并继续群聊；群列表现有搜索、排序、未读和新建体验保留。

## 已确认决策

采用方案 C：头像菜单切换团队，顶栏切换项目，下方只保留项目功能导航。保留头像和昵称就地编辑。产品设置保留实际可用的账户、团队、安全功能。共享知识只读并直达聊天，管理员确认后由 Agent 工具写入。设计规范采用合并方式更新。

## Direction contract

THESIS：团队归账户菜单，项目归全局工作上下文，群归聊天侧栏。清楚呈现三个层级，以就地切换减少退回首页的路径。

OWN-WORLD：保留深墨顶栏、中性纸面、同族蓝强调和现有 Geist 字体；颜色、圆角、间距沿用 tokens.ts。标准按钮、可搜索 Select、页签和 Drawer；状态才使用琥珀与红。

STORY：用户从头像菜单确认并切换团队，在顶栏选择当前团队项目，再从原有群列表进入讨论。项目切换清除上一个项目的群和消息定位，项目内功能切换保留定位。团队保存成功后才进入该团队。

FIRST VIEWPORT：64px 顶栏依次为品牌、可返回团队首页的团队名、可搜索项目选择、通知与头像；52px 项目功能导航只承载五个业务入口和设置；聊天页左侧为现有群列表，右侧为消息与底部输入器。宽屏消息正文列最大1120px、32px头像和12px头像间距；同人连发12px，跨人28px。窄屏收起群列表和功能页签进键盘可操作 Drawer，项目选择保留可用宽度。签名交互是群列表真实活动的原位更新标记，动效只服务选择和状态反馈。

FORM：顶栏切换项目，头像切换团队；候选结构第6位，用户选择方案C。seed:6b568c7c5551f611。

FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
