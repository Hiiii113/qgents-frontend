# 当前前端接口对接

依据 `../qgents/src/main/java/qg/qgent` 当前 Controller、DTO 和 Service 核对，更新时间：2026-10-05。产品方向见后端 `docs/target.md`。本文件只记录前端正在使用的接口；接口字段以当前后端实现为准。

## 项目与聊天

每个项目自动拥有一个默认群聊，项目成员可创建新群并邀请项目成员及当前团队可用 Agent。默认群对项目成员开放，新群仅向群成员开放。群聊无独立简介字段，创建、修改、群响应和 Agent 上下文均不携带简介；群名通过 `title` 修改。创建项目只传 `name`、`description`、可选 `memberIds`，仓库随后按需导入。项目读写、成员增删和角色调整、头像、归档与恢复使用 `ProjectController` 接口；不存在项目 `/settings` 配置接口，也不再通过退出群聊退出项目。

| 操作 | 接口 |
| --- | --- |
| 项目群聊 | `GET /projects/{projectId}/groups` |
| 创建群聊 | `POST /projects/{projectId}/groups`，只传 `title`、`userIds`、`agentIds` |
| 邀请群成员 | `POST /projects/{projectId}/groups/{groupId}/members` |
| 群聊成员 | `GET /projects/{projectId}/groups/{groupId}/members` |
| 历史消息 | `GET .../messages?cursor=&limit=30`，倒序返回 |
| 增量消息 | `GET .../messages/incremental?afterSequence=&limit=100`，序号升序返回 |
| 定位消息 | `GET .../messages/{messageId}` |
| 发送消息 | `POST .../messages`，返回 `data: MessageResponse` |
| 停止 Agent | `POST .../messages/{messageId}/cancel-agent`，返回 `cancelledRuns` |
| 已读 | `POST .../read`，返回 `lastReadSequenceNo` |
| 置顶 | `PUT .../pin`，请求 `{ pinned: boolean }` |

公开发送类型为 `TEXT/CODE/IMAGE/FILE`，响应还包含 `SYSTEM`。请求使用结构化 `content`、可选 `mentions`、可选 `replyToId` 和 `clientMessageId`。回复保持原类型，使用 `replyToId + content`，不发送 QUOTE、replyText 或 Task 配置。普通消息不触发 Agent；明确的 `{ type: 'AGENT', id }` 提及才发起执行。停止权限由后端校验，前端提供给原发送者及项目管理员。

消息使用同一请求链路。发送重试复用消息 ID 和幂等键，增量同步按服务端 sequence 去重。WebSocket 只提供刷新信号；断线恢复和可见页面轮询通过 REST 补齐。当前没有公开 Agent 执行进度或 token 流接口，前端不虚构运行状态。

## Agent 与知识

Agent 在团队层管理：`GET/POST /teams/{teamId}/agents`、`GET/PATCH .../{agentId}` 及 `publish/approve/reject/archive`。列表返回 `data: AgentResponse[]`。支持昵称（`name`）、头像（`avatar`）、用途标签、说明、prompt、githubEnabled；默认 Agent 仅允许团队管理员（TEAM_OWNER）修改 `name` 与 `avatar`，不能共享或归档。创建者可编辑自己的 Agent，团队所有者审批共享。头像使用 `POST /teams/{teamId}/agents/avatar/credential` → 直传 → `POST .../avatar/confirm` 返回 URL，再随创建或编辑请求保存 `avatar`。

Skill 与 Memory 在项目层维护。详情中提供编辑、提交审核、批准、拒绝和归档，不依赖交付中心。Skill 创建者或管理员可编辑未归档内容，发布内容修改立即生效；Memory 仅草稿及审核中可编辑，已发布知识归档需要管理员。独立 AI 沉淀草稿接口已移除，Memory 响应不再包含该流程的 `source` 与 `sources` 字段。后续由聊天中的 Agent 调用 Memory 工具操作知识，当前尚未实现写入工具。

## 可选 GitHub 能力

Agent 使用 `githubEnabled` 布尔开关，默认关闭；开启后使用团队 GitHub App 授权。创建、编辑通过该字段设置，默认 Agent 由团队所有者调用 `PUT /teams/{teamId}/agents/{agentId}/github-capability`，请求 `{ enabled: boolean }`。前端提供表单开关及默认 Agent 的开关入口。

团队 GitHub App 安装：`/teams/{teamId}/integrations/github/installations`，连接请求附带 `client=WEB`，返回 `installationUrl`。安装数据使用 `suspended`，不使用历史 `status`。团队所有者可以连接、同步和移除安装记录。

授权仓库：`GET /teams/{teamId}/integrations/github/repositories`，返回 `installationId`、数字 `repositoryId`、`fullName/defaultBranch/htmlUrl/privateRepository`。项目仓库使用 `GET/POST /projects/{projectId}/repositories`；导入仅传 `{ installationId, repositoryId }`。已导入记录的本地 `id` 与数字 `providerRepositoryId` 不混用。移除使用本地记录 ID，不删除 GitHub 仓库。

前端不调用个人 OAuth、自动新建仓库、工作分支、Task、Diff、MR、Testset、DryRun、质量门禁或群归档接口。代码协作由聊天里的 Agent 处理，成果链接可直接打开 GitHub。

## 保留的通用能力

登录、注册、验证码、密码重置、个人资料、团队与邀请、项目成员、通知及头像保留现有请求链。通知类型为 `MESSAGE_MENTION/INVITED/TEAM_JOINED/PROJECT_ADDED`；提及通知打开项目聊天并定位 `resourceId` 对应消息。

附件按配置使用本地磁盘或 OSS，走签发上传凭证、上传、确认、预览/下载链路。IMAGE/FILE 消息必须携带 `attachmentId`，媒体类型使用 `mediaType`，不从 URL 推断附件 ID。团队当前成员身份统一使用 `role`。Mock 是演示数据，不能证明生产环境已接通外部存储、GitHub 或 Agent。

登录后调用 GET /me，返回 user、带头像的 teams、projects 与 currentTeamId；服务端恢复最近团队，失去权限时回退到首个可用团队，无团队时返回 null。PUT /me/current-team 请求 { teamId } 保存最近选择并校验成员权限。退出登录清除当前团队和账户查询缓存。

已删除无入口的团队动态和重复的跨项目聊天页、独立创建项目页及对应专用查询。当前通过首页项目列表进入项目群聊，创建项目统一使用首页弹窗；不使用团队或项目按活跃时间排序的旧接口。
