import type { ZoteroLibrary, Collection } from "../model/types";
import type { ObzoSettings } from "../settings";
import type { RenderContext } from "../transform/types";
import { renderSyncedRegion } from "../transform/render";
import { paperNotePath } from "./placement";
import { mergeNote, parseSyncedFrontmatter } from "./merge";

export interface VaultAdapter {
  listMarkdown(): Promise<Array<{ path: string; content: string }>>;
  write(path: string, content: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface WriteSummary {
  created: number;
  updated: number;
  moved: number;
}

interface PriorNote {
  path: string;
  content: string;
  status: string | null;
}

export async function writePaperNotes(
  lib: ZoteroLibrary,
  settings: ObzoSettings,
  adapter: VaultAdapter
): Promise<WriteSummary> {
  const byId = new Map<number, Collection>(lib.collections.map((c) => [c.id, c]));
  const collectionNameById = new Map<number, string>(lib.collections.map((c) => [c.id, c.name]));
  const titleByKey = new Map<string, string>(lib.items.map((i) => [i.key, i.title]));

  const existing = await adapter.listMarkdown();
  const priorByKey = new Map<string, PriorNote>();
  for (const note of existing) {
    const parsed = parseSyncedFrontmatter(note.content);
    if (parsed.zoteroKey) {
      priorByKey.set(parsed.zoteroKey, { path: note.path, content: note.content, status: parsed.status });
    }
  }

  const items = [...lib.items].sort((a, b) => a.key.localeCompare(b.key));

  // Pass 1: resolve a unique target path for every item. Item keys are unique,
  // so appending " <key>" yields a globally unique path — one suffix pass always
  // resolves a collision. ownerByPath records which key owns each resolved path.
  const ownerByPath = new Map<string, string>();
  const targetByKey = new Map<string, string>();
  for (const item of items) {
    const base = paperNotePath(item, byId, settings);
    let target = base;
    if (ownerByPath.has(target) && ownerByPath.get(target) !== item.key) {
      target = base.replace(/\.md$/, ` ${item.key}.md`);
    }
    ownerByPath.set(target, item.key);
    targetByKey.set(item.key, target);
  }
  const finalTargets = new Set(targetByKey.values());

  // Pass 2: write each note, then remove an old path only if no other item now
  // owns it (so a moved note never deletes a file another paper just claimed).
  const summary: WriteSummary = { created: 0, updated: 0, moved: 0 };
  for (const item of items) {
    const prior = priorByKey.get(item.key);
    const target = targetByKey.get(item.key) as string;

    const ctx: RenderContext = {
      colorMap: settings.colorMap,
      unsortedLabel: settings.unsortedLabel,
      themePrefix: settings.themePrefix,
      collectionNameById,
      titleByKey,
      existingStatus: prior?.status ?? undefined,
    };
    const region = renderSyncedRegion(item, ctx);
    await adapter.write(target, mergeNote(prior?.content ?? null, region));

    if (!prior) {
      summary.created += 1;
    } else if (prior.path !== target) {
      summary.moved += 1;
      if (!finalTargets.has(prior.path)) {
        await adapter.remove(prior.path);
      }
    } else {
      summary.updated += 1;
    }
  }

  return summary;
}
