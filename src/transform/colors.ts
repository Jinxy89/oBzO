import type { Annotation } from "../model/types";
import type { ColorRule } from "../model/color";
import type { HighlightGroup } from "./types";

const norm = (hex: string): string => hex.trim().toLowerCase();

export function groupByColor(
  annotations: Annotation[],
  colorMap: ColorRule[],
  unsortedLabel: string
): HighlightGroup[] {
  const groups: HighlightGroup[] = [];
  const claimed = new Set<Annotation>();
  const seenLabels = new Set<string>();

  for (const rule of colorMap) {
    if (seenLabels.has(rule.label)) continue;
    seenLabels.add(rule.label);
    const colorsForLabel = new Set(
      colorMap.filter((r) => r.label === rule.label).map((r) => norm(r.color))
    );
    const matched = annotations.filter((a) => colorsForLabel.has(norm(a.color)));
    if (matched.length === 0) continue;
    matched.forEach((a) => claimed.add(a));
    groups.push({ label: rule.label, role: rule.role, annotations: matched });
  }

  const unsorted = annotations.filter((a) => !claimed.has(a));
  if (unsorted.length > 0) {
    groups.push({ label: unsortedLabel, role: "unsorted", annotations: unsorted });
  }

  return groups;
}
