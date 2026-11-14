# 当前前端接口对接

依据 `../qgents/src/main/java/qg/qgent` 当前 Controller、DTO 和 Service 核对，更新时间：2026-11-13。后端能力与领域词见其 `README.md`、`GLOSSARY.md`。本文件记录前端在用的接口，以及前端不调用但会解释界面行为的相邻协议；接口字段以当前后端实现为准。

## 项目与聊天

每个项目创建时生成自己的默认 Agent（名称 Qgent，ID 自增，项目之间互不复用），并自动拥有一个包含该默认 Agent 的默认群聊；项目成员可创建新群，按需邀请项目成员及本项目已启用的 Agent。默认群对项目成员开放，新群仅向群成员开放。群聊无独立简介字段，创建、修改、群响应和执行上下文均不携带简介；群名通过 `title` 修改。聊天协议保留 `AGENT` 成员类型，成员 ID 为用户 ID 或该项目的 Agent ID；创建或邀请请求的 `agentIds` 只能包含本项目已启用的 Agent。创建项目只传 `name`、`description`、可选 `memberIds`，仓库随后按需导入。项目读写、成员增删和角色调整、头像、归档与恢复使用 `ProjectController` 接口；`PATCH /projects/{projectId}` 只更新 `name`、`description`、`avatarUrl`，三者都不传时返回 422；不存在项目 `/settings` 配置接口，也不再通过退出群聊退出项目。

| 操作             | 接口                                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 项目群聊         | `GET /projects/{projectId}/groups`                                                                                                                                      |
| 创建群聊         | `POST /projects/{projectId}/groups`，只传 `title`、`userIds`、`agentIds`                                                                                                |
| 项目已启用 Agent | `GET /projects/{projectId}/agents`，返回 `id`、`name`、`description`、`avatarUrl`、`defaultAgent`、`status`，只含 `ACTIVE`                                              |
| 提交 Agent 申请  | `POST /projects/{projectId}/agents/applications`，传 `name`、`systemPrompt`，可选 `description`、`avatarUrl`；成功为 201，返回完整 `AgentResponse`（`status: PENDING`） |
| 邀请群成员       | `POST /projects/{projectId}/groups/{groupId}/members`                                                                                                                   |
| 群聊成员         | `GET /projects/{projectId}/groups/{groupId}/members`                                                                                                                    |
| 历史消息         | `GET .../messages?cursor=&limit=30`，倒序返回                                                                                                                           |
| 增量消息         | `GET .../messages/incremental?afterSequence=&limit=100`，序号升序返回                                                                                                   |
| 定位消息         | `GET .../messages/{messageId}`                                                                                                                                          |
| 发送消息         | `POST .../messages`，返回 `data: MessageResponse`                                                                                                                       |
| 停止 Qgent 工作  | `POST .../messages/{messageId}/cancel-agent`，返回 `cancelledRuns`                                                                                                      |
| 运行事件         | `GET .../agent-events`（SSE），建连即下发活动运行快照                                                                                                                   |
| 最近运行         | `GET /projects/{projectId}/agent-runs?groupId=&limit=`，`limit` 1～50，默认 20                                                                                          |
| 已读             | `POST .../read`，返回 `lastReadSequenceNo`                                                                                                                              |
| 置顶             | `PUT .../pin`，请求 `{ pinned: boolean }`                                                                                                                               |

公开发送类型为 `TEXT/CODE/IMAGE/FILE`，响应还包含 `SYSTEM`。请求使用结构化 `content`、可选 `mentions`、可选 `replyToId` 和 `clientMessageId`。回复保持原类型，使用 `replyToId + content`，不发送 QUOTE、replyText 或 Task 配置。普通消息不触发工作；明确的 `{ type: 'AGENT', id }` 提及才触发该 Agent，且被提及的 Agent 必须是当前群成员，否则返回 422 `AGENT_NOT_IN_GROUP`。Agent 消息响应使用 `senderType: 'AGENT'`、真实 `senderId` 与 `senderName`。停止权限由后端校验，前端提供给原发送者及项目管理员。

消息使用同一请求链路。发送重试复用客户端消息 ID（clientMessageId），服务端据此去重；增量同步按服务端 sequence 去重。WebSocket 只提供刷新信号；断线恢复和可见页面轮询通过 REST 补齐。运行进度与正文增量见“Agent 运行”。

## 项目 Agent 与知识

Agent 属于项目：每个项目有独立默认 Agent，任一项目成员可申请自定义 Agent（名称、描述、系统提示词、可选头像，名称最长 120、系统提示词最长 20000）。提交后只落库，**不会自动在群里发消息**；管理员需在项目默认群回复并 `@Agent`，由 Agent 工具 `list_pending_agent_applications` 取出待审批列表后，按申请 ID 调 `approve_agent_application` 或 `reject_agent_application`，服务端核验真实发送者的管理员身份、申请所属项目与状态。项目内 Agent 数量上限默认 10（含待审批，超出返回 409 `AGENT_LIMIT_REACHED`）。前端只展示申请状态，不自行审批，也没有独立 Agent 管理页；群设置只能邀请已启用的 Agent，待审批申请不会出现在邀请列表里；Agent 与人在成员列表、`@` 补全和消息渲染中按成员类型与真实 ID 区分，名称与头像使用后端返回的值。

Skill 与项目记忆在项目层维护。Skill 保留编辑、提交审核、批准、拒绝和归档：创建者或管理员可编辑未归档内容，发布内容修改立即生效。项目记忆是项目目录下的单个 `memory.md`，用 `GET /projects/{projectId}/memory` 读取 `projectId`、`content` 和 `updatedAt`，项目成员均可读；没有 `version` 字段，也没有通过 REST 保存的接口。写入只由聊天中的 Qgent 调 `read_project_memory`、`write_project_memory`（整篇）和 `edit_project_memory`（按唯一原文片段替换），服务端核验真实发送者是项目管理员，并且需管理员在对话中明确确认。前端页面只读，提供去聊天入口，不提供直接编辑、草稿、审核或归档。群记忆用 `GET /projects/{projectId}/groups/{groupId}/memory` 读取，仅项目管理员且属于该群时可读，由后台提炼、成员通过对话纠错；前端不调用。Agent 私有记忆只由该 Agent 自己写，前端不涉及。

## GitHub 能力

项目没有 GitHub 开关。团队连接 GitHub App 授权仓库，项目管理员把需要的仓库导入项目，Qgent 即可使用团队 App 授权且已导入当前项目的仓库；该能力不绑定到用户可配置的 Agent 身份。项目设置的基本信息页不再显示 GitHub 开关，团队连接页与项目仓库导入页保留。

团队 GitHub App 安装：`/teams/{teamId}/integrations/github/installations`，连接请求附带 `client=WEB`，返回 `installationUrl`。安装数据使用 `suspended`，不使用历史 `status`。团队所有者可以连接、同步和移除安装记录。

授权仓库：`GET /teams/{teamId}/integrations/github/repositories`，返回 `installationId`、数字 `repositoryId`、`fullName/defaultBranch/htmlUrl/privateRepository`。项目仓库使用 `GET/POST /projects/{projectId}/repositories`；导入仅传 `{ installationId, repositoryId }`。已导入记录的本地 `id` 与数字 `providerRepositoryId` 不混用。移除使用本地记录 ID，不删除 GitHub 仓库。

前端不调用团队 Agent 管理、Agent 审批接口、个人 OAuth、自动新建仓库、工作分支、Task、Diff、MR、Testset、DryRun、质量门禁或群归档接口。代码协作由聊天里的 Qgent 处理，成果链接可直接打开 GitHub。

## 保留的通用能力

登录、注册、验证码、密码重置、个人资料、团队与邀请、项目成员、通知及头像保留现有请求链。通知类型为 `MESSAGE_MENTION/INVITED/TEAM_JOINED/PROJECT_ADDED`；提及通知打开项目聊天并定位 `resourceId` 对应消息。

附件按配置使用本地磁盘或 OSS，走申请上传、上传文件、确认、预览/下载链路。OSS 返回签名 PUT 地址供浏览器直传，本地返回后端 PUT 地址；前端使用返回的方法与请求头，仅对当前 API 来源及路径的上传添加登录凭证。确认成功后才返回可用于消息的附件 ID。IMAGE/FILE 消息必须携带 `attachmentId`，媒体类型使用 `mediaType`，不从 URL 推断附件 ID。团队当前成员身份统一使用 `role`。Mock 是演示数据，不能证明生产环境已接通外部存储、GitHub 或 Qgent 工作环境。

登录后调用 GET /me，返回 user、带头像的 teams、projects 与 currentTeamId；服务端恢复最近团队，失去权限时回退到首个可用团队，无团队时返回 null。PUT /me/current-team 请求 { teamId } 保存最近选择并校验成员权限。退出登录清除当前团队和账户查询缓存。

当前入口是首页项目列表进项目群聊，创建项目统一用首页弹窗；不使用团队或项目按活跃时间排序的旧接口。

## Agent 运行

`GET /projects/{projectId}/groups/{groupId}/agent-events`（SSE）订阅群级运行事件：建连先下发快照，之后推送正文增量、阶段与工具事件；事件带 `revision`（状态版本）和 `seq`（正文缺口序号），旧快照不会把已完成的工具改回执行中。`GET /projects/{projectId}/agent-runs?groupId=&limit=` 返回群内最近运行（含子运行），用于刷新和 SSE 不可用时的轮询。断线后前端按快照补齐再续 SSE，重新进入群聊同样先取快照，不依赖事件重放。

快照与工具事件中的 `tools[]` 为 `{ toolCallId, tool, round, state, input, output }`：`state` 取 `running/ok/failed/done`，`input` 与 `output` 是服务端截断到 2000 字符的工具入参与结果（可能为 null）。`agent-run.tool` 事件在 `started` 带 `input`、`finished` 带 `output`。工具调用落库，运行结束后仍随快照返回，重新进群不会丢失历史。

运行状态为 `RUNNING/CANCELLING/CANCELLED/SUCCEEDED/FAILED`。最终回复由服务端以 `clientMessageId = qgent-reply:<rootRunId>` 写入，前端据此替换临时正文；同一条消息 `@` 多个 Agent 时各自替换自己的回复。停止按触发消息取消该消息下的活动根运行，权限由后端校验（原发送者或项目管理员）。

边界：正文增量只存在服务进程内存，多实例部署下其他实例看不到同一段增量，重启会丢掉未完成正文（终态、最终消息与工具调用记录仍在库里）；群级 SSE 每 10 秒复检一次群成员权限。
