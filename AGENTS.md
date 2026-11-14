# Qgents 前端协作约定

## 项目整体介绍

Qgents 是团队 × 项目 × 群聊的 Agent 协作工作台。团队拥有项目，项目自动生成自己的默认 Agent（名称 Qgent）与默认群；
成员在群聊里显式 `@` 已启用的 Agent 派活，Agent 读取群上下文、项目记忆、附件与已导入仓库，在沙箱内执行并推送分支。
只有显式提及当前群成员中已启用的 Agent 才触发工作，普通消息不调用模型。

- 前端仓库：本目录。后端仓库：`../qgents`，当前能力与领域词见其 `README.md`、`GLOSSARY.md`。
- 技术栈：React 19 + TypeScript strict + Vite + Ant Design 6（Form/message）+ TanStack Query + Zustand + React Router。
- 接口参考 `docs/api/qgents-api-current.md`，实现以 Backend 当前 Controller / DTO 为准，不凭历史版本或 Mock 推断。
- 设计说明 `docs/frontend/design-system.md`；视觉原型 `design/prototype/`（`index.html`、`app.css`、`app.js`，只读对照）。
- 用户目标始终是：代码清爽、功能按需求走。不能为了少写代码删掉仍在使用的功能。

## 前端目录结构

```
src/
  api/                    请求与接口封装（唯一出口 src/api/client.ts）
  types/                  接口与领域类型
  query/                  QueryClient 与 queryKey
  realtime/               WebSocket / SSE 实时通道
  store/                  Zustand 全局 UI 状态（当前团队、覆盖层开关）
  context/                AuthContext / AuthProvider
  hooks/                  跨页面可复用的行为
  utils/                  纯函数（错误文案、时间格式、RSA）
  theme/                  tokens.ts（设计变量单一来源）+ antdTheme.ts
  styles/                 base.css 重置排版 / ui.css 组件 / antd.css 基础件修正
  components/ui/          通用设计系统组件（Button、Tag、Avatar、Dialog、Popover、Table…）
  components/chat/        聊天消息、输入器、附件、成员、运行轨迹
  components/             跨业务但非通用组件的装配件（CreateProjectModal、PageLoader…）
  layouts/AppShell/       64px 竖轨 + 56px 顶栏外壳、项目切换器、通知、公告条
  pages/Auth/             登录、注册、找回密码、Gate 布局
  pages/Welcome/          无团队入口
  pages/Team/             团队首页、团队设置、GitHub 授权、建团队/加团队
  pages/Project/          聊天工作区、Agent、记忆、Skill、仓库、项目设置
  pages/Settings/         产品设置（账户 / 团队 / 安全）
  mocks/                  MSW fixture 与 handler（不直接被组件引用）
design/prototype/         视觉原型，只作对照，不参与构建
```

页面按业务分目录，页面专用组件、样式、辅助函数和测试就近放置。只有真正跨业务复用的组件才进 `src/components`。

## 设计系统架构：「案头朱批」

白色案头、石墨结构线；朱砂只写人做的决定——派活、待审、叫停、当前所在。Agent 的过程用石墨灰阶呈现。
完整规范见 `docs/frontend/design-system.md`，这里只记约束。

- **三层 token**：原始值 → 语义（面 / 墨 / 线 / 朱砂 / 状态）→ CSS 变量，全部定义在 `src/theme/tokens.ts`，
  运行时写入 `:root`；antd 主题从同一份对象取值。页面不写死颜色、圆角、字号、间距。
- **颜色语义**：朱砂 `--mark` 只表示人的动作与当前位置；琥珀 `--wait` 是等别人；墨绿 `--ok` 是已完成；
  深红 `--danger` 是不可逆。四者不同时出现在同一行，不用颜色单独表意。
- **排版**：正文 16/1.65，UI 14，元信息 12；12px 是地板。等宽只给时间、编号、仓库名、代码、diff。
  字体 Geist + PingFang SC / Microsoft YaHei / Noto Sans SC。
- **形状与深度**：圆角 3/4/6/8 与 pill；页面靠底色面 + 1px 行界分层，只有浮层与对话框用 `--shadow`。
  禁止渐变、玻璃与装饰性阴影。
- **布局**：64px 竖轨（项目视图：聊天 / Agent / 记忆 / Skill / 仓库；团队视图：项目 / 成员 / GitHub）+ 56px 顶栏。
  项目在顶栏切换，团队切换只在产品设置的「团队」页签。群聊列只在聊天页出现；执行轨迹默认常驻右侧、可收起。
  画布上限 1160px，正文 68ch。断点 1280 → 1100 → 900 → 760。

## 组件复用规范

- **先复用，后新增**：按以下顺序找——`src/components/ui` 的通用组件 → 现有业务装配件 → 平台原生能力 → 新组件。
  只有在现有组件无法满足需求时才新增组件，新增时说明为什么现有组件不够。
- 通用组件统一放 `src/components/ui` 并从 `index.ts` 导出；样式写在 `src/styles/ui.css`，页面不复制一份。
  当前可用：`Button`、`IconButton`、`Icon`、`Mark`、`Tag`、`Avatar`、`Dialog`、`Popover`、`Tabs`、`DataTable`
  / `TableRow` / `TableCell`、`Page` / `PageHead` / `Section`、`EmptyState`、`Skeleton`、`TextField` / `TextAreaField`
  / `SelectField`、`PageLoader`。
- 业务专用组件放在对应页面目录；跨多个业务但不属于设计系统的装配件放 `src/components`。
- 页面 CSS 只写该页独有的排版（文档、diff、登录分栏等），颜色、按钮、标签、表格、表单、浮层一律用设计系统。
- 表单统一 antd `Form` + 设计系统输入控件（原生 input/textarea/select，外观由 ui.css 统一）；
  自由内容用输入，离散选项用选择器，多对象选择用多选；提交与校验沿用 antd Form。
- 弹窗统一 `<Dialog>`（原生 dialog）；不再使用 antd Modal，避免两套浮层样式。
- 禁止引入第二套组件库、CSS 工具类框架、`any`。

## 产品与交互约定

- 项目记忆是项目目录下单个 `memory.md`，所有项目成员可读，前端只读；写入只由聊天中的 Qgent 在项目管理员明确确认后调用 Tool 完成。
- Agent：每项目默认 Agent 有自己的 ID；成员在项目 Agent 页提交自定义 Agent 申请（名称、职责描述、系统提示词、可选头像），
  申请为待审批且不能邀请入群；项目管理员在默认群 `@Qgent` 后由 Agent 工具按申请 ID 通过或拒绝，前端不提供独立审批操作。
- 群聊：输入 `@` 只列当前群成员（人与 Agent），显式选择后以成员类型与真实 ID 发送；回复使用 `replyToId + content`；
  停止执行按触发消息取消；消息、成员与增量同步都使用后端返回的真实 Agent ID。
- 聊天输入与历史消息渲染隔离；长消息列表动态高度虚拟化，保留分页游标、断线补齐与阅读锚点。
- 群设置只列本项目已启用 Agent 供邀请；Agent 与人在成员列表中按成员类型区分。新群只有在用户选择后才邀请成员与 Agent。
- GitHub 不设项目级开关：团队连接 GitHub App，项目管理员导入需要的仓库；不提供凭证引用或部署 Token 配置。
- 团队与项目成员管理分别在团队设置、项目设置中完成；群聊成员名单与邀请仍在聊天内管理。
- 团队恢复使用 `GET /me` 的 `currentTeamId`；失去权限回退到第一个可用团队，无团队时显示创建/加入入口。
- 项目记忆页不提供编辑入口；不要为了演示状态加开关或假数据。

## 修改原则

- 优先最小修复，沿用现有项目写法；只处理用户指定问题或确实导致功能错误的部分。
- 不覆盖、删除或还原已有修改；发现来源不明的未提交修改先停止汇报。
- 不为理论性风险增加抽象、兼容层或重复校验；先实现可用功能，保持代码简洁可读。
- 不因为假设性风险擅自删除日志或改变业务行为。
- 清理确认无引用的文件、占位实现、注释掉的旧代码；仍在使用的功能完整保留。
- 修改时同步更新相关注释与文档；不维护多份相互冲突的当前说明。
- 不兼容旧「出发板」设计：不恢复深色横贯顶栏、同族蓝强调、14px 大圆角卡片与旧的页面外壳。

## 前端技术约束

- 使用 TypeScript strict，不使用 `any`；不确定的数据用 `unknown` 并在边界收窄。
- 后端数据使用 TanStack Query，`queryKey` 必须包含资源归属；全局 UI 状态用 Zustand；筛选与选中状态用 URL 参数。
- 请求统一通过 `src/api/client.ts`；组件不自行处理认证头、不直接 import Mock fixture。Mock 与真实接口使用同一调用链。
- 实时：项目级 WebSocket 与群级 Agent 运行 SSE；断线由快照与增量游标补齐，不改 REST 真相。
- 状态覆盖：加载（Skeleton，超过 300ms 才出现）、空（一句标题 + 一句下一步）、错误（原因 + 重试）、
  权限不足、GitHub 断开阻断。状态只能由真实请求结果到达。
- 无障碍：键盘顺序即阅读顺序；按钮与链接用 2px 朱砂焦点环，输入框只加深墨边框、不套朱砂框；抽屉/浮层 Esc 关闭并把焦点还给触发按钮；
  正文对比度 ≥ 4.5:1；表格在 ≤760 变单列堆叠。

## 提交与分支

- 完成改动并通过相关验证后主动 `git commit`；只提交本次工作涉及的改动，不混入来源不明的修改。未经明确要求不推送。
- 一个 commit 只做一件独立可理解、可回滚的事；每个提交都应能单独检出并编译通过。
- 提交信息使用 Conventional Commits 前缀与中文具体描述，正文说明改了什么、为什么改、影响范围，以及实际验证命令与结果。
- `main` 为主干，`develop` 为日常开发分支；新需求默认使用 `feat/xxx`、`fix/xxx`、`refactor/xxx` 分支，不使用 `codex/xxx`。

## 验证

修改完成后运行：

```powershell
npm run lint
npm run test -- --run
npm run build
```

报告实际执行结果，不声称未执行的检查已通过。

## subAgent

使用 subAgent 时用 herdr 的 `pi` 命令派发，不额外指定模型或思考强度。
