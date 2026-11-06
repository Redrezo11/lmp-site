# Fonts

The LessonForge slides name PowerPoint fonts; the player maps them to free equivalents
(`src/player/lf/utils/fontLoader.ts`) and serves those from this folder, so nothing is fetched from
another site. `fonts.css` declares them (`@font-face`, linked from `index.html`); the browser
downloads a face only when a slide uses it.

| PowerPoint name | Served font |
|---|---|
| Calibri, Calibri Light | Carlito |
| Cambria | Caladea |
| Segoe UI | Noto Sans |
| (Arabic text) | Noto Sans Arabic |
| Franklin Gothic Medium | Libre Franklin |
| Century Gothic | Questrial |
| Garamond, Book Antiqua | EB Garamond |
| Ink Free | Caveat |
| Comic Sans MS | Comic Neue |

Arial, Verdana, Georgia, Trebuchet MS, Times New Roman, Courier New and Palatino stay system fonts.

The files are the `latin` and `latin-ext` subsets (and `arabic` for Noto Sans Arabic) from the
[Fontsource](https://fontsource.org) packages, in Regular, Bold, Italic and Bold Italic where the
family has them (Caveat has no italic; Questrial has Regular only). All are under the SIL Open Font
License; each family's licence is `LICENSE-<family>.txt`.
