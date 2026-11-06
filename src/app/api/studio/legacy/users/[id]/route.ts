import { body, deleteUser, handle, saveUser, success, userById } from "@/lib/api";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  return handle(request, async () => { const { id } = await context.params; return success(await saveUser(await body(request), await userById(id))); }, { write: true });
}
export async function DELETE(request: Request, context: Context) {
  return handle(request, async () => { const { id } = await context.params; await deleteUser(id); return success({ ok: true }); }, { write: true });
}

