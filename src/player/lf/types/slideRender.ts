/**
 * Theme colors for rendering, extracted from server ThemeDefinition.
 * All colors are 6-digit hex WITHOUT '#' prefix (matching pptxgenjs convention).
 */
export interface ThemeColors {
  titleBg: string;
  contentBg: string;
  titleFontColor: string;
  headingFontColor: string;
  bodyFontColor: string;
  accentColor: string;
}

/**
 * Per-slide-type typography settings, derived from ResolvedGuideline + PresentationDesign.
 */
export interface SlideTypography {
  headingSize: number;   // pt
  bodySize: number;      // pt
  textAlign: 'left' | 'center' | 'right';
}

/**
 * Everything the frontend needs to render slides identically to pptx.ts.
 * Computed server-side via buildRenderConfig(), returned alongside slides in API responses.
 */
export interface SlideRenderConfig {
  theme: ThemeColors;
  headingFont: string;
  bodyFont: string;
  bulletCharacter: string;       // hex code point e.g. '25BA'
  isHeadingItalic: boolean;
  vocabTermStyle: string;        // 'bold' | 'bold-italic' | 'italic-underline'
  lineSpacing: number;           // multiplier (e.g. 1.2)
  slideTypography: Record<string, SlideTypography>;
}
