import type { Creator, ZoteroItem } from "../model/types";
import type { RenderContext } from "./types";
import { itemSelectLink } from "./deepLinks";

const flowList = (values: string[]): string =>
  `[${values.map((v) => JSON.stringify(v)).join(", ")}]`;

const authorName = (c: Creator): string => c.lastName || c.firstName || "";

export function renderFrontmatter(
  item: ZoteroItem,
  ctx: RenderContext,
  colorLabels: string[]
): string {
  const lines: string[] = ["---"];
  lines.push(`zotero-key: ${item.key}`);
  lines.push(`title: ${JSON.stringify(item.title)}`);
  lines.push(`authors: ${flowList(item.creators.map((c) => `[[${authorName(c)}]]`))}`);

  if (item.year) lines.push(`year: ${item.year}`);

  const collections = item.collectionIds
    .map((id) => ctx.collectionNameById.get(id))
    .filter((name): name is string => Boolean(name));
  if (collections.length) lines.push(`collections: ${flowList(collections)}`);

  const themes = item.tags.filter((t) => t.startsWith(ctx.themePrefix));
  if (themes.length) lines.push(`themes: ${flowList(themes)}`);

  if (colorLabels.length) lines.push(`colors: ${flowList(colorLabels)}`);

  if (item.relatedKeys.length) {
    const related = item.relatedKeys.map((k) => `[[${ctx.titleByKey.get(k) ?? k}]]`);
    lines.push(`related: ${flowList(related)}`);
  }

  lines.push(`date-added: ${item.dateAdded.split(" ")[0]}`);
  lines.push(`status: ${ctx.existingStatus ?? "unread"}`);
  lines.push(`zotero-link: ${JSON.stringify(itemSelectLink(item))}`);
  lines.push("---");

  return lines.join("\n") + "\n";
}
