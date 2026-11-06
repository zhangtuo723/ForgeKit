"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowDownToLine, Bot, Check, CheckCircle2, Code2, Copy, KeyRound, LoaderCircle, LockKeyhole, Plus, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { api } from "@/lib/client";
import { useWorkspace } from "@/components/admin-shell";
import "./integrations.css";

type AgentKey = { id: string; name: string; prefix: string; permission: "read" | "write"; createdAt: string; lastUsedAt: string | null; expiresAt: string };
const endpoints = [
  ["GET / POST", "/api/studio/scripts", "列出或创建剧本"],
  ["GET / PATCH / DELETE", "/api/studio/scripts/{id}", "读取、更新或删除剧本；更新需带 revision"],
  ["POST", "/api/studio/scripts/import", "上传 TXT / Markdown，multipart 字段 file"],
  ["GET", "/api/studio/scripts/{id}/export", "导出正文，format=txt 或 md"],
  ["GET / POST", "/api/studio/characters", "读取或创建人物，支持 scriptId 筛选"],
  ["GET / PATCH / DELETE", "/api/studio/characters/{id}", "管理人物资料、关联剧本和封面"],
  ["GET / POST", "/api/studio/assets", "查询或上传图片，上传字段 file、characterId"],
  ["GET / PATCH / DELETE", "/api/studio/assets/{id}", "读取图片信息、重命名或删除资产"],
  ["GET", "/api/studio/assets/{id}/file", "读取经过鉴权的人物图片"],
  ["GET", "/api/studio/overview", "读取工作室真实统计和最近创作"],
];

export function AgentIntegrations() {
  const { timezone } = useWorkspace();
  const [keys, setKeys] = useState<AgentKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [permission, setPermission] = useState<"read" | "write">("read");
  const [expiry, setExpiry] = useState(90);
  const [secret, setSecret] = useState("");
  const [revoke, setRevoke] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"curl" | "python" | "upload">("curl");
  const [base, setBase] = useState("https://your-domain.example/api/studio");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setKeys(await api<AgentKey[]>("/api/studio/agent-keys")); } catch (e) { setError(e instanceof Error ? e.message : "无法加载密钥"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { setBase(`${window.location.origin}/api/studio`); void load(); }, [load]);
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(timer); } }, [notice]);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await api<{token: string; key: AgentKey}>("/api/studio/agent-keys", { method: "POST", body: JSON.stringify({ name, permission, expiresInDays: expiry }) });
      setSecret(result.token); setKeys(old => [result.key, ...old]); setCreating(false); setName("");
    } catch (e) { setError(e instanceof Error ? e.message : "创建失败"); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setError("");
    try { await api(`/api/studio/agent-keys/${id}`, { method: "DELETE" }); setKeys(old => old.filter(key => key.id !== id)); setRevoke(null); setSecret(""); setNotice("密钥已撤销，该 Agent 将无法继续访问"); }
    catch (e) { setError(e instanceof Error ? e.message : "撤销失败"); } finally { setBusy(false); }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice("已复制到剪贴板"); } catch { setError("无法自动复制，请选中文本后手动复制。"); }
  }
  async function downloadSpec() {
    try {
      const response = await fetch("/api/studio/openapi");
      if (!response.ok) throw new Error("接口描述下载失败，请重试");
      const blob = new Blob([JSON.stringify(await response.json(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "studio-openapi.json"; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "下载失败"); }
  }
  const date = (value: string | null) => value ? new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false }).format(new Date(value)) : "尚未使用";
  const examples = {
    curl: `# 将密钥设为环境变量 FORGE_API_KEY\n# 列出剧本（列表不包含完整正文）\ncurl "${base}/scripts" \\\n  -H "Authorization: Bearer $FORGE_API_KEY"\n\n# 创建剧本，需要读写权限\ncurl -X POST "${base}/scripts" \\\n  -H "Authorization: Bearer $FORGE_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"新的故事","genre":"剧情","content":"第一场\\n内景 · 书房 · 夜"}'`,
    python: `import os\nimport requests\n\nbase = "${base}"\nheaders = {"Authorization": f"Bearer {os.environ['FORGE_API_KEY']}"}\nscript_id = "替换为剧本 ID"\n\n# 读取正文和最新 revision\nresponse = requests.get(f"{base}/scripts/{script_id}",\n                        headers=headers, timeout=30)\nresponse.raise_for_status()\nscript = response.json()["data"]\n\n# 更新需带读取到的 revision，避免覆盖其他人的新版本\nresponse = requests.patch(f"{base}/scripts/{script_id}",\n    headers=headers, timeout=30, json={\n        "revision": script["revision"],\n        "content": script["content"] + "\\n\\n（新的场景）"\n    })\n# 409 表示版本冲突，应重新读取后合并，不要盲目重试覆盖\nresponse.raise_for_status()`,
    upload: `# 导入剧本，需要读写权限；文件不超过 2 MB\ncurl -X POST "${base}/scripts/import" \\\n  -H "Authorization: Bearer $FORGE_API_KEY" \\\n  -F "file=@story.md"\n\n# 为已有角色上传参考图（PNG / JPEG / WebP，10 MB 内）\ncurl -X POST "${base}/assets" \\\n  -H "Authorization: Bearer $FORGE_API_KEY" \\\n  -F "characterId=替换为人物ID" \\\n  -F "name=人物正面参考" \\\n  -F "file=@character.png"`,
  };
  return <div className="studio-page api-page">
    {notice && <div className="api-toast" role="status"><CheckCircle2 size={16}/>{notice}</div>}
    <div className="studio-heading"><div><span className="studio-kicker">CONNECT YOUR CREATIVE WORKFLOW</span><h1>Agent API<span className="heading-dot">.</span></h1><p>让你的 Agent 与工作室协作，读写剧本、人物和视觉资产。</p></div><button className="btn btn-primary" onClick={() => { setCreating(!creating); setError(""); }} disabled={busy || !!secret}><Plus size={16}/>创建 API 密钥</button></div>
    <section className="api-intro"><span className="api-intro-icon"><Bot size={31} strokeWidth={1.4}/></span><div><h2>把创作流程，连接起来。</h2><p>标准 HTTP API · Bearer 密钥认证 · 与管理页面共享数据</p></div><span className="api-private"><ShieldCheck size={15}/>权限由你掌控</span></section>
    {error && <div className="studio-error" role="alert">{error}</div>}
    {creating && <form className="api-create" onSubmit={create}><div className="api-create-heading"><h2>为你的 Agent 创建密钥</h2><button type="button" className="icon-button" aria-label="取消创建" onClick={() => setCreating(false)} disabled={busy}><X size={18}/></button></div><div className="api-fields"><label>密钥名称<input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="例如：编剧助手" required maxLength={60} autoFocus disabled={busy}/></label><label>访问权限<select className="field" value={permission} onChange={e => setPermission(e.target.value as "read" | "write")} disabled={busy}><option value="read">只读 · 查询与导出</option><option value="write">读写 · 包含上传、修改和删除</option></select></label><label>有效期<select className="field" value={expiry} onChange={e => setExpiry(Number(e.target.value))} disabled={busy}><option value={30}>30 天</option><option value={90}>90 天</option><option value={365}>365 天</option></select></label></div><div className="api-form-foot"><span>Agent 不能创建新密钥或访问管理员设置。</span><button className="btn btn-primary" disabled={busy || !name.trim()}>{busy ? <LoaderCircle size={15} className="spin"/> : <KeyRound size={15}/>}生成密钥</button></div></form>}
    {secret && <section className="api-secret"><div><CheckCircle2 size={20}/><h2>密钥已创建，请现在保存</h2></div><p>完整密钥仅在本次显示。关闭后无法再次查看，数据库只保留其哈希。</p><div className="api-secret-value"><code>{secret}</code><button className="btn btn-secondary" onClick={() => void copy(secret)}><Copy size={14}/>复制</button></div><button className="text-link" onClick={() => setSecret("")}><Check size={14}/>我已保存，关闭密钥显示</button></section>}
    <section className="studio-section"><div className="studio-section-head"><h2><KeyRound size={16}/>访问密钥<span className="count-badge">{keys.length}</span></h2><button className="icon-button" aria-label="刷新密钥列表" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""}/></button></div>{loading ? <div className="studio-loading" style={{minHeight:150}}><LoaderCircle className="spin" size={20}/>正在读取密钥</div> : keys.length ? <div className="api-table-scroll"><table className="api-table"><thead><tr><th>密钥名称</th><th>权限</th><th>最后使用</th><th>到期时间</th><th>操作</th></tr></thead><tbody>{keys.map(key => <tr key={key.id}><td><strong>{key.name}</strong><code>{key.prefix}••••••</code></td><td><span className={`api-permission ${key.permission === "write" ? "write" : ""}`}>{key.permission === "write" ? "读写" : "只读"}</span></td><td>{date(key.lastUsedAt)}</td><td><span className={new Date(key.expiresAt).getTime() < Date.now() ? "api-expired" : ""}>{date(key.expiresAt)}</span></td><td>{revoke === key.id ? <div className="api-revoke-confirm"><span>立即停用？</span><button disabled={busy} onClick={() => void remove(key.id)}>确认撤销</button><button disabled={busy} onClick={() => setRevoke(null)}>取消</button></div> : <button className="api-revoke" onClick={() => setRevoke(key.id)} disabled={busy}><Trash2 size={14}/>撤销</button>}</td></tr>)}</tbody></table></div> : <div className="studio-empty" style={{minHeight:190}}><KeyRound size={29} strokeWidth={1.3}/><h3>还没有连接任何 Agent</h3><p>为每个 Agent 创建独立密钥，方便控制权限和随时撤销。</p><button className="btn btn-secondary" onClick={() => setCreating(true)} disabled={!!secret}><Plus size={14}/>创建第一个密钥</button></div>}</section>
    <section className="studio-section api-docs"><div className="studio-section-head"><h2><Code2 size={17}/>快速接入</h2><button className="btn btn-secondary" onClick={() => void downloadSpec()}><ArrowDownToLine size={14}/>下载 OpenAPI</button></div><div className="api-docs-body"><div className="api-base"><span>BASE URL</span><code>{base}</code><button className="icon-button" onClick={() => void copy(base)} aria-label="复制 API 地址"><Copy size={15}/></button></div><p className="api-local-note">本地地址仅供本机调用。部署到云服务器后，把 Base URL 替换为网站的 HTTPS 域名加 /api/studio，即可供外部 Agent 使用。</p><div className="api-code-tabs"><div>{([['curl','cURL'],['python','Python · 编辑剧本'],['upload','上传文件']] as const).map(([value,label]) => <button key={value} className={tab === value ? "selected" : ""} onClick={() => setTab(value)}>{label}</button>)}</div><button onClick={() => void copy(examples[tab])}><Copy size={13}/>复制示例</button></div><pre className="studio-code"><code>{examples[tab]}</code></pre><div className="api-tips"><p><LockKeyhole size={15}/><span>请求头：<code>Authorization: Bearer YOUR_API_KEY</code>。密钥通过环境变量传入 Agent。</span></p><p><Code2 size={15}/><span>成功返回 <code>{'{"data": ...}'}</code>，失败返回 <code>{'{"error": "..."}'}</code>。文件导出与 OpenAPI 返回原始内容。</span></p><p><RefreshCw size={15}/><span>编辑前先 GET 最新剧本，将 <code>revision</code> 随 PATCH 提交；收到 409 时重新读取并合并修改。</span></p></div></div></section>
    <section className="studio-section"><div className="studio-section-head"><h2>接口一览</h2><span className="muted small-text">详细参数见 OpenAPI</span></div><div className="api-table-scroll"><table className="api-table api-endpoints"><thead><tr><th>方法</th><th>路径</th><th>用途</th></tr></thead><tbody>{endpoints.map(([method,path,description]) => <tr key={path}><td><span className="api-method">{method}</span></td><td><code>{path}</code></td><td>{description}</td></tr>)}</tbody></table></div></section>
  </div>;
}

