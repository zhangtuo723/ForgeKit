export type ScriptStatus = "草稿" | "创作中" | "已定稿" | "已归档";
export type Pagination = { page: number; pageSize: number; total: number; totalPages: number };
export type PageResult<T> = { data: T[]; pagination: Pagination };
export type Script = {
  id: string; title: string; synopsis: string; genre: string; status: ScriptStatus;
  content: string; wordCount: number; revision: number; sourceName: string | null;
  createdAt: string; updatedAt: string; characterCount: number; assetCount: number;
};
export type Character = {
  id: string; scriptId: string | null; scriptTitle: string | null; name: string;
  role: string; description: string; appearance: string; personality: string;
  createdAt: string; updatedAt: string; coverAssetId: string | null; assetCount: number;
};
export type CharacterAsset = {
  id: string; characterId: string; characterName: string; scriptId: string | null;
  scriptTitle: string | null; name: string; originalName: string; mimeType: string;
  size: number; width: number; height: number; createdAt: string;
};
export type StudioOverview = {
  stats: { scripts: number; writing: number; characters: number; assets: number; words: number };
  recentScripts: Script[]; recentAssets: CharacterAsset[];
  activities: { id: string; actor: string; action: string; target: string; type: "project" | "user" | "system"; createdAt: string }[];
};
