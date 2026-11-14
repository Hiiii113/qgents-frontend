# Qgents 前端技术规范

## 状态与数据

- 后端数据统一使用 TanStack Query 管理；查询资源的 `queryKey` 必须包含资源归属，例如 `projectId`。
- 全局客户端 UI 状态使用 Zustand；只放跨页面 UI 状态（当前团队、窄屏群聊/轨迹开关），不放接口资源。
- 组件内部的短生命周期状态使用 React `useState`。
- 需要分享、刷新后保留或可复制的筛选和选中状态使用 URL 参数（页面页签、群聊与消息定位）。
- mutation 成功后使用 `setQueryData` 或 `invalidateQueries` 更新 Query 缓存，不复制列表到 Zustand。

## UI 与请求

- 通用控件只使用 `src/components/ui` 的设计系统组件（Button、Icon、Tag、Avatar、Dialog、Popover、
  DataTable、Tabs、Page / PageHead / Section、EmptyState、Skeleton、TextField 等），样式见 `src/styles/ui.css`。
- Ant Design 只承担 `Form` 校验、`App` 的 message 反馈与少量基础控件；页面不使用 antd Table / Modal / Select / Tag / Spin。
- 设计变量只在 `src/theme/tokens.ts` 定义，页面 CSS 只引用 CSS 变量；完整规范见 `docs/frontend/design-system.md`。
- 表单统一使用 Ant Design `Form` + 设计系统输入控件；弹窗统一 `<Dialog>`（原生 dialog）。
- 所有后端请求必须经过 `src/api/client.ts`，业务 API 放在 `src/api` 下。
- 不在组件中直接拼接 HTTP 请求或处理认证头。
- 现有 `AuthContext` 保留，不能用 Zustand 替换。

## Mock 与实时事件

- Mock 统一使用 MSW，并由 `VITE_USE_MOCK=true` 控制开发环境启动。
- 组件不得直接 import Mock fixture；Mock 与真实接口必须走同一套 API 调用链。
- 全局实时通道使用 WebSocket；现存 SSE 通道使用 `@microsoft/fetch-event-source`。两者复用事件驱动的 TanStack Query 缓存更新逻辑。
- Agent 运行先拉快照、再接群级 SSE；断线降级为轮询快照，REST 始终是真相。

## 目录组织

- 页面按业务分目录：`pages/Auth`、`Welcome`、`Team`、`Project`、`Settings`。
- 页面专用组件、样式、辅助函数和测试就近放置；跨业务装配件放 `src/components`，通用组件放 `src/components/ui`。
- 通用组件不反向依赖页面目录；页面不重复实现按钮、标签、表格、表单、浮层样式。
- 当前目录与导航行为见 `docs/frontend/structure.md`。

## 禁止项

- 禁止 Axios、Redux、MobX、Tailwind 和第二套 UI 组件库。
- 禁止使用 `any`；接口不确定时使用 `unknown` 并在边界处收窄。
- 不要在 Zustand 中存储后端资源列表。
- 禁止恢复旧「出发板」设计：深色横贯顶栏、同族蓝强调、14px 以上卡片圆角。

## 聊天性能

- 输入器维护自己的草稿与附件状态，历史消息不随输入更新。
- 消息动态高度虚拟化，并保留加载历史时的阅读锚点；运行卡随触发消息参与行高测量。
- 消息事件只驱动增量 REST 补齐，禁止每条消息重新加载全部历史；群列表缓存必须精确失效。
- 增量游标只由历史初始化和完整增量响应推进，不能因发送响应跳过并发消息。
