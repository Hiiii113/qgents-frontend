# Qgents 前端

React 19 + TypeScript strict + Ant Design 6。以项目聊天组织团队协作，每个项目拥有自己 ID 的默认 Agent 并可按需申请自定义 Agent，只有显式 @ 已启用的 Agent 才触发工作；按需维护 Skill、项目记忆和 GitHub 仓库。GitHub 使用团队 GitHub App 授权，项目管理员导入需要的仓库，没有项目级开关。

## 开发

```powershell
npm ci
npm run dev
npm run lint
npm run test -- --run
npm run build
```

真实后端配置 `VITE_API_BASE_URL`，本地演示使用 `VITE_USE_MOCK=true`。演示环境登录任意非空账号即可，注册验证码为 `483920`。Mock 只模拟界面与 API 协议，不执行真实 GitHub / Qgent / 对象存储操作。

## 项目说明

- 协作规范：[AGENTS.md](AGENTS.md)
- 当前接口：[docs/api/qgents-api-current.md](docs/api/qgents-api-current.md)
- 技术约束：[docs/frontend/tech-stack.md](docs/frontend/tech-stack.md)
- 页面目录及聊天性能：[docs/frontend/structure.md](docs/frontend/structure.md)
- 部署：[docs/frontend/deployment.md](docs/frontend/deployment.md)

后端仓库为 `../qgents`，当前能力与领域词见其 `README.md`、`GLOSSARY.md`；接口以当前 Controller / DTO / Service 为准。
