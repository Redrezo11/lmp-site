/** 1 inch = 96 CSS pixels (standard DPI) */
export const IN = 96;

/** Convert inches to px */
export function inPx(inches: number): number {
  return inches * IN;
}

/** Convert pt to px (1pt = 96/72 px) */
export function ptToPx(pt: number): number {
  return pt * (96 / 72);
}

/** Convert hex color string to CSS-ready format */
export function hexColor(hex: string): string {
  return `#${hex}`;
}

/**
 * Unicode bullet characters matching pptx.ts BULLET_MAP.
 * Keys are hex code points (as stored in SlideRenderConfig.bulletCharacter).
 */
export const BULLET_CHARS: Record<string, string> = {
  '2022': '\u2022', // •  bullet
  '25BA': '\u25BA', // ►  arrow
  '2605': '\u2605', // ★  star
  '25C6': '\u25C6', // ◆  diamond
  '2713': '\u2713', // ✓  checkmark
  '2014': '\u2014', // —  dash
  '25CB': '\u25CB', // ○  circle
};
