import type { ZoteroItem, Collection } from "../model/types";
import type { ObzoSettings } from "../settings";

// The nine filesystem-illegal characters, each replaced with a space. Spaces and hyphens are kept.
const ILLEGAL = /[\\/:*?"<>|]/g;

export function sanitizeSegment(name: string): string {
  const cleaned = name
    .replace(ILLEGAL, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "");
  return cleaned.length ? cleaned : "untitled";
}

function collectionPath(id: number, byId: Map<number, Collection>): Collection[] {
  const chain: Collection[] = [];
  const guard = new Set<number>();
  let current: Collection | undefined = byId.get(id);
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    chain.unshift(current);
    current = current.parentId != null ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

export function primaryCollectionId(item: ZoteroItem, byId: Map<number, Collection>): number | null {
  let best: { id: number; depth: number } | null = null;
  for (const id of item.collectionIds) {
    if (!byId.has(id)) continue;
    const depth = collectionPath(id, byId).length;
    if (best === null || depth > best.depth || (depth === best.depth && id < best.id)) {
      best = { id, depth };
    }
  }
  return best ? best.id : null;
}

export function paperNotePath(
  item: ZoteroItem,
  byId: Map<number, Collection>,
  settings: ObzoSettings
): string {
  const primary = primaryCollectionId(item, byId);
  const folderSegments =
    primary != null
      ? collectionPath(primary, byId).map((c) => sanitizeSegment(c.name))
      : [sanitizeSegment(settings.unfiledFolder)];
  const file = `${sanitizeSegment(item.title)}.md`;
  return [settings.vaultSubfolder, ...folderSegments, file].join("/");
}
