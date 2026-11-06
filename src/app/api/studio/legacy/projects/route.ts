import { body, handle, saveProject, success } from "@/lib/api";
import { getProjects } from "@/lib/db";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return handle(request, async () => success(await getProjects()));
}
export async function POST(request: Request) {
  return handle(request, async () => success(await saveProject(await body(request)), 201), { write: true });
}

