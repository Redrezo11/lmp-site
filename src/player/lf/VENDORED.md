# LessonForge code in this folder

Copied from the LessonForge repository, branch `mvp`, commit **`a268165`** (2026-11-04), keeping
LessonForge's folder layout (`src/<path>` there = `src/player/lf/<path>` here). To pull a later
LessonForge fix across, diff the LessonForge file between `a268165` and the new commit and apply the
same change here. Line endings are LessonForge's (some files are CRLF), so those diffs stay clean.

Everything listed as **unchanged** is byte-for-byte LessonForge, except that an unused
`import React` was dropped where this project's `noUnusedLocals` rejects it (marked *imports*).

## Changed for the site

| File | What changed, and why |
|---|---|
| `components/present/usePresentationPlayback.ts` | `silentAdvanceMs` defaults to 5000 (`SITE_SILENT_ADVANCE_MS`): Play all moves on from a slide with no narration everywhere, where LessonForge's projector stalls. (There was no `trackEvent` in this file.) |
| `components/present/PresentationViewer.tsx` | Removed `extractionId`, the class QR code, the live opened/finished counter, the counter reset, "switch on for phones" and the generate-audio/translate buttons (all server calls). Added `sessionUrl`: a **Student session** button on the last lesson slide and on exercise slides that can be done on a phone, opening the QR overlay with the site's own session link (`?exercise=<id>` on an exercise slide). |
| `components/present/QrOverlay.tsx` | From the same commit (it was not in the first copy). The counter (`summary`, `caption`) removed; an **Open here** link added. QR made locally with `qrcode`. |
| `components/present/RevealOnTime.tsx` | Also checks the audio clock on every animation frame, not only on `timeupdate`. `timeupdate` fires about 4 times a second, which showed text up to 0.25 s late; the format sheet (§7.3) says reveals run on a `requestAnimationFrame` loop. Measured after the change: 6.042 s / 14.260 s for timings 6.04 / 14.26. |
| `components/present/useAnnotations.ts` | `<mark>` fallback when the CSS Custom Highlight API is missing (`wrapRangeInMarks` / `unwrapMarks`): the words are wrapped in `<mark class="annotation-…">` with the same colours, and the original text nodes are restored on hide. |
| `components/present/mobile/LessonReplay.tsx` | `ReplayPayload` defined here (was in `services/api`); the `studentProgress` write became an `onExerciseDone` callback. |
| `components/exercises/digital/ExerciseRunner.tsx` | `trackEvent` / `getDeviceId` removed. The done flag and resume state are LessonForge's `persist` keys: `lf-exercise-<module>-<exId>`, `lf-exercise-done-<module>-<exId>`. |
| `pages/AssessPage.tsx` | `AssessSession` takes a `host` (the payload built from the `lf.student-session` block, plus this device's memory) instead of fetching `/assessment`. Always LessonForge's "student at home" storage (`localStorage`, `lf-session-<module>`), with the anonymous page's layout. No tracking. Language and answer mode are remembered in the site's `lf-progress-<module>` record. Header: back link, the Arabic help switch, "Watch the lesson (N min)". The book's exercises are listed below the stream with their readiness line. The header buttons wrap on narrow phones. The `/assess/:id` route wrapper is gone. |
| `pages/PracticePage.tsx` | Only `filterUsablePracticeItems` and `cleanPracticeSet`, verbatim (the page itself is server-bound). |
| `utils/fontLoader.ts` | `loadFonts` no longer adds a Google Fonts `<link>`: the fonts are served from `public/fonts` (`fonts.css`). The substitution table and `fontFamily` are unchanged. |
| `components/present/useWordIndex.ts` | `document.compareDocumentPosition ?` → `typeof … === 'function' ?` (a TypeScript error under this project's settings; same behaviour). |
| `src/index.css` (site) | Took LessonForge's reveal and `::highlight(annotation-*)` / `.annotation-label` rules; added the `mark.annotation-*` fallback rules. |

## Unchanged

`components/present/` ControlBar, SlideGrid (*imports*), SlideTimingCoordinator, mobile/MobilePlayer,
mobile/MobileControlBar, mobile/NarrationPanel (*imports*), mobile/useNarrationLines ·
`components/preview/` SlideViewer, SlideCanvas (*imports*), renderers/* (*imports*) ·
`components/practice/` PracticeSession, McqExercise, MatchExercise, OrderExercise, TypedExercise,
MarkTextExercise, FeedbackPanel, Bilingual, AssistToggle (all *imports*) ·
`components/exercises/digital/` DigitalPreview, toPracticeItems ·
`components/assess/` SlideReviewOverlay, MobileSlideView ·
`utils/` captions, typedAnswers, markText, seededShuffle, text, assist, slideContent, slideLink ·
`hooks/` useAssist, usePinchZoom, useIsPhone · `types/` lesson, practice, exercise, exerciseTemplates,
slideRender, course.

## Not brought in

`utils/deviceId.ts`, `utils/studentProgress.ts` (its record shares the key `lf-progress-<id>` with the
site's own progress, so the site keeps that record and LessonForge's calls became callbacks),
`services/*`, the `/practice` page, the teacher pages, anything under `server/`.

## Added by the site (not LessonForge code)

- `fromModule.ts`: module blocks → the props these components take (URLs, clips, exercise slides via
  `toExerciseSlides`, the session payload). No timing, caption or marking logic.
- `LfBlocks.tsx`: `LfViewer` (presenter on desktop, `MobilePlayer` at ≤ 768 px or `?phone=1`) and
  `LfSession` (the session page, 480 px wide on desktop), registered in `src/lmp/registry.tsx`.
- `types/deck.ts`: `DeckSlide`.

## Decisions

- Captions: the presenter gets `narrationCaptions` (every clip captioned). The phone player already
  captions every clip; it is left as LessonForge has it, so its panel still says "Captions" only for
  word-timed lines and "What the teacher says" otherwise.
- Reveal-mode styling quirk (in structured mode each element's own bold/italic is lost and text is a
  third larger than configured; inline `**bold**`/`*italic*` stays): kept as LessonForge draws it.
  See `docs/player-notes.md`.
