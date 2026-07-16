export interface ObzoSettings {
  dbPath: string;
  vaultSubfolder: string;
}

export const DEFAULT_SETTINGS: ObzoSettings = {
  dbPath: "",
  vaultSubfolder: "zotero",
};
