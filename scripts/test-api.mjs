import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createQaAdmin, qaBaseUrl } from "./qa-admin.mjs";

// Integration checks only target a local development server. All created records
// have a unique test prefix; settings and test records are restored in finally.
const base = qaBaseUrl();
let qa;
const prefix = `api-test-${randomUUID().slice(0, 8)}`;
let cookie = "";
let testUserId;
let testProjectId;
let originalSettings;
let settingsChanged = false;
let completed = 0;

async function request(path, { method = "GET", data, raw, origin = base.origin, session = cookie, contentType = "application/json" } = {}) {
  const response = await fetch(new URL(path, base), {
    method,
    redirect: "manual",
    signal: AbortSignal.timeout(60000),
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(session ? { Cookie: session } : {}),
      ...(method !== "GET" ? { "Content-Type": contentType } : {}),
    },
    ...(raw !== undefined ? { body: raw } : data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = undefined; }
  return { response, body, text };
}

async function expect(path, expected, options) {
  const result = await request(path, options);
  assert.equal(result.response.status, expected, `${options?.method || "GET"} ${path}: expected HTTP ${expected}, received ${result.response.status}${result.body?.error ? ` (${result.body.error})` : ""}`);
  if (expected >= 400) assert.equal(typeof result.body?.error, "string", `${path}: errors should have a user-facing message`);
  return result;
}

async function check(label, callback) {
  await callback();
  completed += 1;
  console.log(`PASS ${label}`);
}

async function expectRedirect(path, destination, options = {}) {
  const result = await request(path, options);
  assert.equal(result.response.status, 307, `${path}: compatibility redirect must preserve the request method`);
  assert.ok(result.response.headers.get("location"), `${path}: redirect needs a Location header`);
  const location = new URL(result.response.headers.get("location"), base);
  const target = new URL(destination, base);
  assert.equal(location.href, target.href, `${path}: redirect must retain the canonical path and query`);
  return result;
}

async function login(remember = false) {
  const result = await expect("/api/studio/auth/login", 200, { method: "POST", data: { username: qa.username, password: qa.password, remember }, session: "" });
  const setCookie = result.response.headers.get("set-cookie") || "";
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//i);
  assert.match(setCookie, new RegExp(`Max-Age=${remember ? 604800 : 43200}(?:;|$)`, "i"));
  cookie = setCookie.split(";")[0];
  assert.match(cookie, /^forge_admin_session=[a-f0-9]{64}$/);
}

try {
  qa = await createQaAdmin(base);
  await check("module entry, canonical login and legacy page redirects preserve URLs", async () => {
    const entry = await expect("/", 200, { session: "" });
    assert.match(entry.response.headers.get("content-type") || "", /text\/html/);
    assert.match(entry.text, /href="\/studio(?:\/dashboard)?"/, "public module entry should link to Studio");
    const loginPage = await expect("/studio/login", 200, { session: "" });
    assert.match(loginPage.response.headers.get("content-type") || "", /text\/html/);
    await expectRedirect("/studio", "/studio/dashboard", { session: "" });
    for (const path of ["login", "dashboard", "scripts", "characters", "assets", "integrations", "settings", "activity"]) {
      await expectRedirect(`/${path}?qa=route-check`, `/studio/${path}?qa=route-check`, { session: "" });
    }
    await expectRedirect("/scripts/qa-route-id?mode=write", "/studio/scripts/qa-route-id?mode=write", { session: "" });
    await expectRedirect("/projects?new=1", "/studio/scripts?new=1", { session: "" });
    await expectRedirect("/users?scriptId=qa-route-id", "/studio/characters?scriptId=qa-route-id", { session: "" });
  });
  await check("legacy APIs redirect to the module and preserve POST semantics", async () => {
    for (const path of ["auth/me", "settings", "agent-keys", "assets", "characters", "scripts", "openapi", "health"]) {
      await expectRedirect(`/api/${path}?qa=route-check`, `/api/studio/${path}?qa=route-check`, { session: "" });
    }
    for (const path of ["users", "projects", "dashboard", "activities"]) {
      await expectRedirect(`/api/${path}?qa=route-check`, `/api/studio/legacy/${path}?qa=route-check`, { session: "" });
    }
    await expectRedirect("/api/assets/qa-route-id/file?download=1", "/api/studio/assets/qa-route-id/file?download=1", { session: "" });
    await expectRedirect("/api/scripts", "/api/studio/scripts", { method: "POST", data: {}, origin: null, session: "" });
    // Following this unauthenticated POST cannot mutate data: missing Origin
    // must still produce the POST-only 403, rather than a GET's 401 response.
    const followed = await fetch(new URL("/api/scripts", base), { method: "POST", redirect: "follow", headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(60000) });
    assert.equal(followed.status, 403, "307 must preserve POST and the canonical write-origin check");
    assert.equal(new URL(followed.url).pathname, "/api/studio/scripts");
    await followed.arrayBuffer();
  });
  await check("private pages and data require a valid server session", async () => {
    for (const path of ["/api/studio/legacy/users", "/api/studio/legacy/projects", "/api/studio/legacy/dashboard", "/api/studio/legacy/activities", "/api/studio/settings", "/api/studio/auth/me"]) await expect(path, 401);
    await expect("/api/studio/legacy/users", 401, { method: "POST", data: { name: prefix, email: `${prefix}@example.com` } });
    await expect("/api/studio/legacy/projects/unknown", 401, { method: "DELETE" });
    await expect("/api/studio/settings", 401, { method: "PATCH", data: { workspaceName: prefix } });
    await expect("/api/studio/legacy/users", 401, { session: "forge_admin_session=malformed" });
    await expectRedirect("/studio/dashboard", "/studio/login", { session: "" });
    await expectRedirect("/studio/scripts", "/studio/login", { session: "" });
  });

  await check("login rejects incorrect credentials, invalid payloads and cross-site requests", async () => {
    await expect("/api/studio/auth/login", 401, { method: "POST", data: { username: qa.username, password: "incorrect-test-password" } });
    await expect("/api/studio/auth/login", 400, { method: "POST", data: { username: [], password: "unused" } });
    await expect("/api/studio/auth/login", 400, { method: "POST", data: { username: qa.username, password: "unused", remember: "true" } });
    await expect("/api/studio/auth/login", 403, { method: "POST", origin: "https://unrelated.example", data: {} });
    await expect("/api/studio/auth/login", 403, { method: "POST", origin: null, data: {} });
  });

  await check("login establishes an HttpOnly, same-site 12-hour session", async () => {
    await login();
    const me = await expect("/api/studio/auth/me", 200);
    assert.equal(me.body.data.user.username, qa.username);
    assert.equal(typeof me.body.data.settings.workspaceName, "string");
    assert.equal(me.response.headers.get("cache-control"), "no-store");
  });

  await check("authenticated canonical Studio pages render without compatibility redirects", async () => {
    for (const path of ["dashboard", "scripts", "characters", "assets", "integrations", "settings", "activity"]) {
      const page = await expect(`/studio/${path}`, 200);
      assert.match(page.response.headers.get("content-type") || "", /text\/html/);
      assert.equal(page.response.headers.get("location"), null);
      assert.match(page.text, /href="\/studio\/dashboard"/, "Studio navigation must use canonical page URLs");
      assert.doesNotMatch(page.text, /href="\/(?:dashboard|scripts|characters|assets|integrations|settings|activity)(?:[/?"])/);
    }
    await expectRedirect("/studio/login", "/studio/dashboard");
  });

  await check("authenticated writes reject CSRF, malformed JSON and oversized bodies", async () => {
    await expect("/api/studio/legacy/users", 403, { method: "POST", origin: "https://unrelated.example", data: {} });
    await expect("/api/studio/legacy/users", 403, { method: "POST", origin: null, data: {} });
    await expect("/api/studio/legacy/users", 400, { method: "POST", raw: "{broken-json" });
    await expect("/api/studio/legacy/users", 400, { method: "POST", data: [] });
    await expect("/api/studio/legacy/users", 415, { method: "POST", raw: "name=test", contentType: "text/plain" });
    await expect("/api/studio/legacy/users", 413, { method: "POST", data: { name: "x".repeat(66000) } });
  });

  await check("member CRUD validates values and enforces unique emails", async () => {
    const member = { name: prefix, email: `${prefix}@example.com`, role: "成员", status: "正常", department: "API integration" };
    await expect("/api/studio/legacy/users", 400, { method: "POST", data: { ...member, role: "superuser" } });
    await expect("/api/studio/legacy/users", 400, { method: "POST", data: { ...member, email: "invalid" } });
    await expect("/api/studio/legacy/users", 400, { method: "POST", data: { ...member, name: 42 } });
    const created = await expect("/api/studio/legacy/users", 201, { method: "POST", data: member });
    testUserId = created.body.data.id;
    assert.equal(created.body.data.name, prefix);
    assert.equal(typeof testUserId, "string");
    await expect("/api/studio/legacy/users", 409, { method: "POST", data: { ...member, email: member.email.toUpperCase() } });
    const literalName = `${prefix} ' <b>literal</b>`;
    const edited = await expect(`/api/studio/legacy/users/${testUserId}`, 200, { method: "PATCH", data: { name: literalName, role: "编辑者", status: "停用" } });
    assert.equal(edited.body.data.name, literalName, "text should be stored literally, not interpreted as SQL or markup");
    assert.equal(edited.body.data.role, "编辑者");
    assert.equal(edited.body.data.status, "停用");
    const list = await expect("/api/studio/legacy/users", 200);
    assert.equal(list.body.data.find(user => user.id === testUserId)?.name, literalName);
    await expect(`/api/studio/legacy/users/${testUserId}`, 400, { method: "PATCH", data: { status: "invalid" } });
    await expect(`/api/studio/legacy/users/missing-${prefix}`, 404, { method: "PATCH", data: { name: "test" } });
    await expect(`/api/studio/legacy/users/missing-${prefix}`, 404, { method: "DELETE" });
  });

  await check("project CRUD validates references, dates, enums and progress", async () => {
    const project = { name: prefix, description: "Temporary integration record", code: prefix, category: "测试", status: "待开始", priority: "中", ownerId: testUserId, progress: 0, dueDate: "2027-01-15", color: "#167d68" };
    for (const invalid of [{ progress: -1 }, { progress: 101 }, { progress: "50" }, { progress: 10.5 }, { status: "invalid" }, { priority: "critical" }, { dueDate: "2027-02-30" }, { color: "red" }, { ownerId: "missing-user" }]) {
      await expect("/api/studio/legacy/projects", 400, { method: "POST", data: { ...project, ...invalid } });
    }
    const created = await expect("/api/studio/legacy/projects", 201, { method: "POST", data: project });
    testProjectId = created.body.data.id;
    assert.equal(created.body.data.ownerId, testUserId);
    assert.equal(created.body.data.progress, 0);
    await expect("/api/studio/legacy/projects", 409, { method: "POST", data: project });
    const progress = await expect(`/api/studio/legacy/projects/${testProjectId}`, 200, { method: "PATCH", data: { progress: 50 } });
    assert.equal(progress.body.data.status, "进行中");
    assert.equal(progress.body.data.progress, 50);
    const completedProject = await expect(`/api/studio/legacy/projects/${testProjectId}`, 200, { method: "PATCH", data: { status: "已完成" } });
    assert.equal(completedProject.body.data.progress, 100);
    const reopened = await expect(`/api/studio/legacy/projects/${testProjectId}`, 200, { method: "PATCH", data: { progress: 25 } });
    assert.equal(reopened.body.data.status, "进行中");
    assert.equal(reopened.body.data.progress, 25);
    const reset = await expect(`/api/studio/legacy/projects/${testProjectId}`, 200, { method: "PATCH", data: { status: "待开始" } });
    assert.equal(reset.body.data.progress, 0);
    await expect(`/api/studio/legacy/projects/missing-${prefix}`, 404, { method: "PATCH", data: { name: "test" } });
    await expect(`/api/studio/legacy/projects/missing-${prefix}`, 404, { method: "DELETE" });
  });

  await check("dashboard counts reflect stored records and period selection", async () => {
    const projects = (await expect("/api/studio/legacy/projects", 200)).body.data;
    const users = (await expect("/api/studio/legacy/users", 200)).body.data;
    const dashboard = (await expect("/api/studio/legacy/dashboard?days=7", 200)).body.data;
    assert.equal(dashboard.stats.totalProjects, projects.length);
    assert.equal(dashboard.stats.activeProjects, projects.filter(project => project.status === "进行中").length);
    assert.equal(dashboard.stats.completedProjects, projects.filter(project => project.status === "已完成").length);
    assert.equal(dashboard.stats.totalUsers, users.length);
    assert.equal(dashboard.trend.length, 7);
    assert.equal(dashboard.projects.length, projects.length);
    const longer = (await expect("/api/studio/legacy/dashboard?days=30", 200)).body.data;
    assert.equal(longer.trend.length, 30);
  });

  await check("removing a member clears project ownership without deleting the project", async () => {
    await expect(`/api/studio/legacy/users/${testUserId}`, 200, { method: "DELETE" });
    testUserId = undefined;
    const projects = (await expect("/api/studio/legacy/projects", 200)).body.data;
    const project = projects.find(record => record.id === testProjectId);
    assert.ok(project, "project must survive owner removal");
    assert.equal(project.ownerId, null);
  });

  await check("settings persist, reject invalid values and can be restored", async () => {
    originalSettings = (await expect("/api/studio/settings", 200)).body.data;
    await expect("/api/studio/settings", 400, { method: "PATCH", data: { timezone: "Not/A_Timezone" } });
    await expect("/api/studio/settings", 400, { method: "PATCH", data: { contactEmail: "invalid" } });
    const changed = await expect("/api/studio/settings", 200, { method: "PATCH", data: { workspaceName: prefix } });
    settingsChanged = true;
    assert.equal(changed.body.data.workspaceName, prefix);
    assert.equal((await expect("/api/studio/settings", 200)).body.data.workspaceName, prefix);

    const completedProject = (await expect(`/api/studio/legacy/projects/${testProjectId}`, 200, { method: "PATCH", data: { status: "已完成" } })).body.data;
    const localTodays = [];
    for (const timezone of ["Pacific/Kiritimati", "Etc/GMT+12"]) {
      const saved = await expect("/api/studio/settings", 200, { method: "PATCH", data: { timezone } });
      assert.equal(saved.body.data.timezone, timezone);
      const localDate = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
      const before = localDate.format(new Date());
      const dashboard = (await expect("/api/studio/legacy/dashboard?days=7", 200)).body.data;
      const after = localDate.format(new Date());
      const today = dashboard.trend.at(-1).date;
      assert.ok([before, after].includes(today), `${timezone}: trend must end on the workspace's current calendar date`);
      localTodays.push(today);
      assert.equal(dashboard.trend.length, 7);
      for (let i = 0; i < dashboard.trend.length; i += 1) {
        const row = dashboard.trend[i];
        const expectedCreated = dashboard.projects.filter(project => localDate.format(new Date(project.createdAt)) === row.date).length;
        assert.equal(row.created, expectedCreated, `${timezone}: created projects must be grouped by workspace calendar date`);
        assert.ok(Number.isInteger(row.completed) && row.completed >= 0, "completion counts must be non-negative integers");
        if (i > 0) assert.equal(Date.parse(row.date) - Date.parse(dashboard.trend[i - 1].date), 86400000, "calendar labels must be consecutive");
      }
      const testCreationDate = localDate.format(new Date(completedProject.createdAt));
      const testCompletionDate = localDate.format(new Date(completedProject.updatedAt));
      assert.ok(dashboard.trend.find(row => row.date === testCreationDate)?.created >= 1, `${timezone}: the new project must appear on its local creation date`);
      assert.ok(dashboard.trend.find(row => row.date === testCompletionDate)?.completed >= 1, `${timezone}: the completed project must appear on its local completion date`);
      assert.ok(dashboard.trend.reduce((sum, row) => sum + row.completed, 0) <= dashboard.stats.completedProjects, "period completions cannot exceed all completed projects");
    }
    assert.notEqual(localTodays[0], localTodays[1], "opposite sides of the date line must exercise different calendar dates");

    await expect("/api/studio/settings", 200, { method: "PATCH", data: originalSettings });
    settingsChanged = false;
  });

  await check("audit log records mutations and project deletion persists", async () => {
    const activities = (await expect("/api/studio/legacy/activities", 200)).body.data;
    assert.ok(activities.some(record => record.type === "project" && record.target === prefix));
    assert.ok(activities.some(record => record.type === "user" && record.target.startsWith(prefix)));
    assert.ok(activities.some(record => record.type === "system" && record.target === prefix));
    const deletedId = testProjectId;
    await expect(`/api/studio/legacy/projects/${deletedId}`, 200, { method: "DELETE" });
    testProjectId = undefined;
    assert.ok(!(await expect("/api/studio/legacy/projects", 200)).body.data.some(record => record.id === deletedId));
    await expect(`/api/studio/legacy/projects/${deletedId}`, 404, { method: "DELETE" });
  });

  await check("logout invalidates the stored token, not just the browser cookie", async () => {
    const oldCookie = cookie;
    await expect("/api/studio/auth/logout", 403, { method: "POST", origin: "https://unrelated.example" });
    await expect("/api/studio/auth/me", 200);
    const logout = await expect("/api/studio/auth/logout", 200, { method: "POST" });
    assert.match(logout.response.headers.get("set-cookie") || "", /Max-Age=0/i);
    cookie = "";
    await expect("/api/studio/auth/me", 401, { session: oldCookie });
    await expect("/api/studio/legacy/users", 401, { session: oldCookie });
  });

  await check("remember-me establishes a seven-day session", async () => {
    await login(true);
    await expect("/api/studio/auth/me", 200);
  });
} finally {
  try {
  if ((settingsChanged || testProjectId || testUserId) && !cookie) await login();
  if (settingsChanged && originalSettings) await expect("/api/studio/settings", 200, { method: "PATCH", data: originalSettings });
  if (testProjectId) await expect(`/api/studio/legacy/projects/${testProjectId}`, 200, { method: "DELETE" });
  if (testUserId) await expect(`/api/studio/legacy/users/${testUserId}`, 200, { method: "DELETE" });
  if (cookie) await expect("/api/studio/auth/logout", 200, { method: "POST" });
  } finally { await qa?.cleanup(); }
}

console.log(`\nAll ${completed} integration checks passed. Test records removed; original settings restored.`);
