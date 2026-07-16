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
