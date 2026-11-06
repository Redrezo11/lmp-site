import { SlidePreview } from '../types/lesson';

/**
 * Semantic blocks parsed from a slide's heading/body for the mobile reading
 * view. Deliberately does NOT rely on `slide.elements` — in the hint path
 * those are usually absent (they're only built when audio timings exist).
 * Mirrors the server's body formats (slideMapper.ts / slideElements.ts).
 */
export type SlideBlock =
  | { kind: 'para'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'vocab'; term: string; definition: string }
  | { kind: 'instruction'; text: string }
  | { kind: 'exerciseItem'; text: string; indent: boolean }
  | { kind: 'link'; text: string; url: string }
  | { kind: 'subtitle'; text: string };

/** The mapper prefixes objectives/recap lines with a literal bullet — strip it */
const BULLET_PREFIX = /^[•·►★◆✓—○\-]\s*/;
/** Answer keys must never leak into a hint opened during an assessment */
const CORRECT_MARKER = /\s*\((?:correct|صحيح)\)\s*/gi;
/** Lettered option ("a)" / "B.") or sub-item lines get indented */
const LETTERED = /^\s*[a-dA-D][).]\s+/;

const clean = (s: string) => s.replace(CORRECT_MARKER, ' ').replace(/\s+$/, '');

export function parseSlideContent(slide: SlidePreview): SlideBlock[] {
  const body = (slide.body || '').trim();
  if (!body) return [];

  switch (slide.type) {
    case 'vocabulary': {
      return body.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
        const i = line.indexOf(':');
        return i > 0
          ? { kind: 'vocab' as const, term: line.slice(0, i).trim(), definition: line.slice(i + 1).trim() }
          : { kind: 'vocab' as const, term: line, definition: '' };
      });
    }

    case 'objectives':
    case 'recap': {
      return body.split('\n').map(l => l.replace(BULLET_PREFIX, '').trim()).filter(Boolean)
        .map(text => ({ kind: 'bullet' as const, text }));
    }

    case 'activity': {
      let paras = body.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      if (paras.length <= 1) paras = body.split('\n').map(p => p.trim()).filter(Boolean);
      const [first, ...rest] = paras;
      const blocks: SlideBlock[] = [];
      if (first) blocks.push({ kind: 'instruction', text: clean(first) });
      for (const p of rest) {
        // A paragraph may itself hold several numbered/lettered lines
        for (const line of p.split('\n').map(l => l.trim()).filter(Boolean)) {
          blocks.push({ kind: 'exerciseItem', text: clean(line), indent: LETTERED.test(line) });
        }
      }
      return blocks;
    }

    case 'video': {
      const [title, url] = body.split('\n').map(s => s.trim());
      return url
        ? [{ kind: 'link', text: title || url, url }]
        : [{ kind: 'para', text: body }];
    }

    case 'title':
    case 'end':
    case 'assessment':
      return [{ kind: 'subtitle', text: body }];

    default: {
      // content + anything unknown: real paragraphs, falling back to lines
      let paras = body.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      if (paras.length <= 1) paras = body.split('\n').map(p => p.trim()).filter(Boolean);
      return paras.map(text => ({ kind: 'para' as const, text }));
    }
  }
}

/** True when the text is predominantly Arabic (drives per-block RTL) */
export function isArabicText(s: string): boolean {
  const arabic = (s.match(/[؀-ۿ]/g) || []).length;
  return arabic > 0 && arabic > s.replace(/\s/g, '').length * 0.3;
}
