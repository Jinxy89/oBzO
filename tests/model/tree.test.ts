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
