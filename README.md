<h1 align="center">
  📚 OBzO &nbsp;·&nbsp; <sub>Obsidian&nbsp;⇄&nbsp;Zotero Knowledge Sync</sub>
</h1>

<p align="center">
  <i>Turn your Zotero highlights into a linked, reviewable Obsidian knowledge base —<br/>deterministically, and <b>without a single line of AI</b>.</i>
</p>

<p align="center">
  <a href="#-license"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" /></a>
  <img alt="Version" src="https://img.shields.io/badge/version-0.0.1-blue.svg?cacheSeconds=2592000" />
  <img alt="Platform: Desktop only" src="https://img.shields.io/badge/platform-desktop--only-6c5ce7.svg" />
  <img alt="Obsidian 1.7.2+" src="https://img.shields.io/badge/Obsidian-%E2%89%A5%201.7.2-7c3aed.svg?logo=obsidian&logoColor=white" />
  <img alt="No AI" src="https://img.shields.io/badge/AI-none%20by%20design-1a1a1a.svg" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-41%20passing-brightgreen.svg" />
  <img alt="Maintained" src="https://img.shields.io/badge/maintained-yes-brightgreen.svg" />
</p>

<p align="center">
  <b><a href="./SPEC.md">📖 Design Spec</a></b> ·
  <b><a href="./PROGRESS.md">📊 Progress Log</a></b> ·
  <b><a href="https://github.com/Jinxy89/oBzO/issues">🐞 Issues</a></b>
</p>

---

> **OBzO** ("Obsidian‑Zotero") is a desktop‑only Obsidian plugin that reads a **read‑only snapshot**
> of your Zotero library and mirrors it into a folder of linked literature notes: highlights grouped
> by color, Zotero comments inline, deep links back to the exact PDF annotation, and a protected zone
> where **your own writing is never touched**. One command. One direction (Zotero → Obsidian).
> Everything is deterministic — derived from Zotero data plus Obsidian's native linking.

## Table of Contents

- [✨ Why OBzO](#-why-obzo)
- [🧩 Features](#-features)
- [🏗️ How it works](#️-how-it-works)
- [📝 What a synced note looks like](#-what-a-synced-note-looks-like)
- [🎨 Color roles](#-color-roles)
- [🛡️ Safety guarantees](#️-safety-guarantees)
- [🚀 Getting started](#-getting-started)
- [🧪 Run tests](#-run-tests)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)
- [👤 Author](#-author)
- [⭐ Show your support](#-show-your-support)
- [📝 License](#-license)

## ✨ Why OBzO

You highlight in Zotero. You think in Obsidian. The gap between them is usually a mess of copy‑paste,
brittle exporters, or an AI black box you can't audit.

OBzO closes that gap with **plumbing, not magic**:

- 🔒 **Reads a copy, never the live DB.** Zotero locks `zotero.sqlite`; OBzO copies it to a temp file
  and opens the copy — sync works while Zotero is open, and it *cannot* corrupt your library.
- 🧠 **No AI, ever.** Every output is a pure function of your Zotero data. Reproducible, reviewable,
  offline, private.
- 🪪 **Stable identity.** Notes are keyed by the Zotero item key, so renaming or re‑filing a paper
  updates the *same* note instead of orphaning it.
- ✍️ **Your writing is sacred.** Only the region above `<!-- obzo:end -->` is regenerated. Your
  `## My Notes`, your `status`, your glossary definitions — untouched, every sync.

## 🧩 Features

| | Feature | What it does |
|---|---|---|
| 🗂️ | **Collection‑tree mirroring** | Your Zotero folder hierarchy becomes a `zotero/` note tree; unfiled items land in `_Unfiled/`. |
| 🖍️ | **Color‑grouped highlights** | Highlights are grouped under headings you define, one per Zotero highlight color. Unmapped colors fall into a catch‑all. |
| 💬 | **Inline Zotero comments** | Each highlight carries its Zotero comment (`↳`), and `[[wikilinks]]` typed in Zotero pass through as real Obsidian links. |
| 🔗 | **PDF deep links** | Every highlight links back (`zotero://open-pdf…`) to the exact annotation in Zotero. |
| 🧷 | **Stable block IDs** | Deterministic `^h-XXXX` anchors let you embed any highlight anywhere: `![[Paper#^h-AB12]]`. |
| 🪪 | **Identity by key** | Move or re‑title a paper in Zotero and the same note updates — no duplicates, no orphans. |
| 🛟 | **Protected user zone** | Content below the sync marker is never regenerated. `status` is written once, then it's yours. |
| 📊 | **Dataview‑ready frontmatter** | `colors`, `themes`, `authors`, `date-added`, `status`, `related` — ready for dashboards and review queues. |

> 🔭 **Planned** (see the [Roadmap](#️-roadmap)): a settings UI, auto‑generated author / theme / glossary
> stubs, and a Dataview `_Dashboard.md`.

## 🏗️ How it works

A strict **pure‑core / IO‑shell** pipeline. Only the reader and the vault writer touch the outside
world; everything in between is a pure, unit‑tested transformation.

```text
 zotero.sqlite  (locked by Zotero)
        │  copy → temp snapshot (read‑only)
        ▼
 ┌──────────────┐   sql.js (pure‑WASM SQLite)   ← no native modules; bundles clean
 │  db/         │   collections · items · annotations · creators · tags · relations
 ├──────────────┤
 │  model/      │   typed domain objects + collection tree
 ├──────────────┤
 │  transform/  │   color grouping · block IDs · deep links · frontmatter · markdown  (PURE)
 ├──────────────┤
 │  write/      │   folder placement · user‑zone splice · move‑by‑key                 (PURE core)
 └──────────────┘
        ▼
 <vault>/zotero/**   ← literature notes on disk
```

Command palette entry: **`OBzO: Sync from Zotero`**.

## 📝 What a synced note looks like

```markdown
---
zotero-key: ABCD1234
title: "Attention Is All You Need"
authors: ["[[Vaswani]]", "[[Shazeer]]"]
year: 2017
collections: [AI, Transformers]
colors: [key, method, term]
related: ["[[BERT]]"]
date-added: 2026-07-02
status: unread                     # written once — then it's yours
zotero-link: "zotero://select/library/items/ABCD1234"
---
## Abstract
<synced abstract>

## 🟡 Key argument
> highlighted sentence (p.3) [🔗](zotero://open-pdf/…?page=3&annotation=…) ^h-AB12
  ↳ compare to [[recurrence]]      # your Zotero comment; wikilink passes through

## 🟣 Terms
> eigenvector (p.2) [🔗](…) ^h-EF56   → [[eigenvector]]
<!-- obzo:end -->
## My Notes
everything below this line is yours — OBzO never overwrites it.
```

## 🎨 Color roles

The color map is **entirely yours** — no opinionated defaults are shipped. Each Zotero highlight
color maps to a label *and* a role:

| Field | Meaning |
|-------|---------|
| **color** | Zotero highlight color (hex) |
| **label** | Section heading, e.g. `Key argument` |
| **role**  | `section` (group highlights under the label) · `term` (also spawn a `glossary/<phrase>.md`) |

Unmapped colors collect under an **"Unsorted highlights"** catch‑all.

## 🛡️ Safety guarantees

- **Never writes to Zotero.** Reads a temp copy of the SQLite file; the live library is untouched.
- **Never destroys your writing.** Only content through `<!-- obzo:end -->` is regenerated.
- **Never orphans a note.** Identity is the Zotero item key, so moves and renames re‑target the same
  file — and a two‑pass writer guarantees no note is ever dropped or duplicated on a title collision.
- **Never deletes vanished items.** A paper removed from Zotero leaves its note in place.

## 🚀 Getting started

> ⚠️ **Status: early / in active development (v0.0.1).** The read → render → write core is built and
> tested; it is **not yet in the Obsidian community store**. Install it as a local/dev plugin.

### Prerequisites

- 🖥️ **Obsidian ≥ 1.7.2**, desktop (Electron) — mobile is unsupported by design.
- 📗 **Zotero** with a local `zotero.sqlite`.
- 🟢 **Node.js ≥ 18** and npm (to build from source).

### Install (from source)

```sh
git clone https://github.com/Jinxy89/oBzO.git
cd oBzO
npm install
npm run build      # emits main.js + sql-wasm.wasm
```

Then link it into a vault as a local plugin:

```sh
# from the repo root, replace <VAULT> with your vault path
mkdir -p "<VAULT>/.obsidian/plugins/obzo"
cp main.js manifest.json sql-wasm.wasm "<VAULT>/.obsidian/plugins/obzo/"
```

Enable **OBzO — Zotero Sync** in *Settings → Community plugins*.

### Usage

1. Open the command palette (`Cmd/Ctrl‑P`).
2. Run **`OBzO: Sync from Zotero`**.
3. Point it at your `zotero.sqlite` when prompted (a Notice reports how many notes were
   created / updated / moved).

For live development instead of a one‑off build:

```sh
npm run dev        # esbuild watch mode
```

## 🧪 Run tests

```sh
npm test           # vitest run — the full unit suite
npm run test:watch # watch mode
npm run typecheck  # tsc --noEmit
```

The core (`db`, `model`, `transform`, `write`) is pure and unit‑tested; the thin Obsidian/`fs`
adapters are controller‑verified because the Obsidian API isn't available under Vitest.

## 🗺️ Roadmap

Built with **spec‑first, test‑driven, reviewed** slices. Live status lives in
[`PROGRESS.md`](./PROGRESS.md).

| Slice | Status |
|-------|--------|
| Core sync & knowledge‑layer design (`SPEC.md`) | ✅ Settled |
| Foundation — DB snapshot · sql.js reader · queries · domain model | ✅ Done |
| Rendering — colors · block IDs · deep links · frontmatter · markdown | ✅ Done |
| Write / merge — folder placement · protected‑zone merge · vault writer · command wiring | ✅ Done |
| Settings UI (paths · color map · toggles) | ⬜ Planned |
| Generated stubs (authors · themes · glossary) | ⬜ Planned |
| `_Dashboard.md` (Dataview digest + review queue) | ⬜ Planned |
| End‑to‑end fixture integration test | ⬜ Planned |

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the
[issues page](https://github.com/Jinxy89/oBzO/issues).

1. Read [`SPEC.md`](./SPEC.md) — it's the source of truth for behavior.
2. Keep the **pure‑core / IO‑shell** split: transforms and merge logic import no `obsidian`/`node:fs`.
3. TDD — a failing test first, then the implementation. Run `npm test && npm run typecheck` before
   opening a PR.
4. **No AI/LLM features.** It's a hard design constraint, not a preference.

## 👤 Author

**jinxyw**

- GitHub: [@Jinxy89](https://github.com/Jinxy89)

## ⭐ Show your support

Give a ⭐️ if this project helped you bridge Zotero and Obsidian!

## 📝 License

Copyright © 2026 [Jinxy](https://github.com/Jinxy89).<br />
This project is [MIT](./LICENSE) licensed.

---

<p align="center"><sub>Structured after the conventions of <a href="https://github.com/kefranabg/readme-md-generator">readme-md-generator</a> — built with care, and zero AI in the product itself. 🐶</sub></p>
