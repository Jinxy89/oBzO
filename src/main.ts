import { App, Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type ObzoSettings } from "./settings";
import { syncFromDb } from "./sync";

async function runSync(_app: App, settings: ObzoSettings): Promise<void> {
  if (!settings.dbPath) {
    new Notice("OBzO: set your zotero.sqlite path in settings first.");
    return;
  }
  try {
    const s = await syncFromDb(settings.dbPath);
    new Notice(`OBzO: read ${s.items} papers, ${s.annotations} highlights, ${s.collections} collections.`);
  } catch (e) {
    new Notice(`OBzO: sync failed — ${(e as Error).message}`);
  }
}

export default class ObzoPlugin extends Plugin {
  settings: ObzoSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.addCommand({
      id: "obzo-sync",
      name: "OBzO: Sync from Zotero",
      callback: () => runSync(this.app, this.settings),
    });
  }
}
