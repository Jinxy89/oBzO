// tests/smoke.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("scaffold", () => {
  it("manifest declares desktop-only plugin with id obzo", () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.id).toBe("obzo");
    expect(manifest.isDesktopOnly).toBe(true);
  });
});
