import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFixtureDb } from "../fixtures/build-fixture";
import { openSnapshot } from "../../src/db/snapshot";

let dir: string;
let dbPath: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "obzo-snap-"));
  dbPath = join(dir, "zotero.sqlite");
  await buildFixtureDb(dbPath);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("openSnapshot", () => {
  it("opens a copied DB and can query it", async () => {
    const handle = await openSnapshot(dbPath);
    const res = handle.db.exec("SELECT COUNT(*) AS n FROM items");
    expect(res[0].values[0][0]).toBe(4); // paper + attachment + 2 annotations
    handle.close();
  });

  it("throws a clear error when the DB is missing", async () => {
    await expect(openSnapshot(join(dir, "nope.sqlite"))).rejects.toThrow(/not found/);
  });
});
