import { CharacterLibrary } from "@/components/character-library";

export default async function CharactersPage({ searchParams }: { searchParams: Promise<{ scriptId?: string | string[]; characterId?: string | string[]; q?: string | string[] }> }) {
  const query = await searchParams;
  return <CharacterLibrary initialScriptId={typeof query.scriptId === "string" ? query.scriptId : ""} initialCharacterId={typeof query.characterId === "string" ? query.characterId : ""} initialQuery={typeof query.q === "string" ? query.q : ""}/>;
}
