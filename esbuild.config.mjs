import esbuild from "esbuild";
import builtins from "builtin-modules";
import { copyFileSync } from "node:fs";

const production = process.argv[2] === "production";

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", ...builtins],
  format: "cjs",
  target: "es2022",
  platform: "node",
  sourcemap: production ? false : "inline",
  minify: production,
  outfile: "main.js",
  logLevel: "info",
});

copyFileSync("node_modules/sql.js/dist/sql-wasm.wasm", "sql-wasm.wasm");

if (production) {
  await ctx.rebuild();
  await ctx.dispose();
} else {
  await ctx.watch();
}
