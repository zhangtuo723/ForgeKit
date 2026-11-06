import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function LoginPage() {
  if (await getSession()) redirect("/studio/dashboard");
  return <LoginForm />;
}
