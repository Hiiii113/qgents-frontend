# 前端目录与实现现状

更新于 2026-11-13。本文件只写当前目录、导航结构与行为，不记录改造过程。

## 产品现状

- 层级是团队 → 项目 → 群聊。项目创建即生成该项目的默认 Agent（名称 Qgent，项目之间 ID 独立）并建默认群；新群由成员创建，只在选择后才邀请项目成员和已启用的 Agent。
- 只有显式提及群内已启用的 Agent 才触发工作，普通消息只用于聊天；回复用 `replyToId + content`，停止按触发消息取消。
- 运行进度挂在触发消息下方，由群级 SSE 推送、用运行快照恢复；结束时临时正文由服务端最终消息替换。

## 目录

```text
src/
├── api/                    统一请求基础设施与业务接口
├── components/
│   ├── chat/               ChatPanel、输入器、虚拟列表、消息行、附件预览、同步 hook
│   ├── SkillActions        Skill 详情审核操作
│   └── WorkspacePage       管理页共享布局
├── features/agent-runs/    Agent 运行状态、进度卡与群级事件订阅
├── context/ providers/     登录态与全局 Provider
├── layouts/MainLayout/     当前团队首页、个人菜单、通知
├── pages/
│   ├── Login/ ForgotPassword/ Welcome/
│   ├── CreateTeam/ JoinTeam/ Home/ TeamDetail/
│   ├── GitHubIntegration/  团队 GitHub App 连接
│   ├── Settings/           产品级设置
│   └── ProjectDetail/
│       ├── Chat/           项目聊天、建群与邀请
│       ├── Skill/          可复用能力与审核
│       ├── Memory/         项目记忆阅读
│       ├── Code/           项目仓库导入 / 移除与 GitHub 链接
│       └── Settings/       项目设置布局、资料、头像、成员管理、Agent 申请、归档 / 恢复
├── query/                  QueryClient 与聊天缓存键
├── realtime/               WebSocket、团队 / 通知 SSE
├── routes/                 路由与守卫
├── store/                  当前团队的 UI 上下文
├── styles/ theme/          全局样式与 tokens
├── types/                  当前后端 DTO 对应类型
└── mocks/                  认证团队、项目聊天、知识、GitHub 与运行事件演示响应
```

页面懒加载。业务专用组件、样式与测试就近存放；只有确实共用的布局和操作抽到 `components`。

## 页面与导航

- 项目一级导航直接列出聊天、Agent、项目记忆、Skill、仓库；项目设置只保留基本信息和成员管理。聊天页左侧是群聊二级列表（搜索、未读、新建、置顶），非聊天页不加载也不显示群列表；窄屏用菜单按钮打开 Drawer，包含一级导航、项目设置和群聊。业务保留现有 URL 与 `groupId`/`messageId` 定位参数。
- Agent 页提交自定义 Agent 申请并列出本项目已启用的 Agent；申请为待审批并给出“去默认群跟进”的入口，审批由聊天里的 Agent 工具执行，前端没有审批操作。
- 项目记忆页只提供 `memory.md` 阅读视图，没有编辑、重新加载或去聊天入口。
- 团队成员管理在团队设置的成员页签，项目成员管理在项目设置的成员页签，没有独立成员页或团队成员抽屉；群聊自己的成员名单与邀请在聊天里。
- 首页路由 `/app` 自动进入服务端选定团队的项目页，标题是团队名，保留项目搜索和创建项目；GitHub 授权、邀请成员、团队设置入口在团队页头。
- 顶栏搜索并切换当前团队的项目；群列表保留在聊天页。
- 团队切换、创建和加入在头像旁的个人菜单里完成；同一浮层保留头像更换与昵称就地修改，保存走 `PATCH /me`。产品设置 `/app/settings` 的账户 / 团队 / 安全是管理入口，不是切换团队的唯一入口。
- 团队上下文用 `GET /me` 的 `currentTeamId` 恢复、`PUT /me/current-team` 保存；失权时回退首个可用团队，无团队显示创建 / 加入。

## 聊天实现

输入状态留在 `ChatComposer`，打字不重新渲染历史列表。消息列表动态高度虚拟化，只挂载可见区域及预留行；历史分页保留游标和阅读锚点，增量补齐按 ID 去重。群列表缓存精确失效，发送与已读不会重新加载全部历史。并发消息通过独立增量游标补齐，不因发送响应的较大 sequence 跳过其他成员的消息。插入提及会更换 `clientMessageId`，避免失败重试被后端按旧 ID 去重。

## 知识

项目记忆是项目目录下的单个 `memory.md`：所有项目成员可读，前端只读；写入只由聊天中的 Qgent 在项目管理员明确确认后调用工具完成。群记忆与 Agent 私有记忆是后端概念，前端不展示。

## 测试与边界

测试覆盖接口 payload、导航与权限、群聊 Agent 申请与邀请、普通消息与回复重试、输入法、历史合并、并发增量、虚拟列表和运行事件状态。用例数量随代码变化，不在文档维护。

附件、GitHub 与真实 Qgent 执行需要后端环境；Mock 只模拟协议，不执行真实 GitHub / Qgent / 对象存储操作。
