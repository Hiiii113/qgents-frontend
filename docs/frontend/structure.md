# 前端目录与实现现状

本文件只写当前目录、导航结构与行为。

## 产品现状

- 层级是团队 → 项目 → 群聊。项目创建即生成该项目的默认 Agent（名称 Qgent，项目之间 ID 独立）并建默认群；
  新群由成员创建，只在选择后才邀请项目成员和已启用的 Agent。
- 只有显式提及群内已启用的 Agent 才触发工作，普通消息只用于聊天；回复用 `replyToId + content`，停止按触发消息取消。
- 运行过程贴在对话里：触发消息下方保留一张运行卡，就地列出工具调用与每次调用的入参、结果；最终回复到达后运行卡仍在，历史由后端快照恢复。

## 目录

```text
src/
├── api/                    统一请求基础设施与业务接口
├── components/
│   ├── ui/                 设计系统组件与图标（Button、Tag、Avatar、Dialog、Popover、Table…）
│   ├── chat/               聊天画布、消息行、输入器、附件预览、成员侧栏、邀请弹窗、运行卡
│   ├── CreateProjectModal  新建项目
│   ├── PageLoader / StartupScreen / ErrorBoundary / AuthedImage
├── features/agent-runs/    Agent 运行状态、快照与群级 SSE 订阅
├── context/ providers/     登录态与全局 Provider
├── layouts/AppShell/       64px 竖轨 + 56px 顶栏、项目切换/搜索、通知、头像菜单、GitHub 公告条
├── pages/
│   ├── Auth/               登录、注册、找回密码、Gate 布局
│   ├── Welcome/            无团队入口
│   ├── Team/               团队首页、团队设置、GitHub 授权、建团队 / 加团队
│   ├── Project/            聊天工作区、Agent、记忆、Skill、仓库、项目设置
│   └── Settings/           产品设置（账户 / 团队 / 安全）
├── query/                  QueryClient 与聊天缓存键
├── realtime/               WebSocket、团队 / 通知 SSE
├── routes/                 路由与守卫
├── store/                  当前团队与窄屏覆盖层开关
├── styles/                 base.css / ui.css / antd.css
├── theme/                  tokens.ts（设计变量单一来源）与 antd 主题
├── types/                  当前后端 DTO 对应类型
└── mocks/                  认证团队、项目聊天、知识、GitHub 与运行事件演示响应
```

页面懒加载。业务专用组件、样式与测试就近存放；只有确实共用的布局和操作抽到 `components`。

## 页面与导航

- 竖轨承担项目业务导航（聊天 / Agent / 记忆 / Skill / 仓库）与团队导航（项目 / 成员 / GitHub）；
  设置固定在底部，项目上下文进项目设置，团队与产品设置进 `/app/settings`。
- 顶栏只有项目切换器、项目搜索（⌘K / Ctrl+K）、通知与窄屏群聊开关；团队切换只在产品设置「团队」页签。
- 群聊列只在聊天页出现：搜索、置顶、未读与最近活动；非聊天页不加载也不占位。窄屏群聊列与群成员侧栏都是覆盖层。
- 项目设置包含基本信息 / 成员 / 归档三个页签（`?tab=`）；团队设置只保留成员与邀请。
- 项目记忆只提供 `memory.md` 阅读视图和目录，没有编辑入口；写入只由聊天中的 Qgent 在管理员确认后执行。
- 自定义 Agent 在项目 Agent 页提交申请，审批在默认群由 Qgent 工具执行，前端只展示状态。
- 首页路由 `/app` 进入服务端选定团队，标题是团队名；无团队时进入欢迎页。
- 团队上下文用 `GET /me` 的 `currentTeamId` 恢复、`PUT /me/current-team` 保存；失权时回退首个可用团队。

## 聊天实现

输入状态留在 `ChatComposer`，打字不重新渲染历史列表。消息列表动态高度虚拟化，运行卡跟随触发消息一起测量；
历史分页保留游标和阅读锚点，增量补齐按 ID 去重。群列表缓存精确失效。插入提及会更换 `clientMessageId`，
避免失败重试被后端按旧 ID 去重；提及按成员类型与真实 ID 发送，不以昵称推断。

## 知识

项目记忆是项目目录下的单个 `memory.md`：所有项目成员可读，前端只读。群记忆与 Agent 私有记忆是后端概念，前端不展示。

## 测试与边界

测试覆盖接口 payload、运行状态归并、权限与群聊申请/邀请、聊天合并与增量、页面渲染。
用例数量随代码变化，不在文档维护。

附件、GitHub 与真实 Qgent 执行需要后端环境；Mock 只模拟协议，不执行真实 GitHub / Qgent / 对象存储操作。
