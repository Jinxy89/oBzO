import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { VaultAdapter } from "./writeNotes";

export class ObsidianVault implements VaultAdapter {
  constructor(
    private readonly app: App,
    private readonly root: string
  ) {}

  async listMarkdown(): Promise<Array<{ path: string; content: string }>> {
    const prefix = `${this.root}/`;
    const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(prefix));
    const out: Array<{ path: string; content: string }> = [];
    for (const file of files) {
      out.push({ path: file.path, content: await this.app.vault.cachedRead(file) });
    }
    return out;
  }

  async write(path: string, content: string): Promise<void> {
    const norm = normalizePath(path);
    const slash = norm.lastIndexOf("/");
    await this.ensureFolder(slash === -1 ? "" : norm.slice(0, slash));
    const existing = this.app.vault.getAbstractFileByPath(norm);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(norm, content);
    }
  }

  async remove(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (file instanceof TFile) {
      await this.app.fileManager.trashFile(file);
    }
  }

  private async ensureFolder(folder: string): Promise<void> {
    if (!folder) return;
    const parts = folder.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const at = this.app.vault.getAbstractFileByPath(current);
      if (at instanceof TFolder) continue;
      if (at == null) await this.app.vault.createFolder(current);
    }
  }
}
