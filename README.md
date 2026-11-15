# Qgents 前端

在群聊里 @ 一个 Agent 派活，看它一轮轮调用工具、改代码、把分支推回 GitHub；跑偏了按那条消息停掉。

## 这是什么

Qgents 的网页端。层级固定为团队 → 项目 → 群聊，Agent 是群里的正式成员，有项目内独立 ID 和自己的记忆，只有在群里被 @ 时才启动。

这是 React 19 + TypeScript strict + Ant Design 6 的前端，请求全部打到后端 `/api/v1`（Java 21 / Spring Boot，仓库 `qgents`）。前端不做业务判断：谁能看到什么、Agent 能不能用，都由后端决定。

## 快速开始

前置：Node.js `^20.19` 或 `>=22.12`（Vite 8 的要求）。要看到真实数据，得先把后端跑起来，步骤见 `qgents` 仓库的 README。

```sh
cp .env.example .env
npm ci
npm run dev      # http://localhost:5173
```

`.env` 里 `VITE_USE_MOCK=false` 时，请求经 Vite 代理转发到 `API_PROXY_TARGET`（默认 `http://localhost:8080`），并把 `/api` 重写成 `/api/v1`。

没有后端也能看界面：把 `VITE_USE_MOCK` 设成 `true`，请求由 MSW 拦下来，数据来自 `src/mocks`。演示环境里任意非空账号都能登录，注册验证码固定 `483920`。Mock 只模拟界面和接口协议，不执行真实的 GitHub、Agent 或对象存储操作。

## 界面里有什么

- 群聊：消息、提及、回复、已读、置顶。长历史动态高度虚拟化，断线后用增量游标补齐，不重新拉全量。
- 运行视图：每轮模型输出、每次工具调用的入参与结果都看得见，可以停。
- 项目 Agent：默认 Agent 和成员申请的自定义 Agent 都是群成员。输入 @ 只列当前群里的真成员，按成员 ID 发送，不靠昵称猜。
- 项目知识：项目记忆（只读展示）、Skill、图片与文本附件。
- 仓库：团队连 GitHub App，项目管理员导入需要的仓库。
- 设置：账户资料、团队切换与创建、安全操作。

布局是 64px 竖轨（项目导航、团队导航）+ 56px 顶栏（项目切换器、搜索、通知）。

## 技术栈与硬约束

| 领域 | 选型 |
| --- | --- |
| 框架 | React 19、TypeScript（strict）、Vite 8 |
| UI | Ant Design 6，外加自己的一层 `src/components/ui` |
| 数据 | TanStack Query，请求统一走 `src/api/client.ts` |
| 全局状态 | Zustand |
| 样式 | 纯 CSS + 设计变量，数值唯一来源是 `src/theme/tokens.ts` |
| Mock | MSW，和真实请求走同一条调用链 |
| 测试 | Vitest + Testing Library |

不引入 Axios、Redux、MobX、Tailwind 或第二套组件库，不用 `any`。这些是刻意的约束：一个项目只留一条做事的路，读代码的人不用先猜你在哪一层。

## 目录结构

```text
src/api/         接口封装与请求客户端，一个模块一个文件
src/components/  通用组件；ui/ 是设计系统那层
src/features/    按业务切片的功能代码，比如 agent 运行
src/layouts/     AppShell：64px 竖轨 + 56px 顶栏
src/mocks/       MSW 处理器与假数据
src/pages/       页面：Auth / Home / Project / Settings / Team / Welcome
src/realtime/    SSE 与 WebSocket 客户端
src/routes/      路由表与守卫（登录、团队）
src/store/       全局 UI 状态
src/styles/      基础样式、UI 样式、antd 覆写
src/theme/       设计变量
src/utils/       格式化、RSA 加密等工具
```

## 配置

`.env` 里的变量，`cp .env.example .env` 之后按需改：

| 变量 | 用途 |
| --- | --- |
| `VITE_USE_MOCK` | `true` 时用 MSW 拦请求，不需要后端 |
| `VITE_API_BASE_URL` | 浏览器请求前缀，默认 `/api` |
| `API_PROXY_TARGET` | Vite 开发代理目标，只在本机 dev server 生效，不会打进浏览器 |
| `DEV_ALLOWED_HOSTS` | 开发服务器允许的额外 Host，逗号分隔 |
| `VITE_RSA_KEY_ID` / `VITE_RSA_PUBLIC_KEY` | 登录密码加密用的公钥和 keyId，必须和后端私钥配套 |

公钥和后端对不上时，登录会返回 `INVALID_ENCRYPTED_PASSWORD`。三者（后端私钥、后端 `RSA_KEY_ID`、这里的公钥与 keyId）要一起换。

## 检查与测试

```sh
npm run lint      # oxlint
npm run test:run  # vitest run
npm run build     # tsc -b && vite build
```

## 部署

镜像由后端仓库的 Compose `production` profile 构建（`FRONTEND_DIRECTORY` 指到这个仓库），构建期把 `VITE_API_BASE_URL`、`VITE_RSA_KEY_ID`、`VITE_RSA_PUBLIC_KEY` 写进静态资源，改完要重建镜像。

`nginx.conf` 里 `/api/` 反代到 `http://api:8080/api/v1/`，WebSocket 走同一个入口，SSE 关掉了缓冲；`index.html` 不缓存。

## 边界

只有桌面浏览器是完整形态：派活、看执行、审分支都在桌面上做。手机浏览器能读消息、回复和确认，但没做原生客户端。

## License

[MIT](LICENSE)
