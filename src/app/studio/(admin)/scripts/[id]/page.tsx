import { ScriptEditor } from "@/components/script-editor";

export default async function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ScriptEditor key={id} id={id}/>;
}
