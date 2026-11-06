# Instructions for Claude Code in this project

This is the **LMP player website**: a static site on GitHub Pages that plays modules exported by
LessonForge (a separate project). Read these before changing anything, in this order:

1. `docs/specs/README.md`: which sheet is for what.
2. `docs/specs/website-spec.md`: **the build brief for this site**. Phases, what to vendor, storage
   keys, the acceptance checklist (§10).
3. `docs/specs/module-format-spec.md`: the file format, and in §7–§11 the playback rules that
   define "the same as LessonForge". When a behaviour question comes up, the answer is there.
4. `src/player/lf/VENDORED.md`: the LessonForge code in the build, from which commit, and every
   change made to it. `docs/player-notes.md`: where the site knowingly differs, and known limits.

`docs/specs/` is in `.gitignore` on purpose (the owner's ruling): **never commit it, never move it
into a tracked folder, never paste it into a tracked file.**

## Where things stand

**Phase 1 is done** (website-spec §11):
- Vite + React 19 + TypeScript + Tailwind, `HashRouter`, `base: './'`, the Pages workflow.
- Catalogue from `public/catalog.json` (built by `npm run catalog`), search.
- Loader for site modules and imported `.lmp` files (fflate, `blob:` URLs), the validator
  (`src/lmp/validate.ts`, ajv over `schema/*.json` + structural checks), errors vs notes.
- All generic block types (`src/player/core/blocks.tsx`), the lesson player with progress and a
  completion screen, local progress (`lf-progress-<id>`), restart.
- Placeholders for the four `lf.*` blocks (replaced in phase 2).
- `public/modules/`: the real LessonForge lesson `critical-thinking-identifying-pros-and-cons` and a
  generic `sample-generic-blocks` module. Tests in `tests/`.

**Phase 2 is done** (website-spec §4, §5, §9):
- LessonForge's playback code is in `src/player/lf/` (commit `a268165`), adapted as listed in its
  `VENDORED.md`: no server calls or tracking, 5 s silent advance, captions on, local fonts
  (`public/fonts/fonts.css`), a `<mark>` fallback for highlights, reveals checked every frame.
- `src/player/lf/fromModule.ts` turns blocks into the components' props; `LfBlocks.tsx` hosts them
  (lazy-loaded from `src/lmp/registry.tsx`): presenter on desktop, `MobilePlayer` at ≤ 768 px or
  `?phone=1`, the session page at `#/m/<id>/session` with a **Student session** button + QR.
- Browser checks for the acceptance checklist: `npm run e2e` (Playwright, the installed Chrome).
  Fixture modules for decks and select/self-check screens live only in `e2e/support.ts`.

**Next: phase 3** (IndexedDB for imports, `tools/` pack, authoring guide), then phase 4 (SCORM/cmi5).

## Rules

- **No server, no accounts, no analytics, no external requests at runtime** (fonts included). The
  site must work from `file`-like static hosting.
- **The format is LessonForge's.** `schema/` are copies; if a change seems to need a schema change,
  stop and say so: the format is changed in LessonForge first (format sheet §14).
- **Fidelity over invention.** Playback behaviour comes from the vendored code and the format
  sheet's rules; don't re-derive timings, caption splitting or marking.
- Keep `npm test` and `npm run build` green; the Pages workflow runs both. Run `npm run e2e` after
  changing anything under `src/player/lf/` (it needs Chrome, so it is not in the workflow).
- Arabic text is `dir="rtl"`; the assist (Arabic) overlay is off by default.
