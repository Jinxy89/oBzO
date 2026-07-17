# OBzO — Obsidian ⇄ Zotero Knowledge Sync

> A desktop-only Obsidian plugin that syncs Zotero highlights, comments, and metadata into a
> linked, reviewable knowledge base. One-way (Zotero → Obsidian) with a protected zone for your
> own writing. **No AI features** — everything is deterministic, derived from Zotero data +
> Obsidian's native linking.

This document is the living record of the project. Every time we refine an idea, complete a step,
or make a decision, we log it here with a date so the completion status of each part stays visible.

---

## Completion Tracker

| # | Part | Status | Last updated |
|---|------|--------|--------------|
| 1 | Round 1 — core sync design (reader, note structure, folders, color map, safety) | 🟢 Settled | 2026-07-10 |
| 2 | Round 2 — knowledge layer (synthesis, glossary, author/theme maps) | 🟢 Settled | 2026-07-10 |
| 3 | Written spec / design doc (`SPEC.md`) | 🟢 Approved | 2026-07-16 |
| 4 | Implementation plan — foundation (`docs/plans/2026-07-16-foundation.md`) | 🟢 Written | 2026-07-16 |
| 5 | Implementation — foundation slice (scaffold + DB reader + model) | 🟢 Done — 5/5 tasks, reviewed (ready to merge) | 2026-07-16 |
| 6 | Rendering slice — plan (`docs/plans/2026-07-16-rendering.md`) | 🟢 Written | 2026-07-16 |
| 7 | Rendering slice — implementation (transform layer: frontmatter, colors, deep links, block IDs, render) | 🟢 Done — 6/6 tasks, reviewed (ready to merge) | 2026-07-16 |
| 8 | Write/merge slice — plan (`docs/plans/2026-07-16-write-merge.md`) | 🟢 Written | 2026-07-16 |
| 9 | Write/merge slice — implementation (folder placement, user-zone merge, vault writer, command wiring) | ⬜ Not started | — |
| 10 | Implementation plans — remaining slices (settings UI, stubs, dashboard) | ⬜ Not started | — |

Legend: ⬜ not started · 🟠 in progress · 🟡 drafted/pending · 🟢 done

---

## Round 1 — Core Sync Design (drafted 2026-07-10)

Decided via brainstorming:

- **Form:** Desktop-only Obsidian plugin. Command `OBzO: Sync from Zotero`.
- **Data source:** Reads a **copied snapshot** of `zotero.sqlite` via **`sql.js`** (pure-WASM, no
  native modules) to avoid Zotero's DB lock. Queries collections, items, annotations, attachments.
- **Note structure:** One literature note per paper. Frontmatter (key, title, authors, year,
  collections, zotero-link) + `## Abstract` + color-grouped highlight sections, each highlight a
  blockquote with its Zotero comment inline (`↳`).
- **Color → category:** Fully **user-defined** mapping (add/edit/remove rows). Unmapped colors →
  catch-all section. No opinionated defaults shipped.
- **Folder mapping:** Mirrors Zotero collection tree. File lives in **one** primary folder;
  all memberships listed in `collections:` frontmatter. Unfiled items → `zotero/_Unfiled/`.
- **Identity:** Stable **Zotero item key** in frontmatter (survives renames / re-titles).
- **Sync safety:** **Protected user zone** — sync regenerates only the region above
  `<!-- obzo:end -->`; everything below (e.g. `## My Notes`) is never touched.
- **Testing:** Vitest unit tests + integration test against a seeded fixture DB.
- **Out of scope (v1):** background watcher, two-way sync, Web API, image/area annotations, mobile.

**Open items to confirm:** (a) project name (working name OBzO), (b) v1 = manual command only,
(c) text highlights only in v1.

---

## Round 2 — Knowledge Layer (started 2026-07-10)

User goals raised for this round (no AI):

1. **Synthesis / aggregation notes** — highlights + related notes need to collect into a
   follow-up document that can be edited and reviewed in one place, with fewer steps.
2. **Term / glossary review** — after looking up an unfamiliar term, be able to review it later
   without hunting back to the original note; use Obsidian's linking to surface every occurrence.
3. **Author ↔ content map** — sync authors as linked entities so author→papers→content is navigable.
4. **Theme / tag linking** — build a theme/tag link system connecting related notes.
5. **Open question:** what other note-system capabilities are worth adding.

### Decisions settled so far (2026-07-10)

- **Revision to Round 1 (keystone):** every synced highlight now carries **(a)** a stable block ID
  (`^h-XXXX`) so it can be embedded/linked anywhere, and **(b)** a `zotero://open-pdf` deep link to
  the exact annotation. Wikilinks typed inside a Zotero comment **pass through** as real Obsidian
  links. This is what makes the whole knowledge layer possible.
- **Generation level:** "rails + scaffolds." Plugin guarantees infrastructure AND auto-creates/
  maintains plugin-owned stubs: one per author, one per theme (MOC), and a "new since last sync"
  digest. User creates synthesis notes by hand (embedding `^blocks`). Writing inside stubs is
  protected (never overwritten).
- **Color roles:** the Round-1 color map gains a **role** per color, not just a label. Roles:
  `section` (default — group highlights under the label) and `term` (also spawn a glossary note).
- **Terms / glossary:** designated by a **dedicated "term" color**. Each such highlight creates
  `glossary/<phrase>.md` named after the highlighted text; occurrences converge to one note via
  trimmed + case-folded normalization; backlinks aggregate every occurrence for review.
- **Themes / tags:** only **namespaced Zotero tags** (`theme/*`, prefix configurable) become theme
  MOC notes + links. Other manual tags → plain `#tags`. Zotero auto-tags ignored.

### Final Round-2 decisions (2026-07-10)

- **Author notes:** papers list **+ rolled-up themes** across those papers.
- **v1 extras:** ALL four included — "new since last sync" digest, Dataview-ready frontmatter,
  related-papers links, review status + queue.
- **Digest & Review Queue are Dataview queries**, not plugin-regenerated files. They live in a
  single generated `_Dashboard.md`. "New since last sync" = a Dataview query filtered by
  `date-added`; the plugin stamps the last-sync date so the query can reference it.
- **Review `status`:** lives in Obsidian frontmatter. Plugin writes `status: unread` on first sync
  and **never overwrites** it afterward; the user edits it by hand.

Round 2 design is complete. Proceeding to write the consolidated spec (`SPEC.md`).

---

## Decisions Log

| Date | Decision |
|------|----------|
| 2026-07-10 | Project folder created at `/Users/jinxyw/Desktop/MY_PROJECT/OBzO`; progress log established. |
| 2026-07-10 | Round 2 scoped to the deterministic knowledge/linking layer; explicitly **no AI**. |
| 2026-07-16 | Spec approved. Foundation implementation plan written (`docs/plans/2026-07-16-foundation.md`): 5 TDD tasks — scaffold, domain model, DB snapshot, queries, sync skeleton. Scoped to SPEC §12 build steps 1–2; render/write/stubs/dashboard deferred to later plans. |
| 2026-07-16 | Foundation implemented via subagent-driven TDD on branch `obzo-foundation` (9 commits `5ff5008`..`b17267e`). 10/10 tests, `typecheck` exit 0, `main.js` builds. Final whole-branch review: **ready to merge**, no Critical. Tracked follow-ups (see `.superpowers/sdd/progress.md`): **(Important)** ship `sql-wasm.wasm` + `locateFile` so the command runs inside Obsidian (tests pass via node_modules but Electron needs the wasm delivered); (Minor) WAL sidecar copy, N+1 queries, trashed/note-item filtering; (coverage) `relatedKeysFor`, untitled/null-firstName/post-copy-error branches. |
| 2026-07-16 | Write/merge slice **plan** written (`docs/plans/2026-07-16-write-merge.md`): SPEC §12 steps 4–5, 4 TDD tasks — folder placement + filename sanitization, frontmatter parse + protected-zone merge, write orchestrator (place/merge/move by `zotero-key`) over a `VaultAdapter` seam tested against an in-memory fake, then a thin `ObsidianVault` adapter + command wiring (untestable IO shell, controller-verified like the wasm). Two design decisions confirmed with user: re-sync identity = **scan vault, match `zotero-key`**; filename = **sanitized title** (collision → append key). Pure-core/IO-shell split preserved; settings-UI/stubs/dashboard/integration test deferred to later plans. |
| 2026-07-16 | Rendering slice implemented via subagent-driven TDD on branch `obzo-rendering` (7 commits `c958825`..`45d0e5a`, from `acfc0cf`). Pure transform layer under `src/transform/`: `attachmentKey` on `Annotation` + 2-hop query; `blockIds`/`deepLinks`/`colors`/`frontmatter`/`render`; `groupByColor` (color-map order, label-merge, catch-all, hex-norm); `renderSyncedRegion` → SPEC §4 synced region ending in `<!-- obzo:end -->`. 24/24 tests, `typecheck` exit 0, `build` emits `main.js` + wasm. Controller added a shared-label merge test (`423fa72`) closing a reviewer coverage gap. Final whole-branch review (opus): **ready to merge**, no Critical/Important — contracts, wiring, pure-core layering, determinism, Task-1 JOIN all verified. Minor follow-ups: `DEFAULT_SETTINGS.colorMap` shared instance; `JSON.stringify`≠YAML escaping for exotic chars; abstract truthiness guard. Forward note for the write/merge slice: quote `status` if `existingStatus` ever carries leading YAML metachars. |
