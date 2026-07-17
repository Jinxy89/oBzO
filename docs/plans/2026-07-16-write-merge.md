# OBzO Write/Merge Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the synced region produced by `renderSyncedRegion` (rendering slice) and actually place & write one literature note per paper into the Obsidian vault — deriving the target folder from the Zotero collection tree, preserving the user's protected zone below `<!-- obzo:end -->`, preserving a user-edited `status`, and re-locating notes by their stable `zotero-key` when a paper is renamed or moved.

**Architecture:** Pure-core / IO-shell, matching the rest of OBzO. Three pure, unit-tested modules under `src/write/` — `placement.ts` (folder + filename derivation), `merge.ts` (frontmatter parse + protected-zone splice), and `writeNotes.ts` (the orchestrator + a `VaultAdapter` seam). The orchestrator is tested end-to-end against an in-memory `VaultAdapter` fake, so the full place→scan→merge→write→move flow is deterministic and runs under Vitest with no Obsidian. A single thin `ObsidianVault` adapter + the command wiring in `main.ts`/`sync.ts` is the only code that touches the real Obsidian API; it is not unit-testable (no Obsidian in Vitest) and is controller-verified, exactly like the foundation's `sql-wasm.wasm` delivery.

**Tech Stack:** TypeScript (strict), Vitest, Obsidian API (adapter only). Builds on the merged foundation (`src/db/`, `src/model/`, `src/settings.ts`) and rendering (`src/transform/`) slices.

## Global Constraints

- **No AI/LLM features.** Deterministic transforms + file I/O only. (SPEC §1)
- **Identity via `zotero-key`.** The existing note for a paper is found by scanning managed notes' frontmatter for a matching `zotero-key` — never by path. Renaming/moving the note (or the paper) must update the same file, not orphan it. (SPEC §3; decision 2026-07-16: scan-vault lookup)
- **Protected user zone.** Only the region up to and including `<!-- obzo:end -->` is regenerated; everything after the marker is preserved byte-for-byte. A managed note that somehow has no marker must never lose content. (SPEC §3)
- **`status` written once.** On re-sync, the prior note's `status` is parsed and fed back as `ctx.existingStatus`, so `renderSyncedRegion` re-emits the user's value instead of resetting to `unread`. (SPEC §7)
- **Filename = sanitized title** (decision 2026-07-16). Illegal path characters removed; on collision between two different keys, append ` <zotero-key>` before `.md`. (SPEC §4, §10)
- **Folder = primary collection path.** `<vaultSubfolder>/<collection/path>/<Title>.md`; primary = the deepest of the item's collections. Items in no collection → `<vaultSubfolder>/<unfiledFolder>/`. All memberships still live in `collections:` frontmatter (already emitted by the rendering slice). (SPEC §4)
- **Never destroy notes for vanished items.** The orchestrator only writes/moves papers present in the library; it never deletes a note whose key is absent from Zotero. (SPEC §10)
- **Pure core stays pure.** `src/write/placement.ts`, `merge.ts`, `writeNotes.ts` import only from `../model`, `../settings`, `../transform`, and each other — no `obsidian`, no `node:fs`. Only `src/write/obsidianVault.ts` and `main.ts` may import `obsidian`. (coding-style / architecture)
- **Small, focused files**, one responsibility each. (coding-style)

---

### Task 1: Folder placement + filename sanitization

**Files:**
- Create: `src/write/placement.ts`
- Modify: `src/settings.ts` (add `unfiledFolder`)
- Test: `tests/write/placement.test.ts`

**Interfaces:**
- Consumes: `ZoteroItem`, `Collection` (`src/model/types.ts`); `ObzoSettings` (`src/settings.ts`).
- Produces:
  - `sanitizeSegment(name: string): string` — strips `\ / : * ? " < > |` and control chars, collapses whitespace, trims trailing dots/spaces, falls back to `"untitled"` when empty.
  - `primaryCollectionId(item: ZoteroItem, byId: Map<number, Collection>): number | null` — the item's deepest-path collection (tie-break: lowest id); `null` if the item is in no known collection.
  - `paperNotePath(item: ZoteroItem, byId: Map<number, Collection>, settings: ObzoSettings): string` — the vault-relative `.md` path.
  - `ObzoSettings` gains `unfiledFolder: string` (default `"_Unfiled"`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/write/placement.test.ts
import { describe, it, expect } from "vitest";
import { sanitizeSegment, primaryCollectionId, paperNotePath } from "../../src/write/placement";
import { DEFAULT_SETTINGS } from "../../src/settings";
import type { ZoteroItem, Collection } from "../../src/model/types";

const collections: Collection[] = [
  { id: 1, name: "AI", parentId: null },
  { id: 2, name: "Transformers", parentId: 1 },
];
const byId = new Map<number, Collection>(collections.map((c) => [c.id, c]));

const item = (over: Partial<ZoteroItem>): ZoteroItem => ({
  key: "ABCD1234",
  title: "Attention Is All You Need",
  abstract: null,
  year: null,
  dateAdded: "2026-07-02 00:00:00",
  creators: [],
  tags: [],
  annotations: [],
  collectionIds: [2],
  relatedKeys: [],
  ...over,
});

describe("sanitizeSegment", () => {
  it("removes illegal path characters and trims", () => {
    expect(sanitizeSegment('a/b:c*?"<>|d')).toBe("a b c d");
  });
  it("falls back to 'untitled' when nothing survives", () => {
    expect(sanitizeSegment("///")).toBe("untitled");
  });
});

describe("primaryCollectionId", () => {
  it("picks the deepest collection", () => {
    expect(primaryCollectionId(item({ collectionIds: [1, 2] }), byId)).toBe(2);
  });
  it("returns null when the item is unfiled", () => {
    expect(primaryCollectionId(item({ collectionIds: [] }), byId)).toBe(null);
  });
});

describe("paperNotePath", () => {
  it("nests the note under its primary collection path", () => {
    expect(paperNotePath(item({}), byId, DEFAULT_SETTINGS)).toBe(
      "zotero/AI/Transformers/Attention Is All You Need.md"
    );
  });
  it("routes unfiled items to the unfiled folder", () => {
    expect(paperNotePath(item({ collectionIds: [] }), byId, DEFAULT_SETTINGS)).toBe(
      "zotero/_Unfiled/Attention Is All You Need.md"
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/write/placement.test.ts`
Expected: FAIL — cannot find module `../../src/write/placement`.

- [ ] **Step 3: Add `unfiledFolder` to `src/settings.ts`**

Add the field to the interface and default (keep every existing field):

```ts
import type { ColorRule } from "./model/color";

export interface ObzoSettings {
  dbPath: string;
  vaultSubfolder: string;
  colorMap: ColorRule[];
  themePrefix: string;
  unsortedLabel: string;
  unfiledFolder: string;
}

export const DEFAULT_SETTINGS: ObzoSettings = {
  dbPath: "",
  vaultSubfolder: "zotero",
  colorMap: [],
  themePrefix: "theme/",
  unsortedLabel: "Unsorted highlights",
  unfiledFolder: "_Unfiled",
};
```

- [ ] **Step 4: Write `src/write/placement.ts`**

The `ILLEGAL` class is exactly the nine filesystem-illegal characters. It deliberately does NOT include space or hyphen, so titles like `state-of-the-art` keep their hyphens and normal spaces survive. Each illegal char is replaced with a space; then runs of whitespace are collapsed and the ends trimmed, which is why `a/b:c` becomes `a b c`.

```ts
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
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/write/placement.test.ts && npm run typecheck`
Expected: placement tests PASS (6 passed); typecheck exit 0 (existing `sync.test.ts` unaffected — it never constructs an `ObzoSettings` literal).

- [ ] **Step 6: Commit**

```bash
git add src/write/placement.ts src/settings.ts tests/write/placement.test.ts
git commit -m "feat: derive paper-note folder path and sanitize filenames"
```

---

### Task 2: Frontmatter parse + protected-zone merge

**Files:**
- Create: `src/write/merge.ts`
- Test: `tests/write/merge.test.ts`

**Interfaces:**
- Consumes: `SYNC_END_MARKER` (`src/transform/render.ts`).
- Produces:
  - `interface ParsedNote { zoteroKey: string | null; status: string | null; }`.
  - `parseSyncedFrontmatter(content: string): ParsedNote` — reads `zotero-key` and `status` from the leading `---`-fenced block (quotes stripped); both `null` when absent or no frontmatter.
  - `mergeNote(existing: string | null, region: string): string` — for a new note returns `region` verbatim; for an existing note replaces everything up to and including `SYNC_END_MARKER` with the freshly rendered region and preserves the tail after the marker byte-for-byte; if the existing note has no marker, prepends the region and keeps the whole existing body below it (never destroys content).

- [ ] **Step 1: Write the failing test**

```ts
// tests/write/merge.test.ts
import { describe, it, expect } from "vitest";
import { parseSyncedFrontmatter, mergeNote } from "../../src/write/merge";
import { SYNC_END_MARKER } from "../../src/transform/render";

const region = `---\nzotero-key: ABCD1234\nstatus: unread\n---\n## Abstract\nnew\n${SYNC_END_MARKER}\n`;

describe("parseSyncedFrontmatter", () => {
  it("reads zotero-key and status, stripping quotes", () => {
    const parsed = parseSyncedFrontmatter(`---\nzotero-key: ABCD1234\ntitle: "X"\nstatus: reading\n---\nbody`);
    expect(parsed.zoteroKey).toBe("ABCD1234");
    expect(parsed.status).toBe("reading");
  });
  it("returns nulls when there is no frontmatter", () => {
    expect(parseSyncedFrontmatter("no frontmatter here")).toEqual({ zoteroKey: null, status: null });
  });
});

describe("mergeNote", () => {
  it("returns the region verbatim for a new note", () => {
    expect(mergeNote(null, region)).toBe(region);
  });

  it("replaces the synced region but preserves everything below the marker", () => {
    const existing =
      `---\nzotero-key: ABCD1234\nstatus: reading\n---\n## Abstract\nold\n${SYNC_END_MARKER}\n## My Notes\nmine\n`;
    const merged = mergeNote(existing, region);
    expect(merged).toContain("## Abstract\nnew");
    expect(merged).not.toContain("old");
    expect(merged).toContain("## My Notes\nmine");
    // exactly one marker remains
    expect(merged.split(SYNC_END_MARKER).length - 1).toBe(1);
  });

  it("keeps existing content when there is no marker", () => {
    const merged = mergeNote("## My Notes\nmine\n", region);
    expect(merged).toContain(SYNC_END_MARKER);
    expect(merged).toContain("## My Notes\nmine");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/write/merge.test.ts`
Expected: FAIL — cannot find module `../../src/write/merge`.

- [ ] **Step 3: Write `src/write/merge.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/write/merge.test.ts && npm run typecheck`
Expected: PASS (5 passed); typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/write/merge.ts tests/write/merge.test.ts
git commit -m "feat: parse frontmatter + splice synced region above the protected zone"
```

---

### Task 3: Write orchestrator + VaultAdapter seam

**Files:**
- Create: `src/write/writeNotes.ts`
- Create: `tests/helpers/inMemoryVault.ts`
- Test: `tests/write/writeNotes.test.ts`

**Interfaces:**
- Consumes: `ZoteroLibrary`, `Collection` (`src/model/types.ts`); `ObzoSettings`; `RenderContext` (`src/transform/types.ts`); `renderSyncedRegion` (`src/transform/render.ts`); `paperNotePath` (Task 1); `mergeNote`/`parseSyncedFrontmatter` (Task 2).
- Produces:
  - `interface VaultAdapter { listMarkdown(): Promise<Array<{ path: string; content: string }>>; write(path: string, content: string): Promise<void>; remove(path: string): Promise<void>; }`.
  - `interface WriteSummary { created: number; updated: number; moved: number; }`.
  - `writePaperNotes(lib: ZoteroLibrary, settings: ObzoSettings, adapter: VaultAdapter): Promise<WriteSummary>` — scans existing managed notes by `zotero-key`, and for each library item (processed in `key` order for determinism) renders the region with the preserved `status`, computes its target path (collision → append ` <key>`), merges over any prior content, writes, and removes the old path when the note moved.

- [ ] **Step 1: Write the failing test**

```ts
// tests/write/writeNotes.test.ts
import { describe, it, expect } from "vitest";
import { writePaperNotes } from "../../src/write/writeNotes";
import { InMemoryVault } from "../helpers/inMemoryVault";
import { SYNC_END_MARKER } from "../../src/transform/render";
import { DEFAULT_SETTINGS } from "../../src/settings";
import type { ZoteroLibrary, ZoteroItem } from "../../src/model/types";

const item = (over: Partial<ZoteroItem>): ZoteroItem => ({
  key: "ABCD1234",
  title: "Attention Is All You Need",
  abstract: "abstract",
  year: "2017",
  dateAdded: "2026-07-02 00:00:00",
  creators: [{ firstName: "Ashish", lastName: "Vaswani" }],
  tags: [],
  annotations: [],
  collectionIds: [2],
  relatedKeys: [],
  ...over,
});

const lib = (items: ZoteroItem[]): ZoteroLibrary => ({
  collections: [
    { id: 1, name: "AI", parentId: null },
    { id: 2, name: "Transformers", parentId: 1 },
  ],
  items,
});

const PATH = "zotero/AI/Transformers/Attention Is All You Need.md";

describe("writePaperNotes", () => {
  it("creates a note at its collection path", async () => {
    const vault = new InMemoryVault();
    const summary = await writePaperNotes(lib([item({})]), DEFAULT_SETTINGS, vault);
    expect(summary.created).toBe(1);
    const content = vault.files.get(PATH);
    expect(content).toBeDefined();
    expect(content).toContain("zotero-key: ABCD1234");
    expect(content!.trimEnd().endsWith(SYNC_END_MARKER)).toBe(true);
  });

  it("preserves the user's protected zone on re-sync", async () => {
    const seeded = `---\nzotero-key: ABCD1234\nstatus: unread\n---\nold region\n${SYNC_END_MARKER}\n## My Notes\nmine\n`;
    const vault = new InMemoryVault({ [PATH]: seeded });
    const summary = await writePaperNotes(lib([item({})]), DEFAULT_SETTINGS, vault);
    expect(summary.updated).toBe(1);
    expect(vault.files.get(PATH)).toContain("## My Notes\nmine");
    expect(vault.files.get(PATH)).not.toContain("old region");
  });

  it("preserves a user-edited status", async () => {
    const seeded = `---\nzotero-key: ABCD1234\nstatus: reading\n---\nx\n${SYNC_END_MARKER}\n`;
    const vault = new InMemoryVault({ [PATH]: seeded });
    await writePaperNotes(lib([item({})]), DEFAULT_SETTINGS, vault);
    expect(vault.files.get(PATH)).toContain("status: reading");
  });

  it("moves the note (carrying the user zone) when the paper changes collection", async () => {
    const oldPath = "zotero/AI/Attention Is All You Need.md";
    const seeded = `---\nzotero-key: ABCD1234\nstatus: unread\n---\nx\n${SYNC_END_MARKER}\n## My Notes\nmine\n`;
    const vault = new InMemoryVault({ [oldPath]: seeded });
    const summary = await writePaperNotes(lib([item({ collectionIds: [2] })]), DEFAULT_SETTINGS, vault);
    expect(summary.moved).toBe(1);
    expect(vault.files.has(oldPath)).toBe(false);
    expect(vault.files.get(PATH)).toContain("## My Notes\nmine");
  });

  it("suffixes the filename when two different papers share a title", async () => {
    const a = item({ key: "AAAA1111", collectionIds: [] });
    const b = item({ key: "BBBB2222", collectionIds: [] });
    const vault = new InMemoryVault();
    await writePaperNotes(lib([a, b]), DEFAULT_SETTINGS, vault);
    const paths = [...vault.files.keys()].sort();
    expect(paths).toEqual([
      "zotero/_Unfiled/Attention Is All You Need BBBB2222.md",
      "zotero/_Unfiled/Attention Is All You Need.md",
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/write/writeNotes.test.ts`
Expected: FAIL — cannot find module `../../src/write/writeNotes` (and `../helpers/inMemoryVault`).

- [ ] **Step 3: Write `tests/helpers/inMemoryVault.ts`**

```ts
import type { VaultAdapter } from "../../src/write/writeNotes";

export class InMemoryVault implements VaultAdapter {
  files: Map<string, string>;

  constructor(seed: Record<string, string> = {}) {
    this.files = new Map(Object.entries(seed));
  }

  async listMarkdown(): Promise<Array<{ path: string; content: string }>> {
    return [...this.files.entries()]
      .filter(([path]) => path.endsWith(".md"))
      .map(([path, content]) => ({ path, content }));
  }

  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }
}
```

- [ ] **Step 4: Write `src/write/writeNotes.ts`**

```ts
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
```

- [ ] **Step 5: Run tests + typecheck + full suite**

Run: `npx vitest run tests/write/writeNotes.test.ts && npm run typecheck && npm test`
Expected: writeNotes tests PASS (5 passed); typecheck exit 0; full suite green.

- [ ] **Step 6: Commit**

```bash
git add src/write/writeNotes.ts tests/helpers/inMemoryVault.ts tests/write/writeNotes.test.ts
git commit -m "feat: write orchestrator — place, merge, move notes by zotero-key"
```

---

### Task 4: Obsidian vault adapter + wire into the sync command

**Files:**
- Create: `src/write/obsidianVault.ts`
- Modify: `src/sync.ts` (add `syncToVault`)
- Modify: `src/main.ts` (build the adapter, call `syncToVault`, report the summary)

**Interfaces:**
- Consumes: `VaultAdapter`/`WriteSummary`/`writePaperNotes` (Task 3); `openSnapshot`/`SnapshotOptions` (`src/db/snapshot.ts`); `readLibrary` (`src/db/queries.ts`); `ObzoSettings`.
- Produces:
  - `class ObsidianVault implements VaultAdapter` — over `App`, scoped to `settings.vaultSubfolder`.
  - `syncToVault(dbPath, settings, adapter, options?): Promise<WriteSummary & { items: number }>` in `src/sync.ts`.
  - `main.ts` command builds an `ObsidianVault` and calls `syncToVault`, surfacing the summary in a `Notice`.

> **Note (untestable IO shell):** this task touches the real Obsidian API, which is not available under Vitest — mirror the foundation's `sql-wasm.wasm` delivery: keep the adapter thin, verify by inspection, and confirm the full suite (Tasks 1–3 + prior slices) stays green and the bundle builds. Do NOT add a Vitest test that imports `obsidian`.

- [ ] **Step 1: Write `src/write/obsidianVault.ts`**

```ts
import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { VaultAdapter } from "./writeNotes";

export class ObsidianVault implements VaultAdapter {
  constructor(
    private readonly app: App,
    private readonly root: string
  ) {}

  async listMarkdown(): Promise<Array<{ path: string; content: string }>> {
    const prefix = `${this.root}/`;
    const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(prefix));
    const out: Array<{ path: string; content: string }> = [];
    for (const file of files) {
      out.push({ path: file.path, content: await this.app.vault.cachedRead(file) });
    }
    return out;
  }

  async write(path: string, content: string): Promise<void> {
    const norm = normalizePath(path);
    await this.ensureFolder(norm.slice(0, norm.lastIndexOf("/")));
    const existing = this.app.vault.getAbstractFileByPath(norm);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(norm, content);
    }
  }

  async remove(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (file instanceof TFile) {
      await this.app.fileManager.trashFile(file);
    }
  }

  private async ensureFolder(folder: string): Promise<void> {
    if (!folder) return;
    const parts = folder.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const at = this.app.vault.getAbstractFileByPath(current);
      if (at instanceof TFolder) continue;
      if (at == null) await this.app.vault.createFolder(current);
    }
  }
}
```

- [ ] **Step 2: Add `syncToVault` to `src/sync.ts`**

Add alongside the existing `syncFromDb` (keep `syncFromDb` — it is still used by `tests/sync.test.ts`). The final `src/sync.ts` is:

```ts
import { openSnapshot, type SnapshotOptions } from "./db/snapshot";
import { readLibrary } from "./db/queries";
import type { ObzoSettings } from "./settings";
import { writePaperNotes, type VaultAdapter, type WriteSummary } from "./write/writeNotes";

export interface SyncSummary {
  collections: number;
  items: number;
  annotations: number;
}

export async function syncFromDb(dbPath: string, options?: SnapshotOptions): Promise<SyncSummary> {
  const handle = await openSnapshot(dbPath, options);
  try {
    const lib = readLibrary(handle);
    const annotations = lib.items.reduce((sum, i) => sum + i.annotations.length, 0);
    return {
      collections: lib.collections.length,
      items: lib.items.length,
      annotations,
    };
  } finally {
    handle.close();
  }
}

export async function syncToVault(
  dbPath: string,
  settings: ObzoSettings,
  adapter: VaultAdapter,
  options?: SnapshotOptions
): Promise<WriteSummary & { items: number }> {
  const handle = await openSnapshot(dbPath, options);
  try {
    const lib = readLibrary(handle);
    const summary = await writePaperNotes(lib, settings, adapter);
    return { ...summary, items: lib.items.length };
  } finally {
    handle.close();
  }
}
```

- [ ] **Step 3: Wire the command in `src/main.ts`**

Replace `runSync` and its imports so it writes to the vault (keep the settings guard, the `locateFile`/`pluginDir` resolution, and the `try/catch`). The final `src/main.ts` is:

```ts
import { App, FileSystemAdapter, Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type ObzoSettings } from "./settings";
import { syncToVault } from "./sync";
import { ObsidianVault } from "./write/obsidianVault";

async function runSync(app: App, settings: ObzoSettings, pluginDir: string): Promise<void> {
  if (!settings.dbPath) {
    new Notice("OBzO: set your zotero.sqlite path in settings first.");
    return;
  }
  try {
    const locateFile = (file: string) => `${pluginDir}/${file}`;
    const adapter = new ObsidianVault(app, settings.vaultSubfolder);
    const s = await syncToVault(settings.dbPath, settings, adapter, { locateFile });
    new Notice(
      `OBzO: ${s.items} papers — ${s.created} created, ${s.updated} updated, ${s.moved} moved.`
    );
  } catch (e) {
    new Notice(`OBzO: sync failed — ${(e as Error).message}`);
  }
}

export default class ObzoPlugin extends Plugin {
  settings: ObzoSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.addCommand({
      id: "obzo-sync",
      name: "OBzO: Sync from Zotero",
      callback: () => {
        const adapter = this.app.vault.adapter;
        const base = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : "";
        const pluginDir = this.manifest.dir ? `${base}/${this.manifest.dir}` : base;
        return runSync(this.app, this.settings, pluginDir);
      },
    });
  }
}
```

- [ ] **Step 4: Verify — typecheck, full suite, build**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck exit 0; full suite green (Tasks 1–3 + all prior slices; no new Vitest test imports `obsidian`); `npm run build` emits `main.js` + `sql-wasm.wasm`.

- [ ] **Step 5: Commit**

```bash
git add src/write/obsidianVault.ts src/sync.ts src/main.ts
git commit -m "feat: write synced notes into the vault from the sync command"
```

---

## Done criteria for this plan

- Running `OBzO: Sync from Zotero` writes one literature note per paper under `zotero/<collection path>/<Title>.md` (unfiled → `zotero/_Unfiled/`), each containing the rendered synced region ending in `<!-- obzo:end -->`.
- Re-syncing preserves the user's `## My Notes` zone and any user-edited `status`, and re-locates a note by its `zotero-key` (carrying the user zone) when the paper's title or collection changes — never orphaning or duplicating.
- Filename collisions between different papers get a ` <zotero-key>` suffix; notes for items no longer in Zotero are left untouched.
- `npm test`, `npm run typecheck`, `npm run build` all pass; only `obsidianVault.ts` + `main.ts` touch the Obsidian API.

## Not in this plan (later plans, per SPEC §12)

Settings UI for paths/color map/toggles (§12.6) · generated stubs — authors, themes, glossary (§12.7) · `_Dashboard.md` Dataview queries + last-sync stamping (§12.8) · the end-to-end integration test that seeds a fixture `zotero.sqlite`, syncs into a temp vault, and asserts a hand-edited `## My Notes` **and** a hand-written glossary definition both survive re-sync (§11 — best written once stubs exist, so the whole generated surface is covered at once).
