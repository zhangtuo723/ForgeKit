# ForgeKit

基于 Next.js、React、TypeScript 和 MySQL 的模块化工作空间。当前子项目为「幕间 Studio」剧本创作与人物资产管理系统，网页与外部 Agent 使用同一套业务接口和数据。

## 功能

- 剧本库：新建、搜索、状态筛选、删除，TXT / Markdown 导入和导出。
- 在线编写：自动保存、Ctrl/Cmd+S、场景/对白/动作模板、实时字数、故事梗概。
- 保存保护：revision 乐观锁、冲突暂停、本地未提交草稿恢复与导出，避免 Agent 和网页相互覆盖。
- 人物档案：人物小传、角色定位、性格、外貌、所属剧本和封面。
- 人物资产：多图上传、拖拽、剪贴板图片粘贴、预览、重命名、下载、删除。
- Agent API：独立密钥、只读/读写权限、有效期、撤销、调用示例与 OpenAPI 文档。
- 工作台、真实操作日志、工作空间设置、数据库管理员账号登录。

初始剧本库和人物库为空，不生成演示内容。旧版数据已保留，原项目/成员界面跳转到剧本/人物页面。

## 本地运行

要求 Node.js 22.13 或更新版本、npm；本机通过 SSH 连接云端数据库时还需要 OpenSSH 客户端。

```bash
npm ci
npm run db:check
npm run dev
```

打开 [工作室登录页](http://127.0.0.1:3000/studio/login)，使用已初始化的管理员账号登录。旧版固定账号密码已停用；新环境需要先按下述步骤创建账号。

`npm run dev` 和 `npm start` 会读取 `.env.local`。配置了 `DB_TUNNEL_HOST` 时，启动脚本自动建立 SSH 通道并验证 MySQL；已有可用通道会复用。退出时只清理本次启动的进程。开发构建默认 `.next-dev`，生产构建默认 `.next`。

启动器只向 Next 传递原始 shell 覆盖值与必要的隧道参数，由 Next 自己读取环境配置。这样开发服务自动重启后仍会读取最新 `.env.local`，不会继承旧的“已加载”标记而漏掉 COS 配置。`npm run test:env` 使用合成配置验证这条启动与重启流程，不访问真实凭证或云服务。

首次配置时，将 `.env.example` 复制为 `.env.local`，填写 MySQL、SSH 通道和 COS 的服务端配置。真实凭证不提交 Git，也不添加 `NEXT_PUBLIC_` 前缀。

## 模块地址

网站根路径 `/` 是公开模块入口。剧本工作室的页面统一位于 `/studio/*`，API 统一位于 `/api/studio/*`，为后续模块保留独立地址空间。

对应源码分别放在 `src/app/studio/` 和 `src/app/api/studio/`。这里使用实际路由目录隔离模块，不设置全站 `basePath`；后续功能可新增同级模块目录，并在根页面的模块列表中加入入口。

| 用途 | 地址 |
| --- | --- |
| 登录 | `/studio/login` |
| 工作台 | `/studio/dashboard`（`/studio` 会跳转到这里） |
| 剧本库与编辑器 | `/studio/scripts`、`/studio/scripts/{id}` |
| 人物与资产 | `/studio/characters`、`/studio/assets` |
| Agent API、设置与日志 | `/studio/integrations`、`/studio/settings`、`/studio/activity` |
| API 描述 | `/api/studio/openapi` |

旧 `/login`、`/dashboard`、`/scripts` 等页面及旧 API 地址保留 307 跳转，保留查询参数和请求方法；新调用直接使用上述地址。旧项目、成员页面分别跳转至 `/studio/scripts`、`/studio/characters`；旧通用项目、成员、统计和日志 API 迁入 `/api/studio/legacy/{projects,users,dashboard,activities}`。工作室统计与日志仍为 `/api/studio/overview`、`/api/studio/activities`。

## 管理员账号与密码

登录账号保存在 MySQL。密码使用每次独立生成的随机盐和 scrypt 计算哈希，数据库保存算法参数、盐及哈希值，不保存明文密码。应用源码与 `.env.local` 不再定义登录账号密码。

在项目目录运行账号维护脚本，它读取当前 MySQL 配置，并通过标准输入接收密码：

```bash
# 创建账号：必须由安全输入进程向 stdin 提供密码并关闭 stdin
node scripts/set-admin.mjs --username studio_admin --password-stdin

# 重置已存在账号的密码，并撤销该账号的所有登录会话
node scripts/set-admin.mjs --username studio_admin --password-stdin --reset-password
```

以上命令需由进程管道以 UTF-8 提供密码，脚本拒绝从交互终端直接读取。可以用密码管理器，或由 PowerShell `Read-Host -AsSecureString` 隐藏读取，再由调用进程仅在内存中转换并写入标准输入。不要把真实密码写在命令参数、环境变量、源文件或临时文本文件中，也不要使用带明文密码的 `echo` 命令。标准输入结束后脚本才开始处理，只移除末尾一个换行，其余空格保留。

用户名为 3～80 位，首位必须是 ASCII 字母或数字，其余可用 ASCII 字母、数字或 `_ . @ + -`；密码为 8～256 个字符，不能含空字符或换行。默认创建模式遇到已有用户名会拒绝覆盖；只有显式传入 `--reset-password` 才会重置已有账号。重置后该账号需要重新登录。

## 数据库与访问通道

当前 MySQL 8.4 是云服务器上的独立 systemd 服务 `mysqld`，不随 Next.js 停止，已配置开机自启。本机经 SSH 连接：

```text
Next.js → 127.0.0.1:13306 → SSH 加密通道 → 云服务器 127.0.0.1:3306
```

- 正式数据库：`forge_studio`。
- 隔离测试数据库：`forge_studio_test`。
- 应用账号：`forge_studio_app`，只拥有上述数据库所需的读写和建表权限。
- MySQL 只监听服务器回环地址，不暴露公网 3306。
- 本机 `.env.local` 已配置连接凭证、专用 SSH 私钥位置和固定服务器主机公钥，均不提交 Git。
- 数据库密码不进入浏览器；API 密钥只在创建时显示完整内容，数据库仅保存哈希。
- 登录账号与会话也保存在 MySQL，登录密码哈希与数据库连接凭证分别管理。

`.env.example` 说明配置项。服务器上直接运行应用时，使用 `MYSQL_HOST=127.0.0.1`、`MYSQL_PORT=3306`，去掉本地 `DB_TUNNEL_*` 配置。若改为直接 TLS 访问数据库，可设置 `MYSQL_SSL=true` 和 `MYSQL_SSL_CA_FILE`，证书校验保持开启。

MySQL 运维文件位于服务器：

- 服务配置：`/etc/my.cnf.d/forge-studio.cnf`。
- 数据目录：`/var/lib/mysql`。
- 管理员凭证：`/root/.config/forge-studio/mysql-credentials.json`，权限 0600，不属于应用仓库。

可在服务器执行 `systemctl status mysqld` 检查服务。

## 图片与剧本文件

剧本文字、人物信息、图片关联、会话、日志和 API 密钥哈希保存在 MySQL。**新增人物图片存入腾讯云 COS，并逐对象设置私有访问权限**；MySQL 保存图片名称、尺寸、人物关联及存储位置等元数据。

上传文件、拖拽和剪贴板粘贴共用同一条流程：服务端验证图片并转为 WebP → 上传私有 COS 对象 → 保存 MySQL 元数据。网页和 Agent 继续通过 `/api/studio/assets/{id}/file` 读取或下载；接口校验登录会话或 Agent 密钥后，由服务端读取 COS 并返回图片，不向浏览器提供 COS 密钥或公开对象链接。

当前配置使用桶 `test-1301661941`、地域 `ap-nanjing`、对象前缀 `forge-studio/`。设置 `COS_BUCKET`、`COS_REGION`、`COS_PREFIX`、`COS_SECRET_ID`、`COS_SECRET_KEY`；临时凭证还需 `COS_SESSION_TOKEN`。凭证应限制在应用使用的对象范围，允许上传、读取和删除。桶本身的公开设置不会被应用修改，实际对象需要保持私有，不能由额外的公开桶策略放行。

本地开发和阿里云服务器通过 HTTPS 访问同一份 COS 图片，并共用 MySQL 元数据。浏览器只请求应用的鉴权接口，因此无需配置浏览器直连 COS 的 CORS，也无需公开图片 URL。部署时不再同步 `data/uploads/`。旧本地图片可用下述迁移脚本导入，源文件保留作为备份；`FORGE_DATA_DIR` 继续指定旧文件和本地备份目录。

- 剧本导入：`.txt`、`.md`、`.markdown`，单文件 2 MB 内，正文最多 20 万字符。优先 UTF-8，兼容 UTF-8 BOM 和 GB18030 文本。
- Markdown 保留原始文本，不执行 HTML。
- 图片：静态 PNG、JPEG、WebP，单文件 10 MB 内、2500 万像素内。验证后统一转为 WebP，下载得到转换后的图片。
- 剪贴板：选择人物后，点击“粘贴图片”或聚焦上传区按 Ctrl+V / Cmd+V。读取按钮需要浏览器允许剪贴板访问；拒绝后仍可用快捷键粘贴或选择文件。
- 删除剧本会解除人物关联，保留人物及图片；删除人物会删除其关联图片。

## Agent API

登录后进入“Agent API”，为每个 Agent 创建独立密钥。权限可以是只读或读写，有效期支持 30、90、365 天。

```bash
# 将密钥保存到调用进程的 FORGE_API_KEY 环境变量
curl http://127.0.0.1:3000/api/studio/scripts \
  -H "Authorization: Bearer $FORGE_API_KEY"
```

支持剧本和人物 CRUD、文件导入导出、图片上传及读取、工作室统计。Agent 可以操作业务数据，不能管理密钥或修改管理员设置。

更新剧本前先 GET `/api/studio/scripts/{id}`，再将返回的 `revision` 随 PATCH 请求提交。HTTP 409 表示版本冲突，需重新读取、合并后提交，不能盲目覆盖。

成功返回 `{ "data": ... }`，错误返回 `{ "error": "..." }`；文件和 OpenAPI 返回原始内容。使用 `/api/studio/openapi` 获取完整接口定义，也可以在页面下载。认证头为 `Authorization: Bearer YOUR_API_KEY`，Agent 无需网页 Cookie 或 Origin。

本地地址只能供本机程序调用。外部 Agent 要从互联网调用，需要部署此 Next.js 应用，并将示例地址替换为实际 HTTPS 域名。仅安装 MySQL 不会发布 HTTP API。

## 构建与部署

```bash
npm run typecheck
npm run build
npm start
```

在 Linux 服务器上安装依赖和构建，使用 nginx HTTPS 反向代理到应用端口，设置 `FORGE_APP_URL` 为公开 HTTPS 来源，例如 `https://forgekit.cn`，不附加 `/studio` 或 `/api/studio`。nginx 上传限制至少设为 `client_max_body_size 12m;`，否则大图会被代理拒绝。

现有云服务器上的旧网站尚未被这套管理系统替换。发布新应用时保留独立 MySQL 数据，在服务器配置同一组 COS 桶、地域、对象前缀及服务端凭证，即可读取已上传的人物图片。

## 检查与迁移

```bash
npm run db:check
npm run cos:check
npm run typecheck
npm run build
```

`npm run cos:check` 会上传一个随机名称的无敏感内容临时文件，检查签名读取、匿名访问被拒绝及删除结果，随后清理本次测试对象；它不会更改桶的权限或其他对象。

集成测试必须使用 `forge_studio_test` 和独立 COS 前缀 `forge-studio/_qa/<run>/`，不能指向正式数据库或正式图片前缀。应用进程和测试进程使用同一个本次测试专用前缀。两个 PowerShell 终端示例（每次运行更换 `20261106-001`）：

```powershell
# 终端一：覆盖 .env.local 中的正式数据库
$env:MYSQL_DATABASE = 'forge_studio_test'
$env:FORGE_DATA_DIR = "$PWD/tmp/studio-qa"
$env:COS_PREFIX = 'forge-studio/_qa/20261106-001/'
$env:NEXT_BUILD_DIR = '.next-studio-qa'
npm run dev -- --hostname 127.0.0.1 --port 3002

# 终端二
$env:MYSQL_DATABASE = 'forge_studio_test'
$env:STUDIO_QA_DATABASE = 'forge_studio_test'
$env:COS_PREFIX = 'forge-studio/_qa/20261106-001/'
$env:API_BASE_URL = 'http://127.0.0.1:3002'
npm run test:studio
npm run test:cos
npm run test:auth
```

`API_BASE_URL` 始终是 `http://127.0.0.1:3002` 这样的纯来源地址，不添加模块路径；测试脚本自行请求 `/api/studio/*` 和 `/studio/*`。`npm run test:api` 还覆盖公开模块入口、新页面访问、旧地址 307 跳转及 POST 方法保留。

`test:studio` 覆盖导入导出、长正文、版本冲突、人物与图片关联、上传校验、认证与权限隔离、密钥撤销、日志及 OpenAPI。`test:cos` 额外验证图片 API 与 COS 对象、MySQL 存储映射是否一致；它先校验应用使用隔离测试数据库，再创建本轮资源，并检查对象位于本轮测试前缀。两个终端中的数据库和 COS 前缀必须一致。测试仅清理本轮创建的资源，测试日志保留；不要对正式数据库运行写入测试。

认证测试 `test:auth` 与各 API 测试会在 `forge_studio_test` 创建本轮随机管理员账号，密码仅存在测试进程内存中，结束后删除该账号及其会话。测试不需要正式管理员密码，也不依赖旧固定账号；开始前会验证目标应用确实连接隔离测试数据库。

将旧本地图片迁入 COS：

```bash
# 默认仅预检；读取当前 MYSQL_DATABASE 与 FORGE_DATA_DIR/uploads
npm run cos:migrate -- --dry-run
# 确认目标数据库、桶和前缀后执行
npm run cos:migrate -- --apply
```

迁移脚本只处理尚无 COS 存储映射的图片，检查本地文件大小和 WebP 格式，上传后逐字节核对下载内容并确认匿名访问被拒绝，再切换数据库映射。图片 ID、人物关联及封面保持不变，原本地文件保留作为备份；已完成的图片会跳过，可在排除失败原因后重跑。不要手动删掉源文件或替换已有图片 ID。

图片删除会自动尝试清理 COS 对象，多图删除会继续在响应后分批处理。删除失败或上传中断时，MySQL 中的待办记录会保留，供检查和重试：

```bash
# 默认 dry-run，仅统计已到执行时间的任务
npm run cos:cleanup -- --dry-run --limit 20
# 执行本批清理；失败任务记录原因并推迟下次重试
npm run cos:cleanup -- --apply --limit 20
```

清理脚本仅处理当前数据库记录的到期任务，不扫描或批量删除整个桶；仍被有效图片引用的对象会保留。如果迁移提示 `PENDING_CLEANUP_RUN_COS_CLEANUP_FIRST`，先排除存储访问错误并执行清理，再重跑迁移。暂未到执行时间的任务需到期后重试。清理时必须使用产生任务的数据库配置和对应 COS 凭证；配置了 `DB_TUNNEL_HOST` 时，迁移和清理脚本会自行建立或复用 SSH 通道。

旧 SQLite 只作为迁移来源保留，运行时已全部使用 MySQL。一次性迁移脚本：

```bash
node scripts/migrate-sqlite-to-mysql.mjs --sqlite data/forge-admin.sqlite --database forge_studio --dry-run
# 停止应用、备份源数据，并确认目标为空后：
node scripts/migrate-sqlite-to-mysql.mjs --sqlite data/forge-admin.sqlite --database forge_studio --apply
```

正式数据库迁移已经完成，**不要重复执行**。脚本拒绝覆盖非空目标，保留 ID、版本、会话和时间戳，事务导入后逐表核对记录数。旧文件和本地备份仍留在 `data/` 下，图片文件不放入 MySQL。
