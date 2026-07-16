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

  it("maps collections and the paper's collection membership", () => {
    const lib = readLibrary(handle);
    expect(lib.collections).toHaveLength(2);
    const ai = lib.collections.find((c) => c.name === "AI")!;
    const tr = lib.collections.find((c) => c.name === "Transformers")!;
    expect(ai.parentId).toBeNull();
    expect(tr.parentId).toBe(ai.id);
    const paper = lib.items.find((i) => i.key === "ABCD1234")!;
    expect(paper.collectionIds).toContain(2);
  });
});
