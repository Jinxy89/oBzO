import { openSnapshot, type SnapshotOptions } from "./db/snapshot";
import { readLibrary } from "./db/queries";

export interface SyncSummary {
  collections: number;
  items: number;
  annotations: number;
}

export async function syncFromDb(dbPath: string, options?: SnapshotOptions): Promise<SyncSummary> {
  const handle = await openSnapshot(dbPath, options);
  try {
    const lib = readLibrary(handle);
    const annotations = lib.items.reduce((sum, i) => sum + i.annotations.length, 0);
    return {
      collections: lib.collections.length,
      items: lib.items.length,
      annotations,
    };
  } finally {
    handle.close();
  }
}
