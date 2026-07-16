import initSqlJs, { type Database } from "sql.js";
import { copyFileSync, existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface SnapshotHandle {
  db: Database;
  close(): void;
}

export async function openSnapshot(dbPath: string): Promise<SnapshotHandle> {
  if (!existsSync(dbPath)) {
    throw new Error(`OBzO: Zotero database not found at ${dbPath}`);
  }

  const tempDir = mkdtempSync(join(tmpdir(), "obzo-db-"));
  const tempCopy = join(tempDir, "snapshot.sqlite");
  copyFileSync(dbPath, tempCopy);

  const SQL = await initSqlJs();
  const bytes = readFileSync(tempCopy);
  const db = new SQL.Database(bytes);

  return {
    db,
    close() {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}
