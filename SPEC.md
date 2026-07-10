# OBzO — Design Spec (v1)

**Obsidian ⇄ Zotero knowledge sync.** A desktop-only Obsidian plugin that reads your Zotero
library and writes a linked, reviewable knowledge base. One-way (Zotero → Obsidian). **No AI** —
every behavior is deterministic, derived from Zotero data plus Obsidian's native linking.

Status: design complete (2026-07-10). See `PROGRESS.md` for the decision history.

---

## 1. Goals

1. Mirror the Zotero collection tree into a `zotero/` folder of literature notes.
2. Sync highlights (grouped by user-defined color roles) and their Zotero comments.
3. Make highlights **linkable and reviewable elsewhere** without hunting back to the source.
4. Build a navigable web: glossary terms, authors, themes — all deterministic.
5. Never destroy the user's own writing.

### Non-goals (v1)
Background auto-watch · two-way sync · Zotero Web API · image/area annotations (text highlights
only) · mobile · any AI/LLM feature.

---

## 2. Architecture

Desktop-only Obsidian plugin (runs in Obsidian's Electron process). Command: **`OBzO: Sync from
Zotero`**.

```
zotero.sqlite (locked by Zotero)
        │  copy to temp snapshot (read-only)
        ▼
  sql.js (pure-WASM SQLite reader)      ← no native modules; bundles cleanly
        ▼
  Domain model  (collections tree, items, annotations, creators, tags, relations)
        ▼
  Transformers  (color grouping, block-id assignment, deep links, markdown render)
        ▼
  Note writer   (folder placement, user-zone splice, stub generation)
        ▼
  Obsidian vault/zotero/**
```

**Why a DB snapshot:** Zotero locks `zotero.sqlite` while running. The plugin copies it to a temp
file and opens the copy, so sync works while Zotero is open and never writes to Zotero's data.

### Modules (small, single-purpose files)
- `db/snapshot.ts` — copy the DB, open with sql.js, close/cleanup.
- `db/queries.ts` — read collections, items, itemData, annotations, creators, tags, relations.
- `model/` — typed domain objects (`ZoteroItem`, `Collection`, `Annotation`, `Creator`).
- `transform/highlights.ts` — group by color role, assign block IDs, build deep links.
- `transform/render.ts` — render a paper note's synced region as markdown.
- `write/placement.ts` — derive target folder path; handle moves/renames by item key.
- `write/merge.ts` — splice synced region above the marker; preserve everything below.
- `write/stubs.ts` — create/maintain author, theme, glossary stubs and the dashboard.
- `settings.ts` — settings model + UI.
- `sync.ts` — orchestrator.

---

## 3. Identity & safety

- **Identity:** the **Zotero item key** stored in frontmatter (`zotero-key`) is the stable ID.
  Re-titling or moving in Zotero updates the same file rather than orphaning it.
- **Protected user zone:** sync regenerates only the region **above** `<!-- obzo:end -->`.
  Everything below (e.g. `## My Notes`) is never touched. When a paper moves collections, the file
  moves and the user zone travels with it.
- **Stubs are protected too:** author/theme/glossary stubs are created once; user-written content in
  them is never overwritten (only the plugin-managed header region is refreshed).

---

## 4. Paper note format

Path: `zotero/<primary-collection-path>/<Title>.md`. Primary = first/deepest collection.
Items in no collection → `zotero/_Unfiled/`. All memberships are recorded in frontmatter.

```markdown
---
zotero-key: ABCD1234
title: "Attention Is All You Need"
authors: ["[[Vaswani]]", "[[Shazeer]]"]
year: 2017
collections: [AI, Transformers]
themes: [theme/attention, theme/nlp]
colors: [key, method, term]          # color-role labels present in this note
related: ["[[BERT]]"]                 # Zotero related items
date-added: 2026-07-02
status: unread                        # written once; user edits by hand
zotero-link: "zotero://select/library/items/ABCD1234"
---
## Abstract
<synced abstract>

## 🟡 Key argument
> highlighted sentence (p.3) [🔗](zotero://open-pdf/library/items/ABCD1234?page=3&annotation=...) ^h-AB12
  ↳ compare to [[recurrence]]        # Zotero comment; wikilinks pass through

## 🔵 Method
> another highlight (p.4) [🔗](...) ^h-CD34
  ↳ my comment

## 🟣 Terms
> eigenvector (p.2) [🔗](...) ^h-EF56   → [[eigenvector]]

## Unsorted highlights
> highlight with an unmapped color (p.9) [🔗](...) ^h-GH78
<!-- obzo:end -->
## My Notes
<freeform writing — never overwritten>
```

- **Block IDs** (`^h-XXXX`): deterministic from the Zotero annotation key, stable across syncs, so
  any highlight can be embedded/linked from anywhere.
- **Deep links** (`zotero://open-pdf...`): reopen Zotero at the exact annotation.
- **Wikilink pass-through:** `[[...]]` typed inside a Zotero comment renders as a real Obsidian link.
- Highlights ordered by PDF position (Zotero `sortIndex`).

---

## 5. Color roles

The color map (round 1) is user-defined and now carries a **role** per color:

| Field | Meaning |
|-------|---------|
| color | Zotero highlight color (hex) |
| label | Section heading, e.g. "Key argument" |
| role  | `section` (default) or `term` |

- `section` — group its highlights under the label.
- `term` — additionally create `glossary/<phrase>.md` for each highlight and link to it.

Unmapped colors → an **"Unsorted highlights"** catch-all section. Fully editable in settings;
no opinionated defaults shipped.

---

## 6. Generated & maintained notes (deterministic, plugin-owned, user content protected)

| Note | Source | Contents |
|------|--------|----------|
| `authors/<name>.md` | Zotero creators | Papers (links) + **rolled-up themes** across those papers |
| `themes/<t>.md` | Zotero tags under `theme/` (prefix configurable) | MOC of member papers/highlights |
| `glossary/<phrase>.md` | Highlights with a `term`-role color | Stub named after the phrase; user adds the definition; backlinks aggregate every occurrence |
| `_Dashboard.md` | Dataview queries (see §7) | Digest + review queue as live queries |

**Glossary convergence:** the note name/key is the highlighted text **trimmed + case-folded**, so
the same term highlighted in multiple papers converges to one note; the displayed title keeps the
first-seen casing. The definition the user writes is never overwritten.

**Themes:** only `theme/*` Zotero tags become theme MOCs + links. Other manual tags → plain
`#tags`. Zotero auto-generated tags are ignored.

---

## 7. Dashboard (Dataview, not generated files)

`_Dashboard.md` holds Dataview queries instead of the plugin regenerating digest/queue content:

- **New since last sync** — query filtered by `date-added` ≥ last-sync date. The plugin stamps the
  last-sync date into the dashboard on each run so the query can reference it.
- **Review queue** — `WHERE status != "done"`.
- Example ad-hoc dashboards the user can add: "all 🔴 disagreements", "unreviewed terms",
  reading list.

This depends on **Dataview-ready frontmatter** (`colors`, `themes`, `authors`, `date-added`,
`status`, `related`). Requires the Dataview community plugin.

---

## 8. Synthesis notes (user-built)

The plugin does **not** generate synthesis notes. It guarantees the block IDs exist so the user can
embed highlights across papers — `![[Attention Is All You Need#^h-AB12]]` — into their own synthesis
doc and write around them. Reviewing/comparing happens in one place; edits go to the source or the
synthesis prose.

---

## 9. Settings

- Path to `zotero.sqlite` (auto-detected default per-OS, editable).
- Vault subfolder name (default `zotero`).
- **Color map**: add/edit/remove rows — `color → (label, role)` — with catch-all label.
- Theme tag prefix (default `theme/`).
- Unfiled folder name (default `_Unfiled`).
- Which frontmatter fields to include.
- Toggles for each generated note type (authors / themes / glossary / dashboard).

---

## 10. Error handling

- DB not found / path wrong → clear message pointing to the settings path.
- DB locked or copy fails → surface Zotero-may-be-mid-write hint; retry once.
- sql.js load failure → actionable error.
- Missing abstract → omit the section.
- Unmapped color → catch-all section.
- Filename collision → append the item key suffix.
- Item deleted in Zotero → leave the note in place (never destroy user writing); optionally flag stale.

---

## 11. Testing

- **Unit:** color grouping + role handling, block-id determinism, deep-link construction, markdown
  render, user-zone splice/preserve, folder-path derivation, filename sanitization, glossary
  normalization/convergence, theme prefix filtering, author theme roll-up.
- **Integration:** seed a fixture `zotero.sqlite` → full sync into a temp vault → assert files,
  stubs, dashboard, and that a hand-edited `## My Notes` and a hand-written glossary definition
  both survive a re-sync.
- Stack: TypeScript, Obsidian API, esbuild, `sql.js`, Vitest.

---

## 12. Build order (for the implementation plan)

1. DB snapshot + sql.js reader + queries.
2. Domain model.
3. Paper-note render (highlights, colors, block IDs, deep links, frontmatter).
4. Folder placement + user-zone merge (identity by item key).
5. Sync orchestrator + manual command.
6. Settings UI (paths, color map, toggles).
7. Generated stubs: authors, themes, glossary.
8. Dashboard (Dataview queries) + last-sync stamping.
9. Related-papers + status field.
10. Tests throughout (unit alongside each module; integration at the end).
