# ForgeKit

基于 Next.js、React、TypeScript 和 MySQL 的模块化工作空间。包含「幕间 Studio」剧本创作与人物资产管理系统，以及「DDS」3D 交互简历。工作室网页与外部 Agent 使用同一套业务接口和数据；简历是独立的静态页面。

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
| DDS 交互简历（公开，无需登录） | `/resume` |
| 登录 | `/studio/login` |
| 工作台 | `/studio/dashboard`（`/studio` 会跳转到这里） |
| 剧本库与编辑器 | `/studio/scripts`、`/studio/scripts/{id}` |
| 人物与资产 | `/studio/characters`、`/studio/assets` |
| Agent API、设置与日志 | `/studio/integrations`、`/studio/settings`、`/studio/activity` |
| API 描述 | `/api/studio/openapi` |

旧 `/login`、`/dashboard`、`/scripts` 等页面及旧 API 地址保留 307 跳转，保留查询参数和请求方法；新调用直接使用上述地址。旧项目、成员页面分别跳转至 `/studio/scripts`、`/studio/characters`；旧通用项目、成员、统计和日志 API 迁入 `/api/studio/legacy/{projects,users,dashboard,activities}`。工作室统计与日志仍为 `/api/studio/overview`、`/api/studio/activities`。

## DDS 交互简历

`/resume` 在构建时预渲染，页面不请求 MySQL、COS 或 GitHub API，不需要管理员登录。正文包括 DDS 的工作经历、三个核实过公开 README 的开源项目及技术方向；姓名使用 DDS，不展示学校、联系方式或内部部门。项目说明维护在 `src/components/resume/portfolio-data.ts`，工作经历维护在 `ResumeExperience.tsx`，来源链接直接指向公开仓库。

Three.js 滨水创作街区占满页面背景：弧形展馆、锯齿屋顶工坊、圆窗摄影馆与经历步道分别组成地标。支持环视、平移、缩放、WASD 漫游、日夜主题、地标聚焦和视角重置。静止时按需渲染，水面与小船动画默认关闭；重复建筑细节实例化，阴影图只在初始化、主题切换和上下文恢复时更新，不运行实时反射或后处理。浏览器无法运行 WebGL 时保留概念图封面和全部简历入口。

页面使用本地 Fraunces 可变衬线字体（普通与斜体），完整 SIL OFL 1.1 许可证随字体放在 `public/resume/fonts/`。模型由 `harbor-model.ts` 中的独立建筑造型生成，概念图 `public/resume/harbor-concept.webp` 由 image_gen 生成，只用于美术参考、加载和错误封面，提示词见 `docs/resume-art-direction.md`。无第三方字体、模型或图片运行时请求。文字简历保留在 HTML 中，提供独立阅读模式和打印样式，禁用 JavaScript 时直接显示文字版。CSS Modules 将样式限定在此模块内。

`node scripts/render-harbor-preview.mjs` 可离线导出模型的 SVG/PNG 构图预览至忽略的 `artifacts/` 目录。该脚本使用 CPU 几何投影，不访问浏览器；不模拟 WebGL 贴图、阴影和水面效果，也不代表网页截图或真实帧率测试。

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

剧本、人物和图片资产列表使用服务端分页与检索：`page` 默认 1，`pageSize` 默认 12、最大 100，`q` 是最长 200 字符的关键词。剧本搜索标题、类型和梗概，可组合 `status`；人物搜索名称、定位、小传和所属剧本，可组合 `scriptId`（`unlinked` 表示独立人物）。图片资产搜索名称、原始文件名、人物名称和所属剧本，可组合 `characterId` 与 `scriptId`（包括 `unlinked`），并额外返回 `summary: {characters, bytes}`，统计全部匹配图片的人物数与存储字节数。`%`、`_` 和 `!` 按普通字符匹配。返回 `{ "data": [...], "pagination": { "page": 1, "pageSize": 12, "total": 37, "totalPages": 4 } }`，超出末页时回到末页，空结果的页码和总页数均为 1。调用方需要显式翻页，不能把第一页当作完整列表。网页搜索切换条件后回到第一页，支持每页 12 / 24 / 48 条；关联剧本、上传人物等选择器及人物档案内的图片列表也使用按需分页检索。

成功返回 `{ "data": ... }`，错误返回 `{ "error": "..." }`；文件和 OpenAPI 返回原始内容。使用 `/api/studio/openapi` 获取完整接口定义，也可以在页面下载。认证头为 `Authorization: Bearer YOUR_API_KEY`，Agent 无需网页 Cookie 或 Origin。

本地地址只能供本机程序调用。外部 Agent 可使用已部署的 `https://forgekit.cn/api/studio/*`，并携带在工作室中创建的 API Key。接口定义位于 `https://forgekit.cn/api/studio/openapi`。

### Agent 接入 Skill

仓库的 [`skills/forge-studio-api/`](skills/forge-studio-api/SKILL.md) 保存面向外部 Agent 分发的接入 skill，随附 [`forge_studio.py`](skills/forge-studio-api/scripts/forge_studio.py) 命令行脚本，覆盖剧本、人物、图片及导入导出操作。脚本要求 Python 3.10+，只用标准库；地址固定为 `https://forgekit.cn/api/studio`，仅从调用进程环境读取 `FORGE_API_KEY`，无需地址配置或额外依赖。

使用方将整个 `forge-studio-api` 文件夹安装到自己所用 Agent 的 skill 目录。例如，Codex 的项目级安装位置是**使用方项目**中的 `.agents/skills/forge-studio-api/`，参见[官方 skill 目录说明](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)。本仓库的 `skills/` 是分发源目录，不是开发本仓库时自动加载 skill 的目录。

安装并在调用进程环境中配置 `FORGE_API_KEY` 后，即可让 Agent 执行：`使用 $forge-studio-api 列出幕间 Studio 的剧本`。Agent 会调用随附脚本；也可以在本仓库直接执行：

```bash
python skills/forge-studio-api/scripts/forge_studio.py scripts list
```

脚本不读取服务端 `.env.local`，也不接受命令行密钥参数。剧本更新必须显式传入读取到的 `--revision`，409 冲突会直接返回；写入不会自动重试。离线测试使用本地模拟 HTTP 服务和合成密钥，运行 `python -B -m unittest discover -s skills/forge-studio-api/scripts -p test_forge_studio.py`，不连接正式工作室。

## 构建与部署

```bash
npm run typecheck
npm run build
npm start
```

在 Linux 服务器上安装依赖和构建，使用 nginx HTTPS 反向代理到应用端口，设置 `FORGE_APP_URL` 为公开 HTTPS 来源，例如 `https://forgekit.cn`，不附加 `/studio` 或 `/api/studio`。nginx 上传限制至少设为 `client_max_body_size 12m;`，否则大图会被代理拒绝。

2026-11-07 已部署 DDS 滨水交互简历，入口为 [https://forgekit.cn/resume](https://forgekit.cn/resume)，当时部署的代码版本为 `442d6ff8a537c29761887a11d09f79fdbd90704e`。2026-11-06 替换旧站时未备份旧站。

2026-11-14 已部署剧本、人物、人物资产库及人物档案图片的服务端分页和检索，当前应用代码版本为 `e4ff2ac6bad5f2bf245a05c4d7a2ae0b3bacf2de`，OpenAPI 为 1.2.0。入口为 [工作室](https://forgekit.cn/studio/login) 和 [人物资产库](https://forgekit.cn/studio/assets)。继续使用现有 MySQL、COS 图片和生产环境配置，无需数据迁移。上线验证覆盖分页、组合检索、统计总数、已有图片读取、登录及简历静态资源。

- 代码在 `/opt/forgekit/releases/<commit>/`，使用 Linux 上构建的 Next.js standalone 产物，并复制 `.next/static`（如有 `public` 也需复制）到 standalone 目录。
- PM2 应用名为 `forgekit`，配置在 `/etc/forgekit/ecosystem.config.cjs`；Node 通过 `--env-file=/etc/forgekit/studio.env` 加载生产环境变量，监听 `127.0.0.1:3001`。PM2 已保存进程列表，并启用开机恢复。
- PM2 的 `cwd` 与 `script` 均明确指向当前 release，`script` 使用绝对路径。跨 release 切换时不能只修改 `cwd` 后 reload，否则 PM2 可能继续使用缓存的旧入口；切换后核对实际 `pm_exec_path`，再验证 `/resume` 的内容与构建资源。
- nginx 使用 `/etc/nginx/conf.d/forgekit.conf`，通过现有 HTTPS 证书代理到应用，上传限制为 `12m`。
- 生产配置文件权限为 `600`，父目录权限为 `700`。COS 配置经临时公钥加密传输后在服务器解密；MySQL 密码读取服务器已有凭证，连接地址使用 `127.0.0.1:3306`。本地 SSH 隧道参数和 Windows 路径不写入生产配置，登录密码仅以哈希保存在数据库中。
- 数据目录为 `/var/lib/forgekit`，应用日志位于 `/var/log/forgekit`。服务器配置了 2 GiB swap；构建时 Node 堆上限为 768 MiB，运行时为 384 MiB。

部署通道使用阿里云 Workbench CLI：通过已有 RAM 凭据调用 `workbench exec` 和 `workbench upload`，以 `root` 在实例中执行命令。操作者的凭据配置位于 `~/.workbench/config.json`，属于本机配置，不提交到仓库；它是 AK/SK 配置，不是 SSH 私钥。数据库隧道账号 `forge_tunnel` 仅用于端口转发，不能执行部署命令。

上传 Git 源码归档并校验 SHA-256 后，在新 release 目录安装依赖和构建，沿用服务器上的 `/etc/forgekit/studio.env`。先在回环地址的临时端口验证候选服务，再切换正式 PM2 进程；验证完成后清理候选进程并执行 `pm2 save`。保留前一个 release 和切换前的 PM2 配置，以便按相同流程回退。

修改服务器环境变量后重启应用；修改 nginx 配置时先验证再重载。当前 nginx 由独立进程运行，使用其信号重载命令：

```bash
pm2 restart forgekit
nginx -t && nginx -s reload
```

部署验证已覆盖 HTTPS 登录、Cookie 安全属性、已有 COS 图片读取、Agent API 文档、前端静态资源及超过 1 MiB 请求通过 nginx 上传限制。健康检查地址为 `https://forgekit.cn/api/studio/health`，用于检查 MySQL 连通性。

## 检查与迁移

```bash
npm run db:check
npm run cos:check
npm run typecheck
npm run build
```

`npm run cos:check` 会上传一个随机名称的无敏感内容临时文件，检查签名读取、匿名访问被拒绝及删除结果，随后清理本次测试对象；它不会更改桶的权限或其他对象。

集成测试必须使用 `forge_studio_test` 和独立 COS 前缀 `forge-studio/_qa/<run>/`，不能指向正式数据库或正式图片前缀。应用进程和测试进程使用同一个本次测试专用前缀。两个 PowerShell 终端示例（每次运行更换 `20261106-001`）：

启动测试开发服务前，先停止同一 checkout 中其他 `next dev` 服务，避免多个开发服务的热更新相互干扰。需要同时保留日常开发站时，可以使用独立 checkout，或用生产构建运行隔离测试服务。

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
