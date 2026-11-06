# Player notes

How this site plays LessonForge modules, where it knowingly differs from LessonForge, and its
known limits. The playback code itself is LessonForge's (see `src/player/lf/VENDORED.md`).

## Where the site differs from LessonForge

| Behaviour | LessonForge | This site |
|---|---|---|
| Play all over a slide with no narration | the projector waits; decks and the phone replay move on after 5 s | moves on after 5 s everywhere |
| Captions on the projector | lesson slides only when the clip has word-timed captions | every narrated slide (sentences timed by length when there are no word timings) |
| Reveal timing | checked on the audio's `timeupdate` event (about 4 times a second, so up to ~0.25 s late) | also checked on every animation frame (within a frame of the stored time) |
| Highlights in browsers without the CSS Custom Highlight API | not drawn | drawn as `<mark>` with the same colours |
| Class QR code and live counter | QR to the class session, live opened/finished counts | **Student session** button and a QR to this site's own session page; no counts (nothing is sent anywhere) |
| Student progress | the class account's record / anonymous class run | this browser only (`localStorage`); "Start again" on the module page clears it |

## Known limits

- **Text styling in reveal mode.** When a slide reveals its text with the narration, LessonForge's
  structured view (`SlideViewer.tsx`) loses each element's own weight and slant: headings are not
  bold, examples and instructions are not italic, vocabulary terms are not bold. `**bold**` and
  `*italic*` written inside the text still show. Its text is also a third larger than configured,
  because sizes are converted from points to pixels twice (a 28 pt heading is drawn at about 50 px
  instead of 37 px). The site draws it the same way, so slides look as they do in LessonForge. Slides
  without timings use the themed layout, which has neither problem.
- **Slide bodies are left-to-right.** Arabic slides, captions, the narration panel and Arabic
  practice text are right-to-left, but the text on the slide canvas itself is laid out left-to-right,
  as in LessonForge.
- **The QR code shows the address the site was opened from.** On a local preview
  (`localhost`) a phone can't open it. Use it from the published GitHub Pages site.
- **Imported modules last until the page is closed or reloaded.** Keeping them (IndexedDB) is phase 3.
- **Practice "mark the words" items.** LessonForge's session page drops practice items it can't run
  (`filterUsablePracticeItems`), which includes any `select` item in a practice level. The site does
  the same. `select` screens appear in the book exercises, where LessonForge uses them.

## Testing

- `npm test`: the format checks, and the bridge from module blocks to LessonForge's components,
  against the real Pros and Cons lesson.
- `npm run e2e`: builds the site and runs the acceptance checklist in Chrome (the one installed on
  the computer) at 1280, 1024 and 390 px, with the lesson's real audio. Two small fixture modules
  that exist only in `e2e/support.ts` cover decks and the select / self-check exercise screens; they
  use the Pros and Cons lesson's audio and picture.
