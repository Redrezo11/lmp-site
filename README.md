# Lessons website (LMP player)

A static website that plays **Learning Module Packages** (`.lmp` files): lessons, narrated slide
decks and student exercises exported from LessonForge. It runs on GitHub Pages with no server and
no accounts. Everything plays in the visitor's browser.

This folder is the **starter version** (phase 1). It works now; the LessonForge presenter, phone
player and student session are wired in next (phase 2). See `CLAUDE.md` and `docs/specs/`.

## What works today

- The **catalogue** lists every module in `public/modules/`, with search.
- **Generic lessons** play: text, pictures, audio with transcript and captions, video, information
  panels, summaries and seven kinds of question marked in the browser. Try the sample module.
- **Your real lesson** ("Critical Thinking: Identifying Pros and Cons", exported from LessonForge)
  is inside and passes the format check. Its three parts (presentation, exercises, student
  session) show what they hold; they play once phase 2 is done.
- **Import** opens any `.lmp` file from your computer without uploading it.
- **Every module is checked** against the format's rules before it plays. A broken one shows
  which file is wrong.

## Run it on your computer

You need Node.js 22 or newer.

```bash
npm install
npm run dev        # then open http://localhost:4000
```

Other commands:

```bash
npm test           # checks the modules and the format rules
npm run validate   # checks every module in public/modules (or: npm run validate -- some.lmp)
npm run catalog    # rebuilds public/catalog.json after adding or removing a module
npm run build      # the site as static files in dist/
npm run preview    # serves dist/ at http://localhost:4000
```

## Add a lesson from LessonForge

1. In LessonForge, click the globe icon next to a lesson or deck and download the `.lmp` file.
2. Unzip it into a new folder `public/modules/<its name>/` (the folder that holds `module.json`).
3. Run `npm run catalog`, then `npm test`.
4. Commit and push. The site updates by itself (below).

To try a file without adding it to the site, use **Import module** in the site's header.

## Put it on GitHub Pages

1. Create a new repository on GitHub and push this folder to its `main` branch.
2. In the repository: **Settings ▸ Pages ▸ Build and deployment ▸ Source: GitHub Actions**.
3. Every push to `main` runs the tests, builds the site and publishes it
   (`.github/workflows/pages.yml`). The address is shown in **Settings ▸ Pages**.

The site works at any address (`https://<you>.github.io/<repository>/`): links are relative.

## Kept off GitHub

`docs/specs/` holds the specification sheets. It is in `.gitignore`, so the sheets stay on this
computer and are never pushed. Claude Code reads them here.

## Folders

| Folder | What is in it |
|---|---|
| `src/app/` | the pages: catalogue, a module's lessons, import |
| `src/lmp/` | the format: types, loading, the check, the block list, progress |
| `src/player/core/` | the generic blocks and the lesson player |
| `src/player/lf/` | LessonForge blocks: placeholders today; `vendor/` holds LessonForge's own player code for phase 2 (not compiled yet) |
| `schema/` | the format's rules as JSON Schema (copies of LessonForge's: don't edit here) |
| `public/modules/` | the modules the site offers; `public/catalog.json` lists them |
| `tools/` | `validate` and `catalog` |
| `docs/specs/` | the specification sheets (local only) |
