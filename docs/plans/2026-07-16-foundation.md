# OBzO Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a buildable, testable Obsidian-plugin skeleton that can copy a locked Zotero SQLite database, read it with `sql.js`, and turn it into a typed domain model — the foundation every later feature builds on.

**Architecture:** A desktop-only Obsidian plugin bundled with esbuild. A read path takes `zotero.sqlite` → temp snapshot → `sql.js` in-memory DB → SQL queries → typed domain objects (collections tree, items, annotations, creators, tags). This plan stops at the domain model; rendering notes and writing files are separate follow-up plans. Everything is deterministic — no AI.

**Tech Stack:** TypeScript, Obsidian plugin API, esbuild, `sql.js` (pure-WASM SQLite), Vitest. Node v25 / npm 11.

## Global Constraints

- **No AI/LLM features.** Every behavior is deterministic, derived from Zotero data. (SPEC §1 non-goals)
- **Desktop-only.** `manifest.json` sets `"isDesktopOnly": true`. (SPEC §2)
- **Never write to Zotero's data.** The plugin reads a *copied snapshot* only; it must never open the live `zotero.sqlite`. (SPEC §2)
- **Pure-WASM SQLite (`sql.js`).** No native SQLite modules — must bundle cleanly into an Obsidian plugin. (SPEC §2)
- **Identity via Zotero key.** The stable ID is the Zotero item `key`, not the title. (SPEC §3)
- **Small focused files** (one responsibility each; ≤800 lines). (coding-style)
- **Manifest id:** `obzo`. Command id: `obzo-sync`, title `OBzO: Sync from Zotero`.

---

### Task 1: Project scaffold + buildable plugin skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `manifest.json`
- Create: `versions.json`
- Create: `.gitignore`
- Create: `vitest.config.ts`
- Create: `src/main.ts`
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `npm run build` emits `main.js`; `npm test` runs Vitest. `src/main.ts` exports `default class ObzoPlugin extends Plugin` and registers the command id `obzo-sync` titled `OBzO: Sync from Zotero` (callback stubbed here, wired in Task 5).

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "obzo",
  "version": "0.0.1",
  "description": "Obsidian ⇄ Zotero knowledge sync (desktop-only, no AI).",
  "type": "module",
  "scripts": {
    "build": "node esbuild.config.mjs production",
    "dev": "node esbuild.config.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["obsidian", "zotero"],
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^22.0.0",
    "builtin-modules": "^4.0.0",
    "esbuild": "^0.24.0",
    "obsidian": "^1.7.2",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "sql.js": "^1.12.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noImplicitAny": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Write `esbuild.config.mjs`**

```js
import esbuild from "esbuild";
import builtins from "builtin-modules";

const production = process.argv[2] === "production";

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", ...builtins],
  format: "cjs",
  target: "es2022",
  platform: "node",
  sourcemap: production ? false : "inline",
  minify: production,
  outfile: "main.js",
  logLevel: "info",
});

if (production) {
  await ctx.rebuild();
  await ctx.dispose();
} else {
  await ctx.watch();
}
```

- [ ] **Step 4: Write `manifest.json` and `versions.json`**

`manifest.json`:

```json
{
  "id": "obzo",
  "name": "OBzO — Zotero Sync",
  "version": "0.0.1",
  "minAppVersion": "1.7.2",
  "description": "Sync Zotero highlights, comments, and metadata into a linked, reviewable Obsidian knowledge base. Desktop-only, no AI.",
  "author": "jinxyw",
  "isDesktopOnly": true
}
```

`versions.json`:

```json
{ "0.0.1": "1.7.2" }
```

- [ ] **Step 5: Write `.gitignore` and `vitest.config.ts`**

`.gitignore`:

```gitignore
node_modules/
dist/
main.js
*.log
.DS_Store
tests/fixtures/*.sqlite
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 6: Write `src/main.ts` (plugin entry; sync call stubbed)**

```ts
import { Plugin, Notice } from "obsidian";

export default class ObzoPlugin extends Plugin {
  async onload(): Promise<void> {
    this.addCommand({
      id: "obzo-sync",
      name: "OBzO: Sync from Zotero",
      callback: async () => {
        // Task 5 replaces this body with runSync(this.app, this.settings).
        new Notice("OBzO: sync not yet wired.");
      },
    });
  }
}
```

- [ ] **Step 7: Write the failing smoke test**

```ts
// tests/smoke.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("scaffold", () => {
  it("manifest declares desktop-only plugin with id obzo", () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.id).toBe("obzo");
    expect(manifest.isDesktopOnly).toBe(true);
  });
});
```

- [ ] **Step 8: Install deps, run test to verify it passes**

Run:
```bash
npm install
npm test
```
Expected: `tests/smoke.test.ts` PASSES (1 passed).

- [ ] **Step 9: Verify the plugin builds and typechecks**

Run:
```bash
npm run build
npm run typecheck
```
Expected: `main.js` emitted at repo root; `typecheck` exits 0 with no errors.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json esbuild.config.mjs manifest.json versions.json .gitignore vitest.config.ts src/main.ts tests/smoke.test.ts
git commit -m "chore: scaffold OBzO obsidian plugin (build + test toolchain)"
```

---

### Task 2: Domain model types + collection tree builder

**Files:**
- Create: `src/model/types.ts`
- Create: `src/model/tree.ts`
- Test: `tests/model/tree.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Types: `Creator { firstName: string | null; lastName: string; }`, `Annotation { key: string; text: string | null; comment: string | null; color: string; pageLabel: string | null; sortIndex: string; }`, `ZoteroItem { key: string; title: string; abstract: string | null; year: string | null; dateAdded: string; creators: Creator[]; tags: string[]; annotations: Annotation[]; collectionIds: number[]; relatedKeys: string[]; }`, `Collection { id: number; name: string; parentId: number | null; }`, `CollectionNode extends Collection { children: CollectionNode[]; }`, `ZoteroLibrary { collections: Collection[]; items: ZoteroItem[]; }`.
  - Function: `buildCollectionTree(collections: Collection[]): CollectionNode[]` — roots (`parentId === null`) first, children nested, each level sorted by `name` (`a.name.localeCompare(b.name)`). Orphans (parentId points to a missing collection) are treated as roots.

- [ ] **Step 1: Write the failing test**

```ts
// tests/model/tree.test.ts
import { describe, it, expect } from "vitest";
import { buildCollectionTree } from "../../src/model/tree";
import type { Collection } from "../../src/model/types";

describe("buildCollectionTree", () => {
  it("nests children under parents and sorts by name", () => {
    const flat: Collection[] = [
      { id: 2, name: "Transformers", parentId: 1 },
      { id: 1, name: "AI", parentId: null },
      { id: 3, name: "Attention", parentId: 1 },
    ];
    const tree = buildCollectionTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("AI");
    expect(tree[0].children.map((c) => c.name)).toEqual(["Attention", "Transformers"]);
  });

  it("treats an orphan (missing parent) as a root", () => {
    const flat: Collection[] = [{ id: 5, name: "Loose", parentId: 999 }];
    const tree = buildCollectionTree(flat);
    expect(tree.map((c) => c.name)).toEqual(["Loose"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/model/tree.test.ts`
Expected: FAIL — cannot find module `../../src/model/tree`.

- [ ] **Step 3: Write `src/model/types.ts`**

```ts
export interface Creator {
  firstName: string | null;
  lastName: string;
}

export interface Annotation {
  key: string;
  text: string | null;
  comment: string | null;
  color: string;
  pageLabel: string | null;
  sortIndex: string;
}

export interface ZoteroItem {
  key: string;
  title: string;
  abstract: string | null;
  year: string | null;
  dateAdded: string;
  creators: Creator[];
  tags: string[];
  annotations: Annotation[];
  collectionIds: number[];
  relatedKeys: string[];
}

export interface Collection {
  id: number;
  name: string;
  parentId: number | null;
}

export interface CollectionNode extends Collection {
  children: CollectionNode[];
}

export interface ZoteroLibrary {
  collections: Collection[];
  items: ZoteroItem[];
}
```

- [ ] **Step 4: Write `src/model/tree.ts`**

```ts
import type { Collection, CollectionNode } from "./types";

export function buildCollectionTree(collections: Collection[]): CollectionNode[] {
  const byId = new Map<number, CollectionNode>();
  for (const c of collections) {
    byId.set(c.id, { ...c, children: [] });
  }

  const roots: CollectionNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId != null ? byId.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRec = (nodes: CollectionNode[]): void => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);

  return roots;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/model/tree.test.ts`
Expected: PASS (2 passed).

- [ ] **Step 6: Commit**

```bash
git add src/model/types.ts src/model/tree.ts tests/model/tree.test.ts
git commit -m "feat: domain model types + collection tree builder"
```

---

### Task 3: DB snapshot (copy locked DB, open with sql.js, cleanup)

**Files:**
- Create: `src/db/snapshot.ts`
- Create: `tests/fixtures/build-fixture.ts`
- Test: `tests/db/snapshot.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks; uses `sql.js` and Node `fs`/`os`/`path`.
- Produces:
  - `openSnapshot(dbPath: string): Promise<SnapshotHandle>` — copies `dbPath` to a unique temp file, loads it with `sql.js`, returns a handle. Throws `Error("OBzO: Zotero database not found at <path>")` if the source file is missing.
  - `interface SnapshotHandle { db: Database; close(): void; }` (`Database` = `sql.js`'s type). `close()` frees the in-memory DB and deletes the temp copy.
  - `tests/fixtures/build-fixture.ts` exports `buildFixtureDb(path: string): Promise<void>` writing a minimal Zotero-shaped SQLite file seeded with one paper "Attention Is All You Need" (key `ABCD1234`), one child attachment, two creators, two annotations, a `theme/attention` tag, an abstract. Used by Tasks 3, 4, 5.

- [ ] **Step 1: Write the fixture builder**

```ts
// tests/fixtures/build-fixture.ts
import initSqlJs from "sql.js";
import { writeFileSync } from "node:fs";

export async function buildFixtureDb(path: string): Promise<void> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE collections (collectionID INTEGER PRIMARY KEY, collectionName TEXT, parentCollectionID INTEGER, key TEXT);
    CREATE TABLE collectionItems (collectionID INTEGER, itemID INTEGER, orderIndex INTEGER);
    CREATE TABLE items (itemID INTEGER PRIMARY KEY, itemTypeID INTEGER, key TEXT, dateAdded TEXT);
    CREATE TABLE fields (fieldID INTEGER PRIMARY KEY, fieldName TEXT);
    CREATE TABLE itemDataValues (valueID INTEGER PRIMARY KEY, value TEXT);
    CREATE TABLE itemData (itemID INTEGER, fieldID INTEGER, valueID INTEGER);
    CREATE TABLE itemAnnotations (itemID INTEGER PRIMARY KEY, parentItemID INTEGER, type INTEGER, text TEXT, comment TEXT, color TEXT, pageLabel TEXT, sortIndex TEXT);
    CREATE TABLE itemAttachments (itemID INTEGER PRIMARY KEY, parentItemID INTEGER, contentType TEXT, path TEXT);
    CREATE TABLE creators (creatorID INTEGER PRIMARY KEY, firstName TEXT, lastName TEXT, fieldMode INTEGER);
    CREATE TABLE creatorTypes (creatorTypeID INTEGER PRIMARY KEY, creatorType TEXT);
    CREATE TABLE itemCreators (itemID INTEGER, creatorID INTEGER, creatorTypeID INTEGER, orderIndex INTEGER);
    CREATE TABLE tags (tagID INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE itemTags (itemID INTEGER, tagID INTEGER, type INTEGER);
    CREATE TABLE itemRelations (itemID INTEGER, predicateID INTEGER, object TEXT);
  `);

  db.run(`INSERT INTO fields (fieldID, fieldName) VALUES (1,'title'),(2,'abstractNote'),(3,'date');`);
  db.run(`INSERT INTO creatorTypes (creatorTypeID, creatorType) VALUES (1,'author');`);

  // paper item 10 (key ABCD1234), attachment item 11
  db.run(`INSERT INTO items (itemID, itemTypeID, key, dateAdded) VALUES (10, 4, 'ABCD1234', '2026-07-02 00:00:00');`);
  db.run(`INSERT INTO items (itemID, itemTypeID, key, dateAdded) VALUES (11, 14, 'ATTACH001', '2026-07-02 00:00:00');`);
  db.run(`INSERT INTO itemAttachments (itemID, parentItemID, contentType, path) VALUES (11, 10, 'application/pdf', 'storage:paper.pdf');`);

  db.run(`INSERT INTO itemDataValues (valueID, value) VALUES
    (100,'Attention Is All You Need'),(101,'We propose the Transformer, a model architecture...'),(102,'2017');`);
  db.run(`INSERT INTO itemData (itemID, fieldID, valueID) VALUES (10,1,100),(10,2,101),(10,3,102);`);

  db.run(`INSERT INTO creators (creatorID, firstName, lastName, fieldMode) VALUES (200,'Ashish','Vaswani',0),(201,'Noam','Shazeer',0);`);
  db.run(`INSERT INTO itemCreators (itemID, creatorID, creatorTypeID, orderIndex) VALUES (10,200,1,0),(10,201,1,1);`);

  db.run(`INSERT INTO tags (tagID, name) VALUES (300,'theme/attention'),(301,'nlp');`);
  db.run(`INSERT INTO itemTags (itemID, tagID, type) VALUES (10,300,0),(10,301,0);`);

  // annotations are child items 12 & 13; their keys become highlight block ids later
  db.run(`INSERT INTO items (itemID, itemTypeID, key, dateAdded) VALUES (12, 15, 'ANNOAB12', '2026-07-03 00:00:00'),(13, 15, 'ANNOCD34', '2026-07-03 00:00:00');`);
  db.run(`INSERT INTO itemAnnotations (itemID, parentItemID, type, text, comment, color, pageLabel, sortIndex) VALUES
    (12, 11, 1, 'The Transformer allows for more parallelization', 'compare to [[recurrence]]', '#ffd400', '3', '00003|000100|00010'),
    (13, 11, 1, 'self-attention', 'key mechanism', '#a28ae5', '2', '00002|000050|00005');`);

  const data = db.export();
  writeFileSync(path, Buffer.from(data));
  db.close();
}
```

- [ ] **Step 2: Write the failing snapshot test**

```ts
// tests/db/snapshot.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFixtureDb } from "../fixtures/build-fixture";
import { openSnapshot } from "../../src/db/snapshot";

let dir: string;
let dbPath: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "obzo-snap-"));
  dbPath = join(dir, "zotero.sqlite");
  await buildFixtureDb(dbPath);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("openSnapshot", () => {
  it("opens a copied DB and can query it", async () => {
    const handle = await openSnapshot(dbPath);
    const res = handle.db.exec("SELECT COUNT(*) AS n FROM items");
    expect(res[0].values[0][0]).toBe(4); // paper + attachment + 2 annotations
    handle.close();
  });

  it("throws a clear error when the DB is missing", async () => {
    await expect(openSnapshot(join(dir, "nope.sqlite"))).rejects.toThrow(/not found/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/db/snapshot.test.ts`
Expected: FAIL — cannot find module `../../src/db/snapshot`.

- [ ] **Step 4: Write `src/db/snapshot.ts`**

```ts
import initSqlJs, { type Database } from "sql.js";
import { copyFileSync, existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface SnapshotHandle {
  db: Database;
  close(): void;
}

export async function openSnapshot(dbPath: string): Promise<SnapshotHandle> {
  if (!existsSync(dbPath)) {
    throw new Error(`OBzO: Zotero database not found at ${dbPath}`);
  }

  const tempDir = mkdtempSync(join(tmpdir(), "obzo-db-"));
  const tempCopy = join(tempDir, "snapshot.sqlite");
  copyFileSync(dbPath, tempCopy);

  const SQL = await initSqlJs();
  const bytes = readFileSync(tempCopy);
  const db = new SQL.Database(bytes);

  return {
    db,
    close() {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/db/snapshot.test.ts`
Expected: PASS (2 passed).

- [ ] **Step 6: Commit**

```bash
git add src/db/snapshot.ts tests/fixtures/build-fixture.ts tests/db/snapshot.test.ts
git commit -m "feat: DB snapshot reader (copy + sql.js) with fixture builder"
```

---

### Task 4: Queries — read snapshot into the domain model

**Files:**
- Create: `src/db/queries.ts`
- Test: `tests/db/queries.test.ts`

**Interfaces:**
- Consumes: `SnapshotHandle` from Task 3; `Annotation`, `Collection`, `Creator`, `ZoteroItem`, `ZoteroLibrary` from Task 2.
- Produces:
  - `readLibrary(handle: SnapshotHandle): ZoteroLibrary` — returns all collections + all regular items (excluding attachment and annotation items) fully hydrated with title, abstract, year, creators, tags, annotations, collectionIds, relatedKeys.
  - `rows(db: Database, sql: string): Record<string, unknown>[]` (exported) — runs a query, returns objects keyed by column name.
  - Annotation→paper mapping: `itemAnnotations.parentItemID` → attachment item → attachment's `parentItemID` → paper item; the annotation attaches to the paper whose `itemID` matches, and carries the annotation item's `key`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/db/queries.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFixtureDb } from "../fixtures/build-fixture";
import { openSnapshot, type SnapshotHandle } from "../../src/db/snapshot";
import { readLibrary } from "../../src/db/queries";

let dir: string;
let handle: SnapshotHandle;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "obzo-q-"));
  const dbPath = join(dir, "zotero.sqlite");
  await buildFixtureDb(dbPath);
  handle = await openSnapshot(dbPath);
});

afterAll(() => {
  handle.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("readLibrary", () => {
  it("hydrates the paper with title, abstract, year, creators, tags", () => {
    const lib = readLibrary(handle);
    const paper = lib.items.find((i) => i.key === "ABCD1234");
    expect(paper).toBeDefined();
    expect(paper!.title).toBe("Attention Is All You Need");
    expect(paper!.abstract).toMatch(/Transformer/);
    expect(paper!.year).toBe("2017");
    expect(paper!.creators.map((c) => c.lastName)).toEqual(["Vaswani", "Shazeer"]);
    expect(paper!.tags).toContain("theme/attention");
  });

  it("maps annotations through attachment to the paper, ordered by sortIndex", () => {
    const lib = readLibrary(handle);
    const paper = lib.items.find((i) => i.key === "ABCD1234")!;
    expect(paper.annotations).toHaveLength(2);
    expect(paper.annotations[0].sortIndex < paper.annotations[1].sortIndex).toBe(true);
    const cd34 = paper.annotations.find((a) => a.key === "ANNOCD34")!;
    expect(cd34.color).toBe("#a28ae5");
    expect(cd34.comment).toBe("key mechanism");
  });

  it("excludes attachment and annotation items from the item list", () => {
    const lib = readLibrary(handle);
    expect(lib.items.map((i) => i.key)).toEqual(["ABCD1234"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db/queries.test.ts`
Expected: FAIL — cannot find module `../../src/db/queries`.

- [ ] **Step 3: Write `src/db/queries.ts`**

```ts
import type { Database } from "sql.js";
import type { SnapshotHandle } from "./snapshot";
import type { Annotation, Collection, Creator, ZoteroItem, ZoteroLibrary } from "../model/types";

// Identify attachments/annotations structurally via their tables rather than by
// hardcoded itemTypeID (type ids vary per Zotero install).
export function rows(db: Database, sql: string): Record<string, unknown>[] {
  const res = db.exec(sql);
  if (res.length === 0) return [];
  const { columns, values } = res[0];
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => (obj[col] = row[i]));
    return obj;
  });
}

export function readLibrary(handle: SnapshotHandle): ZoteroLibrary {
  const db = handle.db;

  const collections: Collection[] = rows(
    db,
    `SELECT collectionID AS id, collectionName AS name, parentCollectionID AS parentId FROM collections`
  ).map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    parentId: r.parentId == null ? null : Number(r.parentId),
  }));

  const attachmentIds = new Set(rows(db, `SELECT itemID FROM itemAttachments`).map((r) => Number(r.itemID)));
  const annotationItemIds = new Set(rows(db, `SELECT itemID FROM itemAnnotations`).map((r) => Number(r.itemID)));

  const fieldId = (name: string): number => {
    const r = rows(db, `SELECT fieldID FROM fields WHERE fieldName = '${name}' LIMIT 1`);
    return r.length ? Number(r[0].fieldID) : -1;
  };
  const titleField = fieldId("title");
  const abstractField = fieldId("abstractNote");
  const dateField = fieldId("date");

  const itemRows = rows(db, `SELECT itemID, key, dateAdded FROM items`).filter(
    (r) => !attachmentIds.has(Number(r.itemID)) && !annotationItemIds.has(Number(r.itemID))
  );

  const items: ZoteroItem[] = itemRows.map((r) => {
    const itemID = Number(r.itemID);
    return {
      key: String(r.key),
      title: dataValue(db, itemID, titleField) ?? "(untitled)",
      abstract: dataValue(db, itemID, abstractField),
      year: extractYear(dataValue(db, itemID, dateField)),
      dateAdded: String(r.dateAdded),
      creators: creatorsFor(db, itemID),
      tags: tagsFor(db, itemID),
      annotations: annotationsForPaper(db, itemID),
      collectionIds: collectionIdsFor(db, itemID),
      relatedKeys: relatedKeysFor(db, itemID),
    };
  });

  return { collections, items };
}

function dataValue(db: Database, itemID: number, fieldID: number): string | null {
  if (fieldID < 0) return null;
  const r = rows(
    db,
    `SELECT v.value AS value FROM itemData d JOIN itemDataValues v ON v.valueID = d.valueID
     WHERE d.itemID = ${itemID} AND d.fieldID = ${fieldID} LIMIT 1`
  );
  return r.length ? String(r[0].value) : null;
}

function extractYear(date: string | null): string | null {
  if (!date) return null;
  const m = date.match(/\d{4}/);
  return m ? m[0] : null;
}

function creatorsFor(db: Database, itemID: number): Creator[] {
  return rows(
    db,
    `SELECT c.firstName AS firstName, c.lastName AS lastName
     FROM itemCreators ic JOIN creators c ON c.creatorID = ic.creatorID
     WHERE ic.itemID = ${itemID} ORDER BY ic.orderIndex`
  ).map((r) => ({
    firstName: r.firstName == null ? null : String(r.firstName),
    lastName: String(r.lastName ?? ""),
  }));
}

function tagsFor(db: Database, itemID: number): string[] {
  return rows(
    db,
    `SELECT t.name AS name FROM itemTags it JOIN tags t ON t.tagID = it.tagID WHERE it.itemID = ${itemID}`
  ).map((r) => String(r.name));
}

function collectionIdsFor(db: Database, itemID: number): number[] {
  return rows(db, `SELECT collectionID FROM collectionItems WHERE itemID = ${itemID}`).map((r) =>
    Number(r.collectionID)
  );
}

function relatedKeysFor(db: Database, itemID: number): string[] {
  return rows(db, `SELECT object FROM itemRelations WHERE itemID = ${itemID}`)
    .map((r) => String(r.object).split("/").pop() ?? "")
    .filter((k) => k.length > 0);
}

function annotationsForPaper(db: Database, paperItemID: number): Annotation[] {
  return rows(
    db,
    `SELECT ann.text AS text, ann.comment AS comment, ann.color AS color,
            ann.pageLabel AS pageLabel, ann.sortIndex AS sortIndex, i.key AS key
     FROM itemAnnotations ann
     JOIN itemAttachments att ON att.itemID = ann.parentItemID
     JOIN items i ON i.itemID = ann.itemID
     WHERE att.parentItemID = ${paperItemID}
     ORDER BY ann.sortIndex`
  ).map((r) => ({
    key: String(r.key),
    text: r.text == null ? null : String(r.text),
    comment: r.comment == null ? null : String(r.comment),
    color: String(r.color ?? ""),
    pageLabel: r.pageLabel == null ? null : String(r.pageLabel),
    sortIndex: String(r.sortIndex ?? ""),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/db/queries.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/db/queries.ts tests/db/queries.test.ts
git commit -m "feat: read Zotero snapshot into typed domain model"
```

---

### Task 5: Sync orchestrator skeleton + wire the command

**Files:**
- Create: `src/sync.ts`
- Create: `src/settings.ts`
- Modify: `src/main.ts` (replace whole file)
- Test: `tests/sync.test.ts`

**Interfaces:**
- Consumes: `openSnapshot` (Task 3), `readLibrary` (Task 4), `ZoteroLibrary` (Task 2).
- Produces:
  - `interface ObzoSettings { dbPath: string; vaultSubfolder: string; }` and `DEFAULT_SETTINGS` (`dbPath: ""`, `vaultSubfolder: "zotero"`).
  - `interface SyncSummary { collections: number; items: number; annotations: number; }`.
  - `syncFromDb(dbPath: string): Promise<SyncSummary>` — opens the snapshot, reads the library, counts, closes the handle in `finally`, returns the summary. This is the pure/testable core (no Obsidian `App`).
  - `main.ts` gains `runSync(app, settings)` wired to the `obzo-sync` command. (Writing notes to the vault is a later plan.)

- [ ] **Step 1: Write the failing test (pure core)**

```ts
// tests/sync.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFixtureDb } from "./fixtures/build-fixture";
import { syncFromDb } from "../src/sync";

let dir: string;
let dbPath: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "obzo-sync-"));
  dbPath = join(dir, "zotero.sqlite");
  await buildFixtureDb(dbPath);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("syncFromDb", () => {
  it("summarizes the library read from the snapshot", async () => {
    const summary = await syncFromDb(dbPath);
    expect(summary.items).toBe(1);
    expect(summary.annotations).toBe(2);
    expect(summary.collections).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sync.test.ts`
Expected: FAIL — cannot find module `../src/sync`.

- [ ] **Step 3: Write `src/settings.ts`**

```ts
export interface ObzoSettings {
  dbPath: string;
  vaultSubfolder: string;
}

export const DEFAULT_SETTINGS: ObzoSettings = {
  dbPath: "",
  vaultSubfolder: "zotero",
};
```

- [ ] **Step 4: Write `src/sync.ts`**

```ts
import { openSnapshot } from "./db/snapshot";
import { readLibrary } from "./db/queries";

export interface SyncSummary {
  collections: number;
  items: number;
  annotations: number;
}

export async function syncFromDb(dbPath: string): Promise<SyncSummary> {
  const handle = await openSnapshot(dbPath);
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/sync.test.ts`
Expected: PASS (1 passed).

- [ ] **Step 6: Replace `src/main.ts` to wire the command**

```ts
import { App, Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type ObzoSettings } from "./settings";
import { syncFromDb } from "./sync";

async function runSync(_app: App, settings: ObzoSettings): Promise<void> {
  if (!settings.dbPath) {
    new Notice("OBzO: set your zotero.sqlite path in settings first.");
    return;
  }
  try {
    const s = await syncFromDb(settings.dbPath);
    new Notice(`OBzO: read ${s.items} papers, ${s.annotations} highlights, ${s.collections} collections.`);
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
      callback: () => runSync(this.app, this.settings),
    });
  }
}
```

- [ ] **Step 7: Run full suite + typecheck + build**

Run:
```bash
npm test
npm run typecheck
npm run build
```
Expected: all tests pass; `typecheck` exits 0; `main.js` emitted.

- [ ] **Step 8: Commit**

```bash
git add src/sync.ts src/settings.ts src/main.ts tests/sync.test.ts
git commit -m "feat: sync orchestrator skeleton wired to OBzO command"
```

---

## Done criteria for this plan

- `npm run build` produces a loadable `main.js`; the `OBzO: Sync from Zotero` command runs and reports counts via a Notice.
- `npm test` is green: collection tree, snapshot open/error, query hydration + annotation mapping, sync summary.
- The read path (`zotero.sqlite` → snapshot → `sql.js` → `ZoteroLibrary`) is complete and typed.

## Not in this plan (later plans, per SPEC §12 build order)

Paper-note render (colors, block IDs, deep links, frontmatter) · folder placement + user-zone merge · settings UI · generated stubs (authors/themes/glossary) · Dashboard/Dataview · related-papers + status field · integration test with a hand-edited note surviving re-sync.
