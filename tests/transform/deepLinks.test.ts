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
