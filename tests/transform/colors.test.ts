import { describe, it, expect } from "vitest";
import { groupByColor } from "../../src/transform/colors";
import type { Annotation } from "../../src/model/types";
import type { ColorRule } from "../../src/model/color";

const mk = (key: string, color: string): Annotation => ({
  key,
  attachmentKey: "ATTACH001",
  text: key,
  comment: null,
  color,
  pageLabel: "1",
  sortIndex: key,
});

const colorMap: ColorRule[] = [
  { color: "#ffd400", label: "Key argument", role: "section" },
  { color: "#a28ae5", label: "Terms", role: "term" },
];

describe("groupByColor", () => {
  it("groups mapped colors in color-map order and preserves annotation order", () => {
    const anns = [mk("a", "#FFD400"), mk("b", "#a28ae5"), mk("c", "#ffd400")];
    const groups = groupByColor(anns, colorMap, "Unsorted highlights");
    expect(groups.map((g) => g.label)).toEqual(["Key argument", "Terms"]);
    expect(groups[0].annotations.map((a) => a.key)).toEqual(["a", "c"]);
    expect(groups[1].role).toBe("term");
  });

  it("puts unmapped colors in a trailing catch-all group", () => {
    const anns = [mk("a", "#ffd400"), mk("z", "#00ff00")];
    const groups = groupByColor(anns, colorMap, "Unsorted highlights");
    expect(groups.map((g) => g.label)).toEqual(["Key argument", "Unsorted highlights"]);
    const catchAll = groups[groups.length - 1];
    expect(catchAll.role).toBe("unsorted");
    expect(catchAll.annotations.map((a) => a.key)).toEqual(["z"]);
  });

  it("omits groups that have no annotations", () => {
    const groups = groupByColor([mk("a", "#ffd400")], colorMap, "Unsorted highlights");
    expect(groups.map((g) => g.label)).toEqual(["Key argument"]);
  });
});
