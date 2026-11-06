import { body, deleteProject, handle, projectById, saveProject, success } from "@/lib/api";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  return handle(request, async () => { const { id } = await context.params; return success(await saveProject(await body(request), await projectById(id))); }, { write: true });
}
export async function DELETE(request: Request, context: Context) {
  return handle(request, async () => { const { id } = await context.params; await deleteProject(id); return success({ ok: true }); }, { write: true });
}

