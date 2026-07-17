import type { Annotation, ZoteroItem } from "../model/types";

export function annotationDeepLink(annotation: Annotation): string {
  const base = `zotero://open-pdf/library/items/${annotation.attachmentKey}`;
  const params = [`annotation=${annotation.key}`];
  if (annotation.pageLabel) {
    params.push(`page=${encodeURIComponent(annotation.pageLabel)}`);
  }
  return `${base}?${params.join("&")}`;
}

export function itemSelectLink(item: ZoteroItem): string {
  return `zotero://select/library/items/${item.key}`;
}
