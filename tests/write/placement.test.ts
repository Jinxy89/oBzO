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
