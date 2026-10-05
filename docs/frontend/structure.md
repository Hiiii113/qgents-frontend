# 前端目录与实现现状

更新于 2026-10-03。产品支持默认群聊及成员创建的群聊，Agent 按显式提及协作，GitHub 为可选能力。

```text
src/
├── api/                    统一请求基础设施与当前业务接口
├── components/
│   ├── chat/               ChatPanel、输入器、虚拟列表、消息行、附件预览、同步 hook
│   ├── KnowledgeActions    Skill / Memory 详情审核操作
│   └── WorkspacePage       管理页共享布局
├── layouts/MainLayout/     当前团队首页、个人资料与团队切换浮层、通知
├── pages/
│   ├── Login/ ForgotPassword/ Welcome/
│   ├── CreateTeam/ JoinTeam/ Home/ TeamDetail/
│   ├── CreateProject/
│   ├── ChatWorkspace/      按团队查看项目会话
│   ├── GitHubIntegration/  团队 GitHub App 连接
│   └── ProjectDetail/
│       ├── Chat/           项目聊天、建群与邀请
│       ├── AgentTeam/      协作伙伴及团队共享审批
│       ├── Skill/          可复用能力
│       ├── Memory/         项目知识管理与审核
│       ├── Code/           项目仓库导入 / 移除与 GitHub 链接
│       └── Settings/       项目管理共用布局与横向导航、资料、头像、成员管理、归档 / 恢复
├── query/                  QueryClient 与 Agent / 聊天缓存键
├── realtime/               WebSocket、团队 / 通知 SSE
├── store/                  当前团队的 UI 上下文
├── types/                  当前后端 DTO 对应类型
└── mocks/                  认证团队、项目聊天、知识与 GitHub 演示响应
```

页面使用懒加载。业务专用组件、样式与测试就近存放；只有确实共用的布局和操作抽到 components。旧任务、交付、Diff、MR、测试集、门禁、OAuth 页面以及专用 API、hooks、types、store、Mock 与对应旧协议测试已移除。

团队与项目成员管理分别统一从对应设置的成员管理标签页进入，不再提供独立项目成员路由或团队成员抽屉；群聊自己的成员名单与邀请继续在聊天中管理。

项目设置共用横向导航，直接列出基本信息、成员管理、Agent、Skill、共享知识和项目仓库。聊天侧栏通过项目设置进入，不再使用项目工具下拉框；各业务保留现有 URL，由嵌套路由共享标题和标签栏，懒加载只影响当前标签的内容。

共享知识页保留新建、编辑、审核和归档，不再提供 AI 沉淀按钮或专用生成草稿调用。后续 AI 的 Memory 操作统一由聊天中的 Agent 工具完成；目前后端尚未接入 Memory 写入工具。

聊天输入状态留在 ChatComposer，打字不重新渲染历史列表。消息列表动态高度虚拟化，只挂载可见区域及预留行；历史分页保留游标和阅读锚点，增量补齐按 ID 去重。群列表缓存精确失效，发送与已读不会重新加载全部历史。并发消息通过独立增量游标补齐，不因发送响应的较大 sequence 跳过其他成员的消息。

测试覆盖当前 API payload、团队 Agent 缓存、导航和权限、普通消息、回复重试、输入法、历史合并、并发增量及千条消息的有限 DOM 挂载。附件、GitHub 和真实 Agent 执行仍需后端环境联调；Mock 不声称已经执行真实代码操作。

个人中心为顶部头像旁的浮层，点击头像更换、点击昵称就地修改；昵称保存使用 PATCH /me 返回的用户资料，头像确认成功后更新显示，无独立抽屉或上传按钮。

首页路由 /app 自动进入服务端选定团队的项目页；旧 /app/teams 列表页已删除。团队切换只在个人中心的团队子菜单中，带团队头像和当前选择标记，保存成功后进入所选团队项目页；主菜单保留创建、加入团队。
