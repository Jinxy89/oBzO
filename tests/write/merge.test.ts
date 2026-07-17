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
