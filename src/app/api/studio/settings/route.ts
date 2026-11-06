import { body, handle, saveSettings, success } from "@/lib/api";
import { getSettings } from "@/lib/db";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return handle(request, async () => success(await getSettings()));
}
export async function PATCH(request: Request) {
  return handle(request, async user => {
    const settings = await saveSettings(await body(request), await getSettings(), user!.name);
    return success(settings);
  }, { write: true });
}

