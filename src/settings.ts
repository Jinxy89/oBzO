import type { ColorRule } from "./model/color";

export interface ObzoSettings {
  dbPath: string;
  vaultSubfolder: string;
  colorMap: ColorRule[];
  themePrefix: string;
  unsortedLabel: string;
}

export const DEFAULT_SETTINGS: ObzoSettings = {
  dbPath: "",
  vaultSubfolder: "zotero",
  colorMap: [],
  themePrefix: "theme/",
  unsortedLabel: "Unsorted highlights",
};
