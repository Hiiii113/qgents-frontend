# Qgents 前端

Qgents 的网页端：团队 → 项目 → 群聊里 @ 一个 Agent 派活，看它一轮轮调用工具、改代码、跑命令，需要时按消息停掉，最后审它推的分支。

React 19 + TypeScript strict + Ant Design 6。后端在相邻仓库 `qgents`（Java 21 / Spring Boot），这个仓库通过 `/api/v1` 调它。

## 界面里有什么

- 群聊：消息、提及、回复、已读、置顶；长历史动态高度虚拟化，断线后用增量游标补齐，不重新拉全量。
- 项目 Agent：默认 Agent 与成员申请的自定义 Agent 都是群成员；点 @ 只列当前群里的真成员，按成员 ID 发送，不靠昵称猜。
- 运行视图：每轮模型输出、每次工具调用的入参与结果都看得见，可以停。
- 项目知识：项目记忆（只读展示）、Skill、附件。
- 仓库：团队连 GitHub App，项目管理员导入需要的仓库。
- 设置：账户资料、团队切换与创建、安全操作。

## 技术栈与约束

| 领域 | 选型 |
| --- | --- |
| 框架 | React 19、TypeScript（strict）、Vite |
| UI | Ant Design 6 + 自己的一层 `src/components/ui` |
| 数据 | TanStack Query；请求统一走 `src/api/client.ts` |
| 全局状态 | Zustand（`src/store`） |
| 样式 | 纯 CSS + 设计变量，数值唯一来源是 `src/theme/tokens.ts` |
| Mock | MSW，走和真实请求同一条调用链 |

这些是硬约束：不引入 Axios、Redux、MobX、Tailwind 或第二套组件库，不用 `any`。

## 本地开发

前端单独跑起来只需要 Node.js；要看到真实数据得先把后端跑起来，步骤见 `qgents` 仓库的 README。

```sh
cp .env.example .env
npm ci
npm run dev      # http://localhost:5173
npm run lint
npm run test:run
npm run build
```

`.env` 里 `VITE_USE_MOCK=false` 时请求打到 `API_PROXY_TARGET`（默认 `http://localhost:8080`），Vite 会把 `/api` 转发并重写成 `/api/v1`。

没有后端也能看界面：把 `VITE_USE_MOCK` 设成 `true`，页面用 MSW 拦截请求并由 `src/mocks` 返回假数据。演示环境里任意非空账号都能登录，注册验证码固定是 `483920`。Mock 只模拟界面和接口协议，不执行真实的 GitHub、Agent 或对象存储操作。

## 目录结构

```text
src/api/         接口封装与请求客户端，一个模块一个文件
src/components/  通用组件；ui/ 是设计系统那层
src/features/    按业务切片的功能代码（如 agent 运行）
src/layouts/     AppShell：64px 竖轨 + 56px 顶栏
src/mocks/       MSW 处理器与假数据
src/pages/       页面，按业务分目录
src/realtime/    SSE 与 WebSocket 客户端
src/routes/      路由表与守卫
src/store/       全局 UI 状态
src/styles/      基础样式、UI 样式、antd 覆写
src/theme/       设计变量
src/utils/       格式化、加密等工具
```

## 文档

- `AGENTS.md`：开发规范与提交约定

领域词（什么叫项目记忆、群记忆、来源群）看后端仓库的 `GLOSSARY.md`。

## 参与开发

项目还在 MVP 阶段，接口和页面会随实现改。提交前跑 `npm run lint` 和 `npm run test:run`；改动大一点的话先开 issue 说清楚要解决什么。

## License

[MIT](LICENSE)
