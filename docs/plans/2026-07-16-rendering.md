# OBzO Rendering Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure transform layer that turns a `ZoteroItem` (from the foundation read path) into the markdown for a paper note's synced region — frontmatter, abstract, and color-grouped highlights with stable block IDs, `zotero://` deep links, comments, and term links.

**Architecture:** A set of small, dependency-light pure functions under `src/transform/`. `renderSyncedRegion(item, ctx)` is the entry point and returns a deterministic string ending in the `<!-- obzo:end -->` marker. No Obsidian API, no filesystem — writing the string to a vault file (folder placement + protected-zone merge) is the NEXT plan. Everything is deterministic; no AI. One small foundation extension (Task 1) adds each annotation's attachment key so open-pdf deep links are correct.

**Tech Stack:** TypeScript (strict), Vitest. Builds on the merged foundation (`src/model/`, `src/db/`, `src/settings.ts`).

## Global Constraints

- **No AI/LLM features.** Deterministic string transforms only. (SPEC §1)
- **Block IDs are stable & deterministic** from the Zotero annotation key: `^h-<annotationKey>`. Stable across syncs so highlights can be embedded/linked anywhere. (SPEC §4)
- **Deep links** use the `zotero://` scheme: per-highlight `zotero://open-pdf/library/items/<attachmentKey>?annotation=<annotationKey>[&page=<page>]`; note-level `zotero://select/library/items/<itemKey>`. (SPEC §4)
- **Identity via Zotero key** in frontmatter `zotero-key`. (SPEC §3)
- **`status` is written once and never overwritten** — render emits `ctx.existingStatus ?? "unread"`, so the future merge layer can preserve a user-edited value. (SPEC §7)
- **Unmapped colors → a single catch-all section** (`ctx.unsortedLabel`, default "Unsorted highlights"). Color map is fully user-defined; ship no opinionated defaults. (SPEC §5)
- **Color role `term`** additionally appends a glossary wikilink `→ [[<highlight text>]]`. (SPEC §5)
- **Frontmatter must be Dataview-queryable** and match SPEC §4 shape (`zotero-key`, `title`, `authors` as wikilinks, `year`, `collections`, `themes`, `colors`, `related`, `date-added`, `status`, `zotero-link`). Omit optional keys when empty. (SPEC §4, §7)
- **Wikilink pass-through:** highlight comments are emitted verbatim, so any `[[...]]` a user typed in a Zotero comment renders as a real Obsidian link. (SPEC §4)
- **Small, focused files** (one responsibility each). (coding-style)

---

### Task 1: Carry the annotation's attachment key (foundation extension)

**Files:**
- Modify: `src/model/types.ts` (add `attachmentKey` to `Annotation`)
- Modify: `src/db/queries.ts` (`annotationsForPaper` selects the attachment item's key)
- Modify: `tests/db/queries.test.ts` (assert the attachment key)

**Interfaces:**
- Consumes: existing fixture (attachment item 11, key `ATTACH001`).
- Produces: `Annotation` gains `attachmentKey: string`. Every downstream transform (deep links) relies on it.

- [ ] **Step 1: Extend the failing test**

In `tests/db/queries.test.ts`, inside the existing `it("maps annotations through attachment to the paper...")` test, add after the `cd34` assertions:

```ts
    expect(cd34.attachmentKey).toBe("ATTACH001");
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/db/queries.test.ts`
Expected: FAIL — `cd34.attachmentKey` is `undefined` (property does not exist yet).

- [ ] **Step 3: Add the field to the `Annotation` interface**

In `src/model/types.ts`, add `attachmentKey` to `Annotation`:

```ts
export interface Annotation {
  key: string;
  attachmentKey: string;
  text: string | null;
  comment: string | null;
  color: string;
  pageLabel: string | null;
  sortIndex: string;
}
```

- [ ] **Step 4: Select the attachment key in the query**

In `src/db/queries.ts`, replace the whole `annotationsForPaper` function with:

```ts
function annotationsForPaper(db: Database, paperItemID: number): Annotation[] {
  return rows(
    db,
    `SELECT ann.text AS text, ann.comment AS comment, ann.color AS color,
            ann.pageLabel AS pageLabel, ann.sortIndex AS sortIndex,
            i.key AS key, attItem.key AS attachmentKey
     FROM itemAnnotations ann
     JOIN itemAttachments att ON att.itemID = ann.parentItemID
     JOIN items attItem ON attItem.itemID = att.itemID
     JOIN items i ON i.itemID = ann.itemID
     WHERE att.parentItemID = ${paperItemID}
     ORDER BY ann.sortIndex`
  ).map((r) => ({
    key: String(r.key),
    attachmentKey: String(r.attachmentKey),
    text: r.text == null ? null : String(r.text),
    comment: r.comment == null ? null : String(r.comment),
    color: String(r.color ?? ""),
    pageLabel: r.pageLabel == null ? null : String(r.pageLabel),
    sortIndex: String(r.sortIndex ?? ""),
  }));
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/db/queries.test.ts && npm run typecheck`
Expected: queries tests PASS; typecheck exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/model/types.ts src/db/queries.ts tests/db/queries.test.ts
git commit -m "feat: carry annotation attachment key for deep links"
```

---

### Task 2: Shared transform types + block IDs

**Files:**
- Create: `src/model/color.ts` (color-rule config types)
- Create: `src/transform/types.ts` (render context + highlight group)
- Create: `src/transform/blockIds.ts`
- Test: `tests/transform/blockIds.test.ts`

**Interfaces:**
- Consumes: `Annotation` (Task 1).
- Produces:
  - `src/model/color.ts`: `type ColorRole = "section" | "term"`; `interface ColorRule { color: string; label: string; role: ColorRole; }`.
  - `src/transform/types.ts`: `interface HighlightGroup { label: string; role: ColorRole | "unsorted"; annotations: Annotation[]; }`; `interface RenderContext { colorMap: ColorRule[]; unsortedLabel: string; themePrefix: string; collectionNameById: Map<number, string>; titleByKey: Map<string, string>; existingStatus?: string; }`.
  - `highlightBlockId(annotation: Annotation): string` → `h-<annotation.key>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/transform/blockIds.test.ts
import { describe, it, expect } from "vitest";
import { highlightBlockId } from "../../src/transform/blockIds";
import type { Annotation } from "../../src/model/types";

const ann = (key: string): Annotation => ({
  key,
  attachmentKey: "ATTACH001",
  text: "x",
  comment: null,
  color: "#ffd400",
  pageLabel: "3",
  sortIndex: "00003",
});

describe("highlightBlockId", () => {
  it("derives a stable id from the annotation key", () => {
    expect(highlightBlockId(ann("ANNOAB12"))).toBe("h-ANNOAB12");
  });

  it("is deterministic across calls", () => {
    expect(highlightBlockId(ann("ANNOCD34"))).toBe(highlightBlockId(ann("ANNOCD34")));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/transform/blockIds.test.ts`
Expected: FAIL — cannot find module `../../src/transform/blockIds`.

- [ ] **Step 3: Write `src/model/color.ts`**

```ts
export type ColorRole = "section" | "term";

export interface ColorRule {
  color: string; // Zotero highlight color hex, e.g. "#ffd400"
  label: string; // section heading, e.g. "Key argument"
  role: ColorRole;
}
```

- [ ] **Step 4: Write `src/transform/types.ts`**

```ts
import type { Annotation } from "../model/types";
import type { ColorRole, ColorRule } from "../model/color";

export interface HighlightGroup {
  label: string;
  role: ColorRole | "unsorted";
  annotations: Annotation[];
}

export interface RenderContext {
  colorMap: ColorRule[];
  unsortedLabel: string;
  themePrefix: string;
  collectionNameById: Map<number, string>;
  titleByKey: Map<string, string>;
  existingStatus?: string;
}
```

- [ ] **Step 5: Write `src/transform/blockIds.ts`**

```ts
import type { Annotation } from "../model/types";

export function highlightBlockId(annotation: Annotation): string {
  return `h-${annotation.key}`;
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run tests/transform/blockIds.test.ts && npm run typecheck`
Expected: PASS (2 passed); typecheck exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/model/color.ts src/transform/types.ts src/transform/blockIds.ts tests/transform/blockIds.test.ts
git commit -m "feat: shared transform types + deterministic highlight block ids"
```

---

### Task 3: Deep links

**Files:**
- Create: `src/transform/deepLinks.ts`
- Test: `tests/transform/deepLinks.test.ts`

**Interfaces:**
- Consumes: `Annotation` (with `attachmentKey`, `key`, `pageLabel`), `ZoteroItem` (`key`).
- Produces:
  - `annotationDeepLink(annotation: Annotation): string` → `zotero://open-pdf/library/items/<attachmentKey>?annotation=<key>[&page=<encoded pageLabel>]`.
  - `itemSelectLink(item: ZoteroItem): string` → `zotero://select/library/items/<item.key>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/transform/deepLinks.test.ts
import { describe, it, expect } from "vitest";
import { annotationDeepLink, itemSelectLink } from "../../src/transform/deepLinks";
import type { Annotation, ZoteroItem } from "../../src/model/types";

const ann: Annotation = {
  key: "ANNOAB12",
  attachmentKey: "ATTACH001",
  text: "x",
  comment: null,
  color: "#ffd400",
  pageLabel: "3",
  sortIndex: "00003",
};

describe("annotationDeepLink", () => {
  it("builds an open-pdf link keyed on the attachment with annotation + page", () => {
    expect(annotationDeepLink(ann)).toBe(
      "zotero://open-pdf/library/items/ATTACH001?annotation=ANNOAB12&page=3"
    );
  });

  it("omits the page param when there is no page label", () => {
    expect(annotationDeepLink({ ...ann, pageLabel: null })).toBe(
      "zotero://open-pdf/library/items/ATTACH001?annotation=ANNOAB12"
    );
  });
});

describe("itemSelectLink", () => {
  it("builds a select link on the item key", () => {
    const item = { key: "ABCD1234" } as ZoteroItem;
    expect(itemSelectLink(item)).toBe("zotero://select/library/items/ABCD1234");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/transform/deepLinks.test.ts`
Expected: FAIL — cannot find module `../../src/transform/deepLinks`.

- [ ] **Step 3: Write `src/transform/deepLinks.ts`**

```ts
import type { Annotation, ZoteroItem } from "../model/types";

export function annotationDeepLink(annotation: Annotation): string {
  const base = `zotero://open-pdf/library/items/${annotation.attachmentKey}`;
  const params = [`annotation=${annotation.key}`];
  if (annotation.pageLabel) {
    params.push(`page=${encodeURIComponent(annotation.pageLabel)}`);
  }
  return `${base}?${params.join("&")}`;
}

export function itemSelectLink(item: ZoteroItem): string {
  return `zotero://select/library/items/${item.key}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/transform/deepLinks.test.ts && npm run typecheck`
Expected: PASS (3 passed); typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/transform/deepLinks.ts tests/transform/deepLinks.test.ts
git commit -m "feat: zotero:// deep links for annotations and items"
```

---

### Task 4: Color grouping + settings color map

**Files:**
- Create: `src/transform/colors.ts`
- Modify: `src/settings.ts` (add `colorMap`, `themePrefix`, `unsortedLabel`)
- Test: `tests/transform/colors.test.ts`

**Interfaces:**
- Consumes: `Annotation`, `ColorRule` (Task 2), `HighlightGroup` (Task 2).
- Produces:
  - `groupByColor(annotations: Annotation[], colorMap: ColorRule[], unsortedLabel: string): HighlightGroup[]` — groups in color-map order (colors sharing a label merge into one group), preserves annotation order within a group, hex compare is trim + lowercase, and unmapped-color annotations fall into a single trailing catch-all group labeled `unsortedLabel` with role `"unsorted"`. Groups with zero annotations are omitted.
  - `ObzoSettings` gains `colorMap: ColorRule[]` (default `[]`), `themePrefix: string` (default `"theme/"`), `unsortedLabel: string` (default `"Unsorted highlights"`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/transform/colors.test.ts
import { describe, it, expect } from "vitest";
import { groupByColor } from "../../src/transform/colors";
import type { Annotation } from "../../src/model/types";
import type { ColorRule } from "../../src/model/color";

const mk = (key: string, color: string): Annotation => ({
  key,
  attachmentKey: "ATTACH001",
  text: key,
  comment: null,
  color,
  pageLabel: "1",
  sortIndex: key,
});

const colorMap: ColorRule[] = [
  { color: "#ffd400", label: "Key argument", role: "section" },
  { color: "#a28ae5", label: "Terms", role: "term" },
];

describe("groupByColor", () => {
  it("groups mapped colors in color-map order and preserves annotation order", () => {
    const anns = [mk("a", "#FFD400"), mk("b", "#a28ae5"), mk("c", "#ffd400")];
    const groups = groupByColor(anns, colorMap, "Unsorted highlights");
    expect(groups.map((g) => g.label)).toEqual(["Key argument", "Terms"]);
    expect(groups[0].annotations.map((a) => a.key)).toEqual(["a", "c"]);
    expect(groups[1].role).toBe("term");
  });

  it("puts unmapped colors in a trailing catch-all group", () => {
    const anns = [mk("a", "#ffd400"), mk("z", "#00ff00")];
    const groups = groupByColor(anns, colorMap, "Unsorted highlights");
    expect(groups.map((g) => g.label)).toEqual(["Key argument", "Unsorted highlights"]);
    const catchAll = groups[groups.length - 1];
    expect(catchAll.role).toBe("unsorted");
    expect(catchAll.annotations.map((a) => a.key)).toEqual(["z"]);
  });

  it("omits groups that have no annotations", () => {
    const groups = groupByColor([mk("a", "#ffd400")], colorMap, "Unsorted highlights");
    expect(groups.map((g) => g.label)).toEqual(["Key argument"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/transform/colors.test.ts`
Expected: FAIL — cannot find module `../../src/transform/colors`.

- [ ] **Step 3: Write `src/transform/colors.ts`**

```ts
import type { Annotation } from "../model/types";
import type { ColorRule } from "../model/color";
import type { HighlightGroup } from "./types";

const norm = (hex: string): string => hex.trim().toLowerCase();

export function groupByColor(
  annotations: Annotation[],
  colorMap: ColorRule[],
  unsortedLabel: string
): HighlightGroup[] {
  const groups: HighlightGroup[] = [];
  const claimed = new Set<Annotation>();
  const seenLabels = new Set<string>();

  for (const rule of colorMap) {
    if (seenLabels.has(rule.label)) continue;
    seenLabels.add(rule.label);
    const colorsForLabel = new Set(
      colorMap.filter((r) => r.label === rule.label).map((r) => norm(r.color))
    );
    const matched = annotations.filter((a) => colorsForLabel.has(norm(a.color)));
    if (matched.length === 0) continue;
    matched.forEach((a) => claimed.add(a));
    groups.push({ label: rule.label, role: rule.role, annotations: matched });
  }

  const unsorted = annotations.filter((a) => !claimed.has(a));
  if (unsorted.length > 0) {
    groups.push({ label: unsortedLabel, role: "unsorted", annotations: unsorted });
  }

  return groups;
}
```

- [ ] **Step 4: Extend `src/settings.ts`**

Replace the whole file with:

```ts
import type { ColorRule } from "./model/color";

export interface ObzoSettings {
  dbPath: string;
  vaultSubfolder: string;
  colorMap: ColorRule[];
  themePrefix: string;
  unsortedLabel: string;
}

export const DEFAULT_SETTINGS: ObzoSettings = {
  dbPath: "",
  vaultSubfolder: "zotero",
  colorMap: [],
  themePrefix: "theme/",
  unsortedLabel: "Unsorted highlights",
};
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/transform/colors.test.ts && npm run typecheck`
Expected: colors tests PASS (3 passed); typecheck exit 0 (existing `sync.test.ts` still passes — it never referenced the removed fields).

- [ ] **Step 6: Commit**

```bash
git add src/transform/colors.ts src/settings.ts tests/transform/colors.test.ts
git commit -m "feat: color-role grouping + user color map settings"
```

---

### Task 5: Frontmatter rendering

**Files:**
- Create: `src/transform/frontmatter.ts`
- Test: `tests/transform/frontmatter.test.ts`

**Interfaces:**
- Consumes: `ZoteroItem`, `RenderContext` (Task 2), `itemSelectLink` (Task 3).
- Produces:
  - `renderFrontmatter(item: ZoteroItem, ctx: RenderContext, colorLabels: string[]): string` — a YAML block fenced by `---` lines (trailing newline). Always emits `zotero-key`, `title`, `authors`, `date-added`, `status`, `zotero-link`. Emits `year`, `collections`, `themes`, `colors`, `related` only when non-empty. All list values are double-quoted (valid YAML for labels/collection names containing spaces). `authors` are `[[lastName]]` (fallback firstName). `collections` resolved via `ctx.collectionNameById`. `themes` are `item.tags` starting with `ctx.themePrefix`. `related` resolved via `ctx.titleByKey`, falling back to the raw key. `date-added` is the date portion (before the first space). `status` is `ctx.existingStatus ?? "unread"`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/transform/frontmatter.test.ts
import { describe, it, expect } from "vitest";
import { renderFrontmatter } from "../../src/transform/frontmatter";
import type { ZoteroItem } from "../../src/model/types";
import type { RenderContext } from "../../src/transform/types";

const item: ZoteroItem = {
  key: "ABCD1234",
  title: "Attention Is All You Need",
  abstract: "We propose the Transformer...",
  year: "2017",
  dateAdded: "2026-07-02 00:00:00",
  creators: [
    { firstName: "Ashish", lastName: "Vaswani" },
    { firstName: "Noam", lastName: "Shazeer" },
  ],
  tags: ["theme/attention", "nlp"],
  annotations: [],
  collectionIds: [2],
  relatedKeys: ["BERT9999"],
};

const ctx: RenderContext = {
  colorMap: [],
  unsortedLabel: "Unsorted highlights",
  themePrefix: "theme/",
  collectionNameById: new Map([[2, "Transformers"]]),
  titleByKey: new Map([["BERT9999", "BERT"]]),
};

describe("renderFrontmatter", () => {
  it("renders the SPEC-shaped frontmatter block", () => {
    const fm = renderFrontmatter(item, ctx, ["Key argument", "Terms"]);
    expect(fm.startsWith("---\n")).toBe(true);
    expect(fm.trimEnd().endsWith("---")).toBe(true);
    expect(fm).toContain("zotero-key: ABCD1234");
    expect(fm).toContain('title: "Attention Is All You Need"');
    expect(fm).toContain('authors: ["[[Vaswani]]", "[[Shazeer]]"]');
    expect(fm).toContain("year: 2017");
    expect(fm).toContain('collections: ["Transformers"]');
    expect(fm).toContain('themes: ["theme/attention"]');
    expect(fm).toContain('colors: ["Key argument", "Terms"]');
    expect(fm).toContain('related: ["[[BERT]]"]');
    expect(fm).toContain("date-added: 2026-07-02");
    expect(fm).toContain("status: unread");
    expect(fm).toContain('zotero-link: "zotero://select/library/items/ABCD1234"');
  });

  it("omits empty optional keys and preserves an existing status", () => {
    const bare: ZoteroItem = { ...item, year: null, collectionIds: [], tags: [], relatedKeys: [] };
    const fm = renderFrontmatter(bare, { ...ctx, existingStatus: "reading" }, []);
    expect(fm).not.toContain("year:");
    expect(fm).not.toContain("collections:");
    expect(fm).not.toContain("themes:");
    expect(fm).not.toContain("colors:");
    expect(fm).not.toContain("related:");
    expect(fm).toContain("status: reading");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/transform/frontmatter.test.ts`
Expected: FAIL — cannot find module `../../src/transform/frontmatter`.

- [ ] **Step 3: Write `src/transform/frontmatter.ts`**

```ts
import type { Creator, ZoteroItem } from "../model/types";
import type { RenderContext } from "./types";
import { itemSelectLink } from "./deepLinks";

const flowList = (values: string[]): string =>
  `[${values.map((v) => JSON.stringify(v)).join(", ")}]`;

const authorName = (c: Creator): string => c.lastName || c.firstName || "";

export function renderFrontmatter(
  item: ZoteroItem,
  ctx: RenderContext,
  colorLabels: string[]
): string {
  const lines: string[] = ["---"];
  lines.push(`zotero-key: ${item.key}`);
  lines.push(`title: ${JSON.stringify(item.title)}`);
  lines.push(`authors: ${flowList(item.creators.map((c) => `[[${authorName(c)}]]`))}`);

  if (item.year) lines.push(`year: ${item.year}`);

  const collections = item.collectionIds
    .map((id) => ctx.collectionNameById.get(id))
    .filter((name): name is string => Boolean(name));
  if (collections.length) lines.push(`collections: ${flowList(collections)}`);

  const themes = item.tags.filter((t) => t.startsWith(ctx.themePrefix));
  if (themes.length) lines.push(`themes: ${flowList(themes)}`);

  if (colorLabels.length) lines.push(`colors: ${flowList(colorLabels)}`);

  if (item.relatedKeys.length) {
    const related = item.relatedKeys.map((k) => `[[${ctx.titleByKey.get(k) ?? k}]]`);
    lines.push(`related: ${flowList(related)}`);
  }

  lines.push(`date-added: ${item.dateAdded.split(" ")[0]}`);
  lines.push(`status: ${ctx.existingStatus ?? "unread"}`);
  lines.push(`zotero-link: ${JSON.stringify(itemSelectLink(item))}`);
  lines.push("---");

  return lines.join("\n") + "\n";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/transform/frontmatter.test.ts && npm run typecheck`
Expected: PASS (2 passed); typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/transform/frontmatter.ts tests/transform/frontmatter.test.ts
git commit -m "feat: Dataview-ready frontmatter rendering"
```

---

### Task 6: Full synced-region render

**Files:**
- Create: `src/transform/render.ts`
- Test: `tests/transform/render.test.ts`

**Interfaces:**
- Consumes: everything above — `groupByColor` (Task 4), `renderFrontmatter` (Task 5), `annotationDeepLink` (Task 3), `highlightBlockId` (Task 2), `RenderContext`/`HighlightGroup` (Task 2).
- Produces:
  - `SYNC_END_MARKER = "<!-- obzo:end -->"` (exported constant; the future merge layer splices on it).
  - `renderSyncedRegion(item: ZoteroItem, ctx: RenderContext): string` — frontmatter, then `## Abstract` + abstract (omitted when null), then one `## <label>` section per highlight group. Each highlight is a blockquote `> <text> (p.<page>) [🔗](<deepLink>) ^<blockId>`; page suffix omitted when no page label; a `term`-role group appends ` → [[<trimmed text>]]`; a non-empty comment adds a following `  ↳ <comment>` line. Ends with `SYNC_END_MARKER`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/transform/render.test.ts
import { describe, it, expect } from "vitest";
import { renderSyncedRegion, SYNC_END_MARKER } from "../../src/transform/render";
import type { ZoteroItem, Annotation } from "../../src/model/types";
import type { RenderContext } from "../../src/transform/types";

const ann = (over: Partial<Annotation>): Annotation => ({
  key: "ANNOAB12",
  attachmentKey: "ATTACH001",
  text: "The Transformer allows for more parallelization",
  comment: "compare to [[recurrence]]",
  color: "#ffd400",
  pageLabel: "3",
  sortIndex: "00003",
  ...over,
});

const item: ZoteroItem = {
  key: "ABCD1234",
  title: "Attention Is All You Need",
  abstract: "We propose the Transformer...",
  year: "2017",
  dateAdded: "2026-07-02 00:00:00",
  creators: [{ firstName: "Ashish", lastName: "Vaswani" }],
  tags: ["theme/attention"],
  annotations: [
    ann({}),
    ann({ key: "ANNOEF56", text: "eigenvector", comment: null, color: "#a28ae5", pageLabel: "2", sortIndex: "00002" }),
  ],
  collectionIds: [2],
  relatedKeys: [],
};

const ctx: RenderContext = {
  colorMap: [
    { color: "#ffd400", label: "Key argument", role: "section" },
    { color: "#a28ae5", label: "Terms", role: "term" },
  ],
  unsortedLabel: "Unsorted highlights",
  themePrefix: "theme/",
  collectionNameById: new Map([[2, "Transformers"]]),
  titleByKey: new Map(),
};

describe("renderSyncedRegion", () => {
  it("renders frontmatter, abstract, grouped highlights, and the end marker", () => {
    const md = renderSyncedRegion(item, ctx);
    expect(md).toContain("zotero-key: ABCD1234");
    expect(md).toContain("## Abstract");
    expect(md).toContain("We propose the Transformer...");
    expect(md).toContain("## Key argument");
    expect(md).toContain(
      "> The Transformer allows for more parallelization (p.3) [🔗](zotero://open-pdf/library/items/ATTACH001?annotation=ANNOAB12&page=3) ^h-ANNOAB12"
    );
    expect(md).toContain("  ↳ compare to [[recurrence]]");
    expect(md).toContain("## Terms");
    expect(md).toContain("^h-ANNOEF56 → [[eigenvector]]");
    expect(md.trimEnd().endsWith(SYNC_END_MARKER)).toBe(true);
  });

  it("omits the abstract section when there is no abstract", () => {
    const md = renderSyncedRegion({ ...item, abstract: null }, ctx);
    expect(md).not.toContain("## Abstract");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/transform/render.test.ts`
Expected: FAIL — cannot find module `../../src/transform/render`.

- [ ] **Step 3: Write `src/transform/render.ts`**

```ts
import type { ZoteroItem, Annotation } from "../model/types";
import type { RenderContext, HighlightGroup } from "./types";
import { groupByColor } from "./colors";
import { renderFrontmatter } from "./frontmatter";
import { annotationDeepLink } from "./deepLinks";
import { highlightBlockId } from "./blockIds";

export const SYNC_END_MARKER = "<!-- obzo:end -->";

export function renderSyncedRegion(item: ZoteroItem, ctx: RenderContext): string {
  const groups = groupByColor(item.annotations, ctx.colorMap, ctx.unsortedLabel);
  const colorLabels = groups.filter((g) => g.role !== "unsorted").map((g) => g.label);

  const parts: string[] = [renderFrontmatter(item, ctx, colorLabels).trimEnd(), ""];

  if (item.abstract) {
    parts.push("## Abstract", item.abstract, "");
  }

  for (const group of groups) {
    parts.push(`## ${group.label}`);
    for (const ann of group.annotations) {
      parts.push(renderHighlight(ann, group));
    }
    parts.push("");
  }

  parts.push(SYNC_END_MARKER);
  return parts.join("\n") + "\n";
}

function renderHighlight(ann: Annotation, group: HighlightGroup): string {
  const page = ann.pageLabel ? ` (p.${ann.pageLabel})` : "";
  const text = ann.text ?? "";
  let line = `> ${text}${page} [🔗](${annotationDeepLink(ann)}) ^${highlightBlockId(ann)}`;
  if (group.role === "term") {
    line += ` → [[${text.trim()}]]`;
  }
  if (ann.comment) {
    line += `\n  ↳ ${ann.comment}`;
  }
  return line;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/transform/render.test.ts && npm run typecheck && npm test`
Expected: render tests PASS (2 passed); typecheck exit 0; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/transform/render.ts tests/transform/render.test.ts
git commit -m "feat: render a paper note's synced region from a ZoteroItem"
```

---

## Done criteria for this plan

- `renderSyncedRegion(item, ctx)` deterministically produces the SPEC §4 synced region: frontmatter + abstract + color-grouped highlights (blockquote, page, deep link, `^h-` block id, `↳` comment, term `→ [[...]]`) ending in `<!-- obzo:end -->`.
- Each annotation carries its attachment key; deep links are correct.
- `npm test`, `npm run typecheck`, `npm run build` all pass.

## Not in this plan (later plans, per SPEC §12 build order)

Folder placement + user-zone merge (splice on `SYNC_END_MARKER`, preserve `## My Notes` and existing `status`) · wiring `renderSyncedRegion` into the sync command to actually write files · settings UI for the color map · generated stubs (authors/themes/glossary) · Dashboard/Dataview · integration test that a hand-edited note survives re-sync.
