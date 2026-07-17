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
