# 前端设计系统 · 案头朱批

视觉原型在 `design/prototype/`（`index.html` + `app.css` + `app.js`），是还原依据；
本文是落地到本仓库后的唯一说明。旧「出发板」体系（深墨顶栏、同族蓝、14px 大圆角、完全扁平）不再使用。

## 一句话

白色案头、石墨结构线；朱砂只写人做的决定——派活、待审、叫停、当前所在。Agent 的运行过程用石墨灰阶呈现。

## 颜色

| Token | 值 | 用途 |
| --- | --- | --- |
| `--surface` | `#FFFFFF` | 主画布、对话框、浮层 |
| `--surface-soft` | `#F6F7F8` | 群聊列、执行轨迹、运行卡、选中行 |
| `--surface-sunken` | `#EEF0F2` | 输入内衬、表头、代码底、悬停 |
| `--surface-rail` | `#FCFCFD` | 左侧竖轨 |
| `--ink-900` | `#14171A` | 标题、正文 |
| `--ink-700` | `#333A41` | 控件文字、表单标签 |
| `--ink-500` | `#59626B` | 说明、次要正文 |
| `--ink-400` | `#6E7780` | 元信息、时间、占位 |
| `--ink-300` | `#9AA3AC` | 图标与禁用态，**不承载文字** |
| `--line` / `--line-strong` | `#E3E6E9` / `#CED4DA` | 行界 / 控件边框 |
| `--mark` / `--mark-strong` / `--mark-soft` | `#B03A2B` / `#8C2B1F` / `#F9EAE7` | 人的决定：选中、当前导航、链接、焦点、派活与叫停 |
| `--mark-line` | `#EFD8D3` | 朱砂细线（提示条边线） |
| `--ok` / `--ok-soft` | `#1F6B4A` / `#EAF3EE` | 完成、已启用、已合并 |
| `--wait` / `--wait-soft` | `#8A5A00` / `#F8F0DF` | 待审批、待接受邀请、送达未读 |
| `--danger` / `--danger-strong` / `--danger-soft` | `#A2261C` / `#8B1C14` / `#FBECEA` | 归档、移除等不可逆动作 |
| `--action` / `--action-hover` | `#191D21` / `#2B323A` | 主按钮实心墨 |
| `--on-action` | `#FFFFFF` | 实心墨 / 朱砂上的文字 |

规则：朱砂=人的动作与当前位置；琥珀=等别人；墨绿=已经成了；深红=不可逆。四者不同时出现在同一行。
所有数值只在 `src/theme/tokens.ts` 定义，运行时写入 `:root`；页面 CSS 只引用变量。

## 字体

- 无衬线 `--font`：Geist + PingFang SC / Microsoft YaHei / Noto Sans SC。
- 等宽 `--mono`：Geist Mono，只给时间、编号、仓库名、代码、diff；数字开 `tabular-nums`。
- 层级：Display 30/1.15（`.h1`）·Title 24（`.h2` 用于页面副标题）·Section 20（`.h3`）·Body 16/1.65 ·UI 14 ·Meta 13 ·Micro 12。
- 12px 是地板，没有更小的文字。

## 间距、圆角、深度

- 间距只用 4 的倍数：`--s-1` 4 / `--s-2` 8 / `--s-3` 12 / `--s-4` 16 / `--s-5` 20 / `--s-6` 24 / `--s-8` 32 / `--s-10` 40。
- 圆角：小件 3、控件 4、面板 6、对话框与头像 8、pill 999。没有 14px 以上的卡片圆角。
- 页面不用阴影分层，靠底色面 + 1px 行界；只有浮层、对话框、抽屉用 `--shadow`。

## 布局

- 外壳：64px 竖轨｜内容区；顶栏 56px。聊天页三列再加群聊列 288 与执行轨迹 348。
- 项目在顶栏切换器里切；团队切换只在产品设置的「团队」页签；群聊列只在聊天页出现。
- 断点：1280（轨迹收窄）→ 1100（群聊列与轨迹变覆盖层）→ 900（竖轨转顶部横条）→ 760（表格单列堆叠）。
- 画布内容上限 1160px（`.view`），正文行宽 68ch，文档 72ch。

## 组件

通用组件在 `src/components/ui`，样式在 `src/styles/ui.css`。**先找组件，找不到再新增；页面不重复写按钮、标签、表格、表单样式。**

| 组件 | 用法 | 说明 |
| --- | --- | --- |
| `<Button variant="primary \| quiet \| danger \| link" size="sm" block icon>` | 全部按钮 | 原生 button；主按钮墨实心 |
| `<IconButton label square>` | 方形小按钮 | 必须带可读 label |
| `<Icon name size>` | 图标 | 名字见 `Icon.tsx`；`<Mark>` 是品牌标记 |
| `<Tag tone="ok \| wait \| stop \| agent \| role \| readonly">` | 状态标签 | 颜色 + 文字双通道 |
| `<Avatar name src type size>` | 人头像/Agent | Agent 固定品牌标记 |
| `<Page>` / `<PageHead kicker title description actions aside>` | 页面骨架 | Page 提供留白与 1160 上限 |
| `<Section title aside>` | 页面区块 | 标题 + 右侧动作 |
| `<DataTable layout columns>` + `<TableRow>` + `<TableCell end>` | 列表 | layout: projects/agents/repos/members/team/plain |
| `<Tabs items value onChange label>` | 页签 | 选中项朱砂下划线 |
| `<Dialog open onClose title description danger>` | 对话框 | 原生 dialog，内含 `<form>` |
| `<Popover open onClose align>` | 锚定浮层 | 父级容器加 `.anchored`；点击外部/Esc 关闭 |
| `<EmptyState icon title description action stacked>` | 空态 | 贴着它替代的列表位置 |
| `<Skeleton rows>` | 加载 | 软灰条呼吸 |
| `<TextField>` `<TextAreaField>` `<SelectField>` | 表单控件 | 配 antd `Form.Item` 使用 |
| `<PageLoader fullscreen>` | 路由加载 | 三条呼吸条 |

表单统一 antd `Form` + `<Form className="form">`：标签 13/500，字段间距 16，错误在字段下方。
弹窗用 `<Dialog>` + `<form>` + `.dlg__foot`，提交仍走 antd Form 时会得到嵌套 form（禁止），
因此 Dialog 内直接用 antd `Form`，`.dlg__foot` 放在 Form 内。

## 页面模式

```tsx
<main className="canvas">
  <Page>
    <PageHead kicker="项目 xxx" title="Agent" description="…" actions={<Button variant="primary">申请</Button>} />
    <Section title="默认 Agent">…</Section>
  </Page>
</main>
```

聊天页例外：由 `ChatWorkspace` 渲染 `.body`（群聊列 + 画布 + 执行轨迹），页面只补画布内容。

必须覆盖的状态：加载（Skeleton，>300ms 才出现）、空（一句话 + 下一步）、错误（原因 + 重试）、
权限不足（403 页或行内说明）、阻断（软底面板 + 重连动作）。状态只能由真实请求结果产生，不做演示开关。

## 代码约定

- TypeScript strict，禁止 `any`；不确定的数据用 `unknown` 并在边界收窄。
- 后端数据走 TanStack Query，`queryKey` 带资源归属；全局 UI 状态进 Zustand；可分享筛选进 URL。
- 请求统一经 `src/api/*`，组件不拼 URL、不处理认证头。
- 业务目录内就近放置页面、专用组件、CSS 与测试；确实复用的才进 `src/components`。
- 页面 CSS 只写该页独有的排版（如文档、diff），颜色/按钮/表格一律用设计系统类与组件。
- 不引入第二套组件库、CSS 工具类框架、阴影/渐变装饰。
- 文案直接说明用途和结果，不堆内部实现细节；不用颜色单独表意。
