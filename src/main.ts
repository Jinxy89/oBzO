import { Plugin, Notice } from "obsidian";

export default class ObzoPlugin extends Plugin {
  async onload(): Promise<void> {
    this.addCommand({
      id: "obzo-sync",
      name: "OBzO: Sync from Zotero",
      callback: async () => {
        // Task 5 replaces this body with runSync(this.app, this.settings).
        new Notice("OBzO: sync not yet wired.");
      },
    });
  }
}
