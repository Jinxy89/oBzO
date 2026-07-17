import type { ZoteroItem, Annotation } from "../model/types";
import type { RenderContext, HighlightGroup } from "./types";
import { groupByColor } from "./colors";
import { renderFrontmatter } from "./frontmatter";
import { annotationDeepLink } from "./deepLinks";
import { highlightBlockId } from "./blockIds";

export const SYNC_END_MARKER = "<!-- obzo:end -->";

export function renderSyncedRegion(item: ZoteroItem, ctx: RenderContext): string {
  const groups = groupByColor(item.annotations, ctx.colorMap, ctx.unsortedLabel);
  const colorLabels = groups.filter((g) => g.role !== "unsorted").map((g) => g.label);

  const parts: string[] = [renderFrontmatter(item, ctx, colorLabels).trimEnd(), ""];

  if (item.abstract) {
    parts.push("## Abstract", item.abstract, "");
  }

  for (const group of groups) {
    parts.push(`## ${group.label}`);
    for (const ann of group.annotations) {
      parts.push(renderHighlight(ann, group));
    }
    parts.push("");
  }

  parts.push(SYNC_END_MARKER);
  return parts.join("\n") + "\n";
}

function renderHighlight(ann: Annotation, group: HighlightGroup): string {
  const page = ann.pageLabel ? ` (p.${ann.pageLabel})` : "";
  const text = ann.text ?? "";
  let line = `> ${text}${page} [🔗](${annotationDeepLink(ann)}) ^${highlightBlockId(ann)}`;
  if (group.role === "term") {
    line += ` → [[${text.trim()}]]`;
  }
  if (ann.comment) {
    line += `\n  ↳ ${ann.comment}`;
  }
  return line;
}
