export type ColorRole = "section" | "term";

export interface ColorRule {
  color: string; // Zotero highlight color hex, e.g. "#ffd400"
  label: string; // section heading, e.g. "Key argument"
  role: ColorRole;
}
