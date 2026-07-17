import { App, FileSystemAdapter, Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type ObzoSettings } from "./settings";
import { syncToVault } from "./sync";
import { ObsidianVault } from "./write/obsidianVault";

async function runSync(app: App, settings: ObzoSettings, pluginDir: string): Promise<void> {
  if (!settings.dbPath) {
    new Notice("OBzO: set your zotero.sqlite path in settings first.");
    return;
  }
  try {
    const locateFile = (file: string) => `${pluginDir}/${file}`;
    const adapter = new ObsidianVault(app, settings.vaultSubfolder);
    const s = await syncToVault(settings.dbPath, settings, adapter, { locateFile });
    new Notice(
      `OBzO: ${s.items} papers — ${s.created} created, ${s.updated} updated, ${s.moved} moved.`
    );
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
      callback: () => {
        const adapter = this.app.vault.adapter;
        const base = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : "";
        const pluginDir = this.manifest.dir ? `${base}/${this.manifest.dir}` : base;
        return runSync(this.app, this.settings, pluginDir);
      },
    });
  }
}
