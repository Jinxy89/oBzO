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

  it("does not drop a new paper that shares a title with an incumbent note", async () => {
    const plain = "zotero/_Unfiled/Attention Is All You Need.md";
    const seeded = `---\nzotero-key: BBBB2222\nstatus: unread\n---\nx\n${SYNC_END_MARKER}\n## My Notes\nincumbent\n`;
    const vault = new InMemoryVault({ [plain]: seeded });
    const aNew = item({ key: "AAAA1111", collectionIds: [] }); // new, sorts first
    const bOld = item({ key: "BBBB2222", collectionIds: [] }); // incumbent at plain path
    await writePaperNotes(lib([aNew, bOld]), DEFAULT_SETTINGS, vault);
    const contents = [...vault.files.values()].join("\n===\n");
    // both papers keep a file — neither silently dropped
    expect(vault.files.size).toBe(2);
    expect(contents).toContain("zotero-key: AAAA1111");
    expect(contents).toContain("zotero-key: BBBB2222");
    // the incumbent's protected zone survives
    expect(contents).toContain("## My Notes\nincumbent");
  });
});
