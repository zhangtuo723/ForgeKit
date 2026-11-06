import { ApiError, handle, success } from "@/lib/api";
import { getActivities, rows, getProjects, getSettings, getUsers } from "@/lib/db";
import type { DashboardData } from "@/lib/types";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return handle(request, async () => {
    const value = new URL(request.url).searchParams.get("days") || "7";
    if (value !== "7" && value !== "30") throw new ApiError(400, "统计区间仅支持 7 天或 30 天");
    const days = Number(value);
    const projects = await getProjects();
    const users = await getUsers();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: (await getSettings()).timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
    });
    const dayKey = (value: string | Date) => {
      const parts = formatter.formatToParts(new Date(value));
      const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)!.value;
      return `${part("year")}-${part("month")}-${part("day")}`;
    };
    const today = dayKey(new Date());
    const created = new Map<string, number>();
    const completed = new Map<string, number>();
    for (const project of projects) {
      const date = dayKey(project.createdAt);
      created.set(date, (created.get(date) || 0) + 1);
    }
    const completionDates = await rows<{completedAt:string}>("SELECT completedAt FROM projects WHERE completedAt IS NOT NULL");
    for (const project of completionDates) {
      const date = dayKey(project.completedAt);
      completed.set(date, (completed.get(date) || 0) + 1);
    }
    const trend = Array.from({ length: days }, (_, index) => {
      // Advance calendar labels independently of local DST day lengths.
      const date = new Date(Date.parse(`${today}T00:00:00Z`) - (days - index - 1) * 86400000).toISOString().slice(0, 10);
      return { date, label: date.slice(5).replace("-", "/"), created: created.get(date) || 0, completed: completed.get(date) || 0 };
    });
    const data: DashboardData = {
      stats: { totalProjects: projects.length, activeProjects: projects.filter(p => p.status === "进行中").length, completedProjects: projects.filter(p => p.status === "已完成").length, totalUsers: users.length },
      projects, users, activities: await getActivities(8), trend,
    };
    return success(data);
  });
}

