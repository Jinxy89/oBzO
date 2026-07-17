import type { VaultAdapter } from "../../src/write/writeNotes";

export class InMemoryVault implements VaultAdapter {
  files: Map<string, string>;

  constructor(seed: Record<string, string> = {}) {
    this.files = new Map(Object.entries(seed));
  }

  async listMarkdown(): Promise<Array<{ path: string; content: string }>> {
    return [...this.files.entries()]
      .filter(([path]) => path.endsWith(".md"))
      .map(([path, content]) => ({ path, content }));
  }

  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }
}
