import { requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { getStudioDb } from "@/lib/studio-db";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  await getStudioDb();
  return <AdminShell user={user} initialSettings={await getSettings()}>{children}</AdminShell>;
}
