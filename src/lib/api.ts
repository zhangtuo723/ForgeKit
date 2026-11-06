import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession, secureCookie } from "./auth";
import { authenticateAgent } from "./agent-auth";
import { addActivity, first, rows, execute, type Connection, PROJECT_COLUMNS, transaction } from "./db";
import type { Project, SessionUser, Settings, User } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status, headers: { "Cache-Control": "no-store" } });
}

function verifyOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") throw new ApiError(403, "请求来源无效，请从本站页面操作");
  let expected: string;
  if (process.env.FORGE_APP_URL) {
    expected = new URL(process.env.FORGE_APP_URL).origin;
  } else {
    const url = new URL(request.url);
    const host = request.headers.get("host") || url.host;
    expected = `${secureCookie(request) ? "https:" : url.protocol}//${host}`;
  }
  if (origin !== expected) throw new ApiError(403, "请求来源不匹配，请刷新页面后重试");
}

export async function handle(
  request: Request,
  handler: (user: SessionUser | null) => Promise<Response> | Response,
  options: { public?: boolean; write?: boolean; agent?: boolean } = {},
) {
  try {
    const bearer = request.headers.has("authorization");
    if (bearer && !options.agent) throw new ApiError(401, "此接口仅支持管理员网页登录");
    if (options.write && !bearer) verifyOrigin(request);
    const user = bearer ? await authenticateAgent(request, !!options.write) : options.public ? null : await getSession();
    if (!options.public && !user) throw new ApiError(401, "登录已失效，请重新登录");
    return await handler(user);
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    const message = error instanceof Error ? error.message : "";
    if ((error as {code?:string}).code === "ER_DUP_ENTRY" && message.includes("users_email")) return NextResponse.json({ error: "该邮箱已被使用" }, { status: 409 });
    if ((error as {code?:string}).code === "ER_DUP_ENTRY" && message.includes("projects_code")) return NextResponse.json({ error: "项目编号已存在" }, { status: 409 });
    if ((error as {code?:string}).code === "ER_NO_REFERENCED_ROW_2") return NextResponse.json({error:"关联内容已被删除，请刷新后重试"},{status:400});
    console.error("Management API failed:", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "服务器暂时无法处理请求，请稍后重试" }, { status: 500 });
  }
}

export async function body(request: Request, maxBytes = 65536): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ApiError(415, "请使用 JSON 格式提交数据");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "请求内容不能为空");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new ApiError(413, "提交内容过大"); }
    chunks.push(item.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Not an object");
    return parsed as Record<string, unknown>;
  } catch { throw new ApiError(400, "请求 JSON 格式不正确"); }
}

export function text(data: Record<string, unknown>, key: string, label: string, max: number, required = true) {
  const value = data[key];
  if (value === undefined && !required) return "";
  if (typeof value !== "string") throw new ApiError(400, `${label}格式不正确`);
  const cleaned = value.trim();
  if ((required && cleaned.length === 0) || cleaned.length > max) throw new ApiError(400, `${label}${required ? "不能为空，且" : ""}最多 ${max} 个字符`);
  return cleaned;
}

function choice<T extends string>(value: unknown, options: readonly T[], label: string): T {
  if (typeof value !== "string" || !options.includes(value as T)) throw new ApiError(400, `${label}选项无效`);
  return value as T;
}

function email(value: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new ApiError(400, "请输入有效的邮箱地址");
  return value.toLowerCase();
}

export async function userById(id: string, connection?: Connection): Promise<User> {
  const user = (await first("SELECT * FROM users WHERE id=?",[id],connection)) as User | undefined;
  if (!user) throw new ApiError(404, "用户不存在或已被删除");
  return user;
}

export async function projectById(id: string, connection?: Connection): Promise<Project> {
  const project = (await first(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE id=?`,[id],connection)) as Project | undefined;
  if (!project) throw new ApiError(404, "项目不存在或已被删除");
  return project;
}

export async function saveUser(input: Record<string, unknown>, existing?: User): Promise<User> {
  const data = { role: "成员", status: "正常", department: "", ...existing, ...input };
  const record: User = {
    id: existing?.id || randomUUID(),
    name: text(data, "name", "姓名", 40),
    email: email(text(data, "email", "邮箱", 120)),
    role: choice(data.role, ["管理员", "编辑者", "成员"], "角色"),
    status: choice(data.status, ["正常", "停用"], "状态"),
    department: text(data, "department", "部门", 60, false),
    joinedAt: existing?.joinedAt || new Date().toISOString(),
  };
  return transaction(async db => {
    if (existing) (await execute("UPDATE users SET name=?,email=?,role=?,status=?,department=? WHERE id=?",[record.name,record.email,record.role,record.status,record.department,record.id],db));
    else (await execute("INSERT INTO users VALUES (?,?,?,?,?,?,?)",[record.id,record.name,record.email,record.role,record.status,record.department,record.joinedAt],db));
    await addActivity(existing ? "更新了成员信息" : "添加了团队成员", record.name, "user","管理员",db);
    return record;
  });
}

export async function saveProject(input: Record<string, unknown>, existing?: Project): Promise<Project> {
  const data: Record<string, unknown> = { category: "网站开发", status: "待开始", priority: "中", ownerId: null, progress: 0, color: "#427f72", description: "", ...existing, ...input };
  const status = choice(data.status, ["进行中", "已完成", "已暂停", "待开始"], "项目状态");
  if (typeof data.progress !== "number" || !Number.isInteger(data.progress) || data.progress < 0 || data.progress > 100) throw new ApiError(400, "项目进度必须为 0 到 100 的整数");
  let progress = data.progress;
  let finalStatus = status;
  if (input.status === "已完成") progress = 100;
  else if (input.status === "待开始") progress = 0;
  else if (input.progress !== undefined && input.status === undefined) {
    if (progress === 100) finalStatus = "已完成";
    else if (status === "已完成") finalStatus = progress === 0 ? "待开始" : "进行中";
    else if (status === "待开始" && progress > 0) finalStatus = "进行中";
  }
  else if (status === "已完成") progress = 100;
  else if (status === "待开始") progress = 0;
  else if (progress === 100) {
    // Explicitly reopening a completed project also resets its completed progress.
    if (existing?.status === "已完成" && input.status !== undefined && input.progress === undefined) progress = 90;
    else finalStatus = "已完成";
  }
  const dueDate = text(data, "dueDate", "截止日期", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate)) || new Date(dueDate).toISOString().slice(0,10) !== dueDate) throw new ApiError(400, "请输入有效的截止日期");
  const ownerId = data.ownerId;
  if (ownerId !== null && (typeof ownerId !== "string" || !(await first("SELECT id FROM users WHERE id=?",[ownerId])))) throw new ApiError(400, "请选择有效的项目负责人");
  const color = text(data, "color", "项目颜色", 7);
  if (!/^#[\da-fA-F]{6}$/.test(color)) throw new ApiError(400, "项目颜色格式不正确");
  let code = data.code === undefined || data.code === "" ? "" : text(data, "code", "项目编号", 24);
  if (!code) {
    const next = await first<{next:number}>("SELECT COALESCE(MAX(CAST(SUBSTR(code,4) AS UNSIGNED)),0)+1 AS next FROM projects WHERE code REGEXP '^FG-[0-9]+$'",[]);
    code = `FG-${String(next!.next).padStart(3, "0")}`;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(code)) throw new ApiError(400, "项目编号只能包含字母、数字、下划线或连字符");
  const now = new Date().toISOString();
  const record: Project = { id: existing?.id || randomUUID(), name: text(data,"name","项目名称",80), description: text(data,"description","项目说明",2000,false), code, category: text(data,"category","项目分类",40), status: finalStatus, priority: choice(data.priority,["高","中","低"],"优先级"), ownerId: ownerId as string | null, progress, dueDate, createdAt: existing?.createdAt || now, updatedAt: now, color };
  return transaction(async db => {
    if (existing) (await execute("UPDATE projects SET name=?,description=?,code=?,category=?,status=?,priority=?,ownerId=?,progress=?,dueDate=?,updatedAt=?,color=?,completedAt=CASE WHEN ?='已完成' THEN COALESCE(completedAt,?) ELSE NULL END WHERE id=?",[record.name,record.description,record.code,record.category,record.status,record.priority,record.ownerId,record.progress,record.dueDate,record.updatedAt,record.color,record.status,now,record.id],db));
    else (await execute("INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",[record.id,record.name,record.description,record.code,record.category,record.status,record.priority,record.ownerId,record.progress,record.dueDate,record.createdAt,record.updatedAt,record.status === "已完成" ? now : null,record.color],db));
    await addActivity(existing ? "更新了项目" : "创建了项目", record.name, "project","管理员",db);
    return record;
  });
}

export async function deleteUser(id: string) {
  const user = await userById(id);
  return transaction(async db => { (await execute("DELETE FROM users WHERE id=?",[id],db)); await addActivity("移除了团队成员",user.name,"user","管理员",db); });
}

export async function deleteProject(id: string) {
  const project = await projectById(id);
  return transaction(async db => { (await execute("DELETE FROM projects WHERE id=?",[id],db)); await addActivity("删除了项目",project.name,"project","管理员",db); });
}

export async function saveSettings(input: Record<string, unknown>, current: Settings, actor="管理员"): Promise<Settings> {
  const data = { ...current, ...input };
  const timezone = text(data,"timezone","时区",80);
  try { new Intl.DateTimeFormat("zh-CN",{ timeZone: timezone }).format(); }
  catch { throw new ApiError(400,"请选择有效的时区"); }
  const result: Settings = { workspaceName: text(data,"workspaceName","工作空间名称",60), workspaceDescription: text(data,"workspaceDescription","工作空间简介",300,false), contactEmail: email(text(data,"contactEmail","联系邮箱",120)), timezone };
  return transaction(async db => {
    await execute("UPDATE settings SET value=? WHERE id=1",[JSON.stringify(result)],db);
    await addActivity("更新了工作空间设置",result.workspaceName,"system",actor,db);
    await execute("INSERT INTO studio_activities(id,actor,action,target,type,createdAt) VALUES (?,?,?,?,?,?)",[randomUUID(),actor,"更新了工作室设置",result.workspaceName,"system",new Date().toISOString()],db);
    return result;
  });
}
