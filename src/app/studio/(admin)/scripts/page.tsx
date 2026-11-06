import { ScriptLibrary } from "@/components/script-library";

export default async function ScriptsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <ScriptLibrary initialAction={params.new === "1" ? "new" : params.import === "1" ? "import" : ""} initialQuery={typeof params.q === "string" ? params.q : ""}/>;
}
