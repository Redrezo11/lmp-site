/**
 * Font mapping for slide rendering.
 * Maps PowerPoint fonts to free alternatives for cross-platform rendering
 * (LMP site: served locally from public/fonts, not Google Fonts).
 */

/** Fonts that need Google Fonts alternatives (not web-safe) */
const GOOGLE_FONT_MAP: Record<string, string> = {
  'Calibri': 'Carlito',
  'Calibri Light': 'Carlito',
  'Cambria': 'Caladea',
  'Segoe UI': 'Noto Sans',
  'Franklin Gothic Medium': 'Libre Franklin',
  'Century Gothic': 'Questrial',
  'Garamond': 'EB Garamond',
  'Book Antiqua': 'EB Garamond',
  'Ink Free': 'Caveat',
  'Comic Sans MS': 'Comic Neue',
};

/** Fonts that are web-safe and don't need loading */
export const WEB_SAFE = new Set([
  'Arial', 'Verdana', 'Georgia', 'Trebuchet MS',
  'Times New Roman', 'Courier New', 'Palatino Linotype', 'Palatino',
]);

/**
 * LMP site: the substitutes are served from public/fonts and declared with
 * @font-face in src/index.css (website-spec §6), so nothing leaves the origin.
 * The browser fetches a face the first time a slide uses it; there is nothing
 * to load here. Kept so SlideViewer stays as in LessonForge.
 */
export function loadFonts(_fonts: string[]): void {
  /* @font-face in src/index.css */
}

/**
 * Get CSS font-family string with appropriate fallbacks.
 * Lists the original font first (for systems that have it),
 * then the Google Fonts fallback, then generic.
 */
export function fontFamily(font: string): string {
  const googleFallback = GOOGLE_FONT_MAP[font];

  if (googleFallback) {
    // Font needs a Google Fonts fallback
    const generic = font.includes('Sans') || font === 'Calibri' || font === 'Calibri Light'
      || font === 'Century Gothic' || font === 'Franklin Gothic Medium' || font === 'Segoe UI'
      ? 'sans-serif'
      : font === 'Ink Free' || font === 'Comic Sans MS'
        ? 'cursive'
        : 'serif';
    return `"${font}", "${googleFallback}", ${generic}`;
  }

  // Web-safe or unknown font — use as-is with generic fallback
  const generic = ['Georgia', 'Times New Roman', 'Palatino Linotype', 'Palatino',
    'Cambria', 'Garamond', 'Book Antiqua'].includes(font) ? 'serif'
    : font === 'Comic Sans MS' || font === 'Ink Free' ? 'cursive'
      : 'sans-serif';
  return `"${font}", ${generic}`;
}
