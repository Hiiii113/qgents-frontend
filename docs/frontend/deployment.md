# 开发与部署

使用 Node.js 24，运行 `npm ci`，将 `.env.example` 复制为 `.env`。

## 本地开发

- `VITE_USE_MOCK=false` 连接真实后端，演示时设为 `true`。
- `VITE_API_BASE_URL=/api` 通过 Vite 代理访问后端。
- `API_PROXY_TARGET=http://localhost:8080` 为代理目标，`/api` 转换为 `/api/v1`，支持 WebSocket。
- 独立 API 域名可填写 `VITE_API_BASE_URL=https://api.example.com/api/v1`。
- 自定义开发域名填写 `DEV_ALLOWED_HOSTS`，多项用逗号分隔。

运行 `npm run dev`，默认入口为 `http://localhost:5173`；修改配置后重启 Vite。

## 登录加密

登录密码使用 RSA/ECB/PKCS1Padding。`VITE_RSA_KEY_ID` 和 `VITE_RSA_PUBLIC_KEY` 必须对应后端 keyId 和私钥。未指定公钥时使用源码中的项目公钥，更换后端私钥后需配置对应公钥并重新构建。PEM 换行可使用字面量 `\n`。

## Docker 生产部署

从后端仓库启动 `docker-compose.production.yml`，同时构建 API 与本仓库的 Web。默认两个仓库并列，也可通过后端 `FRONTEND_DIRECTORY` 指定路径。

```sh
docker compose -f docker-compose.production.yml --profile images build
docker compose -f docker-compose.production.yml up -d
```

Dockerfile 使用 Node.js 构建静态资源，Nginx 提供页面。生产构建关闭 Mock，使用同源 `/api`；Nginx 将 API 和 WebSocket 转发到 `api:8080/api/v1/`，支持 SPA 路由和长连接。

数据库、模型、邮件、目录权限和登录私钥准备步骤见后端 README。前端 API 地址与 RSA 配置在构建时生效，修改后重建 Web 镜像。

可使用现有反向代理提供 HTTPS，或启用后端 Compose 的 `tunnel` profile，将 Cloudflare Web 路由指向 `http://web:80`。GitHub App 回调填写实际公网 `/api/integrations/github/callback` 地址。

## 验证

```sh
npm run lint
npm run test:run
npm run build
```

Mock 检查界面和 API 协议，不执行真实 Agent、GitHub 或 OSS 操作。
