# 前端目录与实现现状

更新于 2026-10-03。产品支持默认群聊及成员创建的群聊，Agent 按显式提及协作，GitHub 为可选能力。

```text
src/
├── api/                    统一请求基础设施与当前业务接口
├── components/
│   ├── chat/               ChatPanel、输入器、虚拟列表、消息行、附件预览、同步 hook
│   ├── KnowledgeActions    Skill / Memory 详情审核操作
│   └── WorkspacePage       管理页共享布局
├── layouts/MainLayout/     团队 / 项目聊天入口、个人中心、通知
├── pages/
│   ├── Login/ ForgotPassword/ Welcome/
│   ├── CreateTeam/ JoinTeam/ MyTeams/ TeamDetail/
│   ├── CreateProject/
│   ├── ChatWorkspace/      按团队查看项目会话
│   ├── GitHubIntegration/  团队 GitHub App 连接
│   └── ProjectDetail/
│       ├── Chat/           项目聊天、建群与邀请
│       ├── AgentTeam/      协作伙伴及团队共享审批
│       ├── Skill/          可复用能力
│       ├── Memory/         项目知识及 AI 草稿
│       ├── Code/           项目仓库导入 / 移除与 GitHub 链接
│       └── Settings/       项目资料、头像、成员管理组件与标签页、归档 / 恢复
├── query/                  QueryClient 与 Agent / 聊天缓存键
├── realtime/               WebSocket、团队 / 通知 SSE
├── store/                  当前团队的 UI 上下文
├── types/                  当前后端 DTO 对应类型
└── mocks/                  认证团队、项目聊天、知识与 GitHub 演示响应
```

页面使用懒加载。业务专用组件、样式与测试就近存放；只有确实共用的布局和操作抽到 components。旧任务、交付、Diff、MR、测试集、门禁、OAuth 页面以及专用 API、hooks、types、store、Mock 与对应旧协议测试已移除。

团队与项目成员管理分别统一从对应设置的成员管理标签页进入，不再提供独立项目成员路由或团队成员抽屉；群聊自己的成员名单与邀请继续在聊天中管理。

聊天输入状态留在 ChatComposer，打字不重新渲染历史列表。消息列表动态高度虚拟化，只挂载可见区域及预留行；历史分页保留游标和阅读锚点，增量补齐按 ID 去重。群列表缓存精确失效，发送与已读不会重新加载全部历史。并发消息通过独立增量游标补齐，不因发送响应的较大 sequence 跳过其他成员的消息。

测试覆盖当前 API payload、团队 Agent 缓存、导航和权限、普通消息、回复重试、输入法、历史合并、并发增量及千条消息的有限 DOM 挂载。附件、GitHub 和真实 Agent 执行仍需后端环境联调；Mock 不声称已经执行真实代码操作。
