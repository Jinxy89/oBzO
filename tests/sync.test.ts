import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFixtureDb } from "./fixtures/build-fixture";
import { syncFromDb } from "../src/sync";

let dir: string;
let dbPath: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "obzo-sync-"));
  dbPath = join(dir, "zotero.sqlite");
  await buildFixtureDb(dbPath);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("syncFromDb", () => {
  it("summarizes the library read from the snapshot", async () => {
    const summary = await syncFromDb(dbPath);
    expect(summary.items).toBe(1);
    expect(summary.annotations).toBe(2);
    expect(summary.collections).toBe(2); // fixture seeds AI + Transformers
  });
});
