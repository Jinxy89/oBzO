import { SYNC_END_MARKER } from "../transform/render";

export interface ParsedNote {
  zoteroKey: string | null;
  status: string | null;
}

const unquote = (v: string): string => v.trim().replace(/^["']|["']$/g, "");

export function parseSyncedFrontmatter(content: string): ParsedNote {
  const result: ParsedNote = { zoteroKey: null, status: null };
  if (!content.startsWith("---")) return result;
  const end = content.indexOf("\n---", 3);
  const block = end === -1 ? content : content.slice(0, end);
  for (const line of block.split("\n")) {
    const km = line.match(/^zotero-key:\s*(.+)$/);
    if (km) result.zoteroKey = unquote(km[1]);
    const sm = line.match(/^status:\s*(.+)$/);
    if (sm) result.status = unquote(sm[1]);
  }
  return result;
}

export function mergeNote(existing: string | null, region: string): string {
  if (existing == null) return region;

  const markerEnd = region.indexOf(SYNC_END_MARKER) + SYNC_END_MARKER.length;
  const regionThroughMarker = region.slice(0, markerEnd);

  const idx = existing.indexOf(SYNC_END_MARKER);
  if (idx === -1) return `${regionThroughMarker}\n${existing}`;
  return regionThroughMarker + existing.slice(idx + SYNC_END_MARKER.length);
}
