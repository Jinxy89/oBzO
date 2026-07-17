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

  const summary: WriteSummary = { created: 0, updated: 0, moved: 0 };
  const usedPaths = new Set<string>();
  const items = [...lib.items].sort((a, b) => a.key.localeCompare(b.key));

  for (const item of items) {
    const prior = priorByKey.get(item.key);

    const ctx: RenderContext = {
      colorMap: settings.colorMap,
      unsortedLabel: settings.unsortedLabel,
      themePrefix: settings.themePrefix,
      collectionNameById,
      titleByKey,
      existingStatus: prior?.status ?? undefined,
    };
    const region = renderSyncedRegion(item, ctx);

    let target = paperNotePath(item, byId, settings);
    if (usedPaths.has(target) && target !== prior?.path) {
      target = target.replace(/\.md$/, ` ${item.key}.md`);
    }
    usedPaths.add(target);

    await adapter.write(target, mergeNote(prior?.content ?? null, region));

    if (!prior) {
      summary.created += 1;
    } else if (prior.path !== target) {
      await adapter.remove(prior.path);
      summary.moved += 1;
    } else {
      summary.updated += 1;
    }
  }

  return summary;
}
