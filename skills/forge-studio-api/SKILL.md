---
name: forge-studio-api
description: 通过 Agent API 连接 ForgeKit 幕间 Studio，查询或编辑剧本、人物和图片资产。用于工作室接入配置、连接排查及创作数据操作；修改网站源码、部署或数据库运维时不使用。
---

# 幕间 Studio Agent 接入

供工作室使用方安装到自己的 Agent 环境中，通过随附的 [Python CLI](scripts/forge_studio.py) 与工作室网页共享创作数据。要求 Python 3.10+，只用标准库，无需安装依赖。常用操作直接执行脚本，避免临时编写 HTTP 客户端。

## 连接配置

- 服务地址固定为 `https://forgekit.cn/api/studio`，已写在脚本中，无需配置地址环境变量。
- `FORGE_API_KEY`：由用户在 `/studio/integrations` 创建并配置到调用进程环境中的独立 Agent 密钥。缺少时请用户配置；完整密钥仅在创建时显示一次，不能通过 API 找回。
- 脚本从调用进程环境读取 `FORGE_API_KEY`，自动添加 Bearer 认证并拒绝重定向；不读取 `.env.local`，不接受命令行密钥参数。不要将真实密钥写入文件、命令字面量、日志或回复，也不要输出整个环境。
- `read` 密钥允许 GET；`write` 密钥允许 GET、POST、PATCH、DELETE，有效期为 30、90 或 365 天。Bearer 请求不需要网页 Cookie 或 Origin。
- Agent 密钥不能管理其他密钥、修改管理员设置或调用旧管理模块。接入使用业务 API，不直接读写 MySQL、COS，也不读取服务端凭证来绕过接口。

首次接入或排查连接时，先执行 `overview` 验证认证和连通性，再执行 `openapi` 获取接口定义。两者均需认证；不要创建测试剧本来探测连接。后续按需查询 OpenAPI 的字段、枚举和限制，不复制维护另一份完整接口规范。

## 执行脚本

下面示例相对于本 skill 根目录；实际执行时从本文件位置解析脚本的绝对路径，不依赖用户项目的当前目录。查看子命令参数可加 `--help`。

```bash
python scripts/forge_studio.py --help
python scripts/forge_studio.py overview
python scripts/forge_studio.py scripts list
python scripts/forge_studio.py scripts list --query 雨夜 --page 1 --page-size 12
python scripts/forge_studio.py characters list --query 林雾
python scripts/forge_studio.py scripts get SCRIPT_ID
python scripts/forge_studio.py scripts update SCRIPT_ID --revision 7 --content-file draft.md
```

`SCRIPT_ID`、`CHARACTER_ID`、`ASSET_ID` 必须替换为 API 返回的真实 UUID，revision 使用实际读取值。正文文件使用 UTF-8。`--json-file PATH` 读取 UTF-8 JSON 对象，`--json-file -` 从标准输入读取；不能把完整 API 响应的 `data` 包装直接作为写入内容。

| 目标 | CLI 子命令与参数 |
| --- | --- |
| 剧本列表 / 详情 | `scripts list [--query 关键词] [--status 创作中] [--page N] [--page-size 12]` / `scripts get SCRIPT_ID` |
| 新建剧本 | `scripts create --title 标题 --content-file story.md`，或 `--json-file script.json` |
| 更新剧本 | `scripts update SCRIPT_ID --revision N --content-file draft.md`，也支持 `--title`、`--synopsis`、`--genre`、`--status` 或 `--json-file patch.json` |
| 删除剧本 | `scripts delete SCRIPT_ID` |
| 导入新剧本 | `scripts import story.md`，可选 `--title 标题` |
| 导出正文 | `scripts export SCRIPT_ID --format md --output story.md` |
| 人物列表 / 详情 | `characters list [--query 人物名称] [--script-id SCRIPT_ID或unlinked] [--page N] [--page-size 12]` / `characters get CHARACTER_ID` |
| 新建 / 更新人物 | `characters create --json-file character.json` / `characters update CHARACTER_ID --json-file patch.json` |
| 删除人物 | `characters delete CHARACTER_ID` |
| 图片列表 / 信息 | `assets list [--query 图片或人物名称] [--character-id CHARACTER_ID] [--script-id SCRIPT_ID或unlinked] [--page N] [--page-size 12]` / `assets get ASSET_ID` |
| 上传 / 重命名图片 | `assets upload reference.png --character-id CHARACTER_ID [--name 名称]` / `assets rename ASSET_ID --name 名称` |
| 下载 / 删除图片 | `assets download ASSET_ID --output reference.webp` / `assets delete ASSET_ID` |
| 工作室统计 / 最近 100 条日志 | `overview` / `activities` |
| 接口定义 | `openapi`，可选 `--output studio-openapi.json` |

CLI 成功退出码为 0，stdout 保留 API 的 `{"data": ...}` 包装；OpenAPI 输出原始定义对象。错误退出码为 1，stderr 输出 `{"error": "...", "status": 409}`（无 HTTP 响应时省略 status）；命令用法错误退出码为 2。文件下载/导出直接保存原始字节，stdout 仅返回路径和大小，已有文件不会被覆盖。默认超时 30 秒，可在子命令前设置 `--timeout 60`。脚本不会自动重试请求，也不会自动获取 revision 后覆盖旧草稿。

## 定位与读取

剧本、人物和图片资产列表默认每页 12 条，最大 100 条；响应除 `data` 数组外还包含 `pagination: {page, pageSize, total, totalPages}`。用 `--query` 在服务端检索：剧本搜索标题、类型和梗概，人物搜索名称、定位、小传和所属剧本，图片搜索名称、原始文件名、人物名称和所属剧本；`--status`、`--script-id` 和 `--character-id` 可与关键词组合。关键词中的 `%`、`_`、`!` 按普通字符匹配。若 `pagination.page < pagination.totalPages`，需要时显式读取后续页，不要把第一页当作完整列表。空结果为第 1 页，超出末页的请求会回到末页。

图片列表另含 `summary: {characters, bytes}`，表示全部匹配图片涉及的人物数与存储字节数，不受当前页影响。下载具体图片继续使用 `assets download`，不会随列表自动下载全部图片。

从检索响应获取真实 ID；同名对象无法唯一定位时，请用户明确目标。列表里的剧本 `content` 是空字符串，不能当作真实正文；读取或编辑正文必须 GET `/scripts/{id}`。

## 编辑剧本

1. GET 剧本详情，保留读取到的正文和 `revision` 作为本次修改的基准。
2. 仅修改用户要求的字段，通过 `scripts update --revision N` 提交该次读取的 `revision`；JSON 文件中不放 revision。即使只改标题或状态，也必须提交 revision。修改正文时提交修改后的完整正文，保留用户未要求修改的内容、空格和换行。
3. HTTP 409 表示并发修改。重新 GET，比较原始基准、本次草稿及最新版本；能明确合并时，将合并后的字段与最新 revision 一起提交。不能只更新 revision 后重发旧正文；修改冲突或再次收到 409 时保留草稿并说明冲突，等待用户决策。
4. 保存成功后使用响应中的新 revision，核对修改结果，再报告已保存。只生成草稿而未调用写入接口时，明确说明尚未保存。

新建剧本必须有 `title`。状态值为 `草稿`、`创作中`、`已定稿`、`已归档`。正文上限 200000 个字符，JSON 请求上限 1 MiB。文件导入会创建新剧本，不会更新已有剧本；支持 `.txt`、`.md`、`.markdown`，文件上限 2 MiB，优先 UTF-8，兼容 GB18030。

## 人物与图片

- 新建人物需要 `name`；用 `scriptId` 关联已存在的剧本，`null` 解除关联。人物 PATCH 仅发送需要修改的字段，不附带旧的完整对象。
- 图片上传必须先有真实人物 ID；POST `/assets` 的 multipart 字段为 `file`、`characterId`，可选 `name`。支持静态 PNG、JPEG、WebP，上限 10 MiB、2500 万像素，服务端统一转为 WebP 并移除元数据。
- 设置封面时，先上传图片，再 PATCH 人物的 `coverAssetId`，该图片必须属于此人物；设为 `null` 可清除封面。新建人物不能引用尚未上传的封面。
- 图片文件通过带认证的 `/assets/{id}/file` 读取或下载。不要构造公开 COS 链接，也不要把带密钥的链接放进图片预览或回复。
- 删除剧本会保留人物和图片，人物的 `scriptId` 变为 `null`；删除人物会同时删除其所有图片；删除封面图片会选择另一张可用图片，无剩余图片时清空封面。按用户授权的对象和范围执行删除，操作前核对 ID 及这些连带影响。

## 错误与完成核对

- 401：缺少、无效、过期或撤销的密钥。请用户在网页检查或重新创建并配置，不尝试管理员凭证。
- 403：确认密钥是否只有读取权限，以及是否误调用管理员接口；不要反复重试相同请求。
- 404：重新核对对象是否被删除，不以相同名称自动创建替代记录。
- 400 / 413 / 415：根据错误及当前 OpenAPI 修正字段、文件大小或媒体类型。
- 超时或 5xx：写入结果可能不明确。先读取核对；新建、导入、上传没有幂等保证，不盲目重试制造重复记录。无法确认结果时说明不确定性。

完成后简要报告实际操作、对象名称与 ID；剧本更新可附新 revision。用写入响应或必要的 GET 核对结果，不输出密钥或无关的完整创作内容。
