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
