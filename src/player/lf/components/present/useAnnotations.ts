import { useEffect, useRef } from 'react';
import { SlideTimingCoordinator } from './SlideTimingCoordinator';
import { findTextRange, WordPosition } from './useWordIndex';

export interface AnnotationTiming {
  type: 'highlight' | 'underline' | 'color' | 'strike' | 'clear' | 'label';
  elementId: string;
  targetText?: string;
  color?: string;
  labelText?: string;
  showAt: number;
  hideAt?: number;
}

const COLOR_TO_HIGHLIGHT_NAME: Record<string, Record<string, string>> = {
  highlight: {
    yellow: 'annotation-subject',
    green: 'annotation-verb',
    blue: 'annotation-adjective',
    red: 'annotation-error',
    default: 'annotation-generic',
  },
  underline: {
    yellow: 'annotation-underline-yellow',
    green: 'annotation-underline-green',
    blue: 'annotation-underline-blue',
    red: 'annotation-underline-red',
    default: 'annotation-underline-yellow',
  },
  color: {
    yellow: 'annotation-color-yellow',
    green: 'annotation-color-green',
    blue: 'annotation-color-blue',
    red: 'annotation-color-red',
    default: 'annotation-color-green',
  },
  strike: {
    default: 'annotation-strike',
  },
};

/**
 * LMP site: the <mark> fallback for browsers without the CSS Custom Highlight
 * API (format sheet §7.4). Each text node the range touches is split so the
 * marked words sit in their own node inside a <mark class="annotation-…">; on
 * hide the pieces are put back into the ORIGINAL text node (React keeps a
 * reference to it), so the slide's DOM ends exactly as it began.
 */
const hasHighlightApi = () => typeof CSS !== 'undefined' && !!(CSS as any).highlights && typeof (window as any).Highlight === 'function';

interface MarkedPiece { original: Text; mark: HTMLElement; after: Text | null }

export function wrapRangeInMarks(range: Range, className: string): MarkedPiece[] {
  const root = range.commonAncestorContainer;
  const texts: Text[] = [];
  if (root.nodeType === Node.TEXT_NODE) texts.push(root as Text);
  else {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) if (range.intersectsNode(n)) texts.push(n as Text);
  }
  const pieces: MarkedPiece[] = [];
  for (const original of texts) {
    const start = original === range.startContainer ? range.startOffset : 0;
    const end = original === range.endContainer ? range.endOffset : original.length;
    if (end <= start) continue;
    const after = end < original.length ? original.splitText(end) : null;
    const middle = original.splitText(start);
    const mark = document.createElement('mark');
    mark.className = `annotation-mark ${className}`;
    middle.parentNode!.insertBefore(mark, middle);
    mark.appendChild(middle);
    pieces.push({ original, mark, after });
  }
  return pieces;
}

export function unwrapMarks(pieces: MarkedPiece[]): void {
  for (const { original, mark, after } of pieces.reverse()) {
    original.data += (mark.textContent || '') + (after?.data || '');
    mark.remove();
    after?.remove();
  }
}

function getHighlightName(type: string, color?: string): string {
  const typeMap = COLOR_TO_HIGHLIGHT_NAME[type] || COLOR_TO_HIGHLIGHT_NAME.highlight;
  return typeMap[color || 'default'] || typeMap.default || 'annotation-generic';
}

/**
 * Register annotation actions with the timing coordinator.
 * Uses CSS Custom Highlights API to highlight/underline/color text ranges.
 */
export function useAnnotations(
  coordinator: SlideTimingCoordinator | null,
  annotations: AnnotationTiming[],
  wordIndexRef: React.RefObject<Map<string, WordPosition[]>>,
  containerRef: React.RefObject<HTMLElement | null>,
) {
  const registeredIds = useRef<Set<string>>(new Set());
  const usedPositions = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!coordinator || !annotations.length || !containerRef.current) {
      console.log('[Annotations] Skipping:', { hasCoordinator: !!coordinator, annotationCount: annotations.length, hasContainer: !!containerRef.current });
      return;
    }
    console.log('[Annotations] Registering', annotations.length, 'annotations');

    // Clean up previous registrations
    for (const id of registeredIds.current) {
      coordinator.unregister(id);
    }
    registeredIds.current.clear();
    usedPositions.current.clear();

    let counter = 0;

    for (const anno of annotations) {
      if (anno.type === 'clear') {
        // Clear action: remove all annotations from this element
        const actionId = `anno-clear-${anno.elementId}-${counter++}`;
        coordinator.register({
          id: actionId,
          showAt: anno.showAt,
          hideAt: anno.showAt + 0.05, // Brief action
          onShow: () => {
            // Remove all annotation highlights that match this element
            if (typeof CSS !== 'undefined' && CSS.highlights) {
              for (const key of Array.from(CSS.highlights.keys())) {
                if (key.startsWith('annotation-') && key.includes(anno.elementId)) {
                  CSS.highlights.delete(key);
                }
              }
            }
          },
          onHide: () => {},
          isActive: false,
        });
        registeredIds.current.add(actionId);
        continue;
      }

      if (!anno.targetText) continue;

      // Labels — positioned DOM elements above the target word
      if (anno.type === 'label') {
        const actionId = `anno-label-${counter++}`;
        let labelEl: HTMLDivElement | null = null;

        coordinator.register({
          id: actionId,
          showAt: anno.showAt,
          hideAt: anno.hideAt,
          onShow: () => {
            const wordIndex = wordIndexRef.current;
            if (!wordIndex || wordIndex.size === 0 || !containerRef.current) return;

            // Labels use their own position set — they target the same word as highlights
            const range = findTextRange(anno.targetText!, wordIndex, new Set());
            if (!range) {
              console.warn('[Annotation] Label target not found:', anno.targetText);
              return;
            }

            const rangeRect = range.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();
            const scale = containerRect.width / 1280;

            const left = (rangeRect.left - containerRect.left) / scale + (rangeRect.width / scale / 2);
            const top = (rangeRect.top - containerRect.top) / scale + (rangeRect.height / scale) + 4;

            labelEl = document.createElement('div');
            // Use explicit color if provided, otherwise infer from associated highlights
            const labelColor = anno.color || (() => {
              // Find the most recent highlight on this element to match color
              const associatedHighlight = annotations.find(
                a => (a.type === 'highlight') && a.elementId === anno.elementId && a.targetText === anno.targetText
              );
              return associatedHighlight?.color || 'yellow';
            })();
            labelEl.className = `annotation-label annotation-label-${labelColor} visible`;
            labelEl.textContent = anno.labelText || '';
            labelEl.style.left = `${left}px`;
            labelEl.style.top = `${top}px`;
            labelEl.style.transform = 'translateX(-50%)';

            containerRef.current.appendChild(labelEl);
            console.log('[Annotation] Label:', anno.labelText, 'above', anno.targetText);
          },
          onHide: () => {
            if (labelEl && labelEl.parentNode) {
              labelEl.parentNode.removeChild(labelEl);
              labelEl = null;
            }
          },
          isActive: false,
        });
        registeredIds.current.add(actionId);
        continue;
      }

      const highlightStyleName = getHighlightName(anno.type, anno.color);
      const actionId = `anno-${counter++}`;
      // Store range so we can remove it on hide
      let activeRange: Range | null = null;
      let activeMarks: MarkedPiece[] | null = null;

      coordinator.register({
        id: actionId,
        showAt: anno.showAt,
        hideAt: anno.hideAt,
        onShow: () => {
          const wordIndex = wordIndexRef.current;
          if (!wordIndex || wordIndex.size === 0) {
            console.warn('[Annotation] Word index empty, cannot highlight:', anno.targetText);
            return;
          }

          const range = findTextRange(anno.targetText!, wordIndex, usedPositions.current);
          if (!range) {
            console.warn('[Annotation] Text not found in word index:', anno.targetText);
            return;
          }
          console.log('[Annotation] Highlighting:', anno.targetText, anno.color, 'style:', highlightStyleName);
          if (!hasHighlightApi()) {
            // LMP site: no Custom Highlight API in this browser — wrap the words instead
            activeMarks = wrapRangeInMarks(range, highlightStyleName);
            return;
          }
          activeRange = range;

          // Use the STYLE name as the CSS.highlights key — must match ::highlight() in CSS
          const existing = CSS.highlights.get(highlightStyleName);
          if (existing) {
            existing.add(range);
          } else {
            const highlight = new (window as any).Highlight(range);
            CSS.highlights.set(highlightStyleName, highlight);
          }
        },
        onHide: () => {
          if (activeMarks) { unwrapMarks(activeMarks); activeMarks = null; }
          if (typeof CSS !== 'undefined' && CSS.highlights && activeRange) {
            const existing = CSS.highlights.get(highlightStyleName);
            if (existing) {
              existing.delete(activeRange);
              // If no ranges left, remove the highlight entirely
              if (existing.size === 0) {
                CSS.highlights.delete(highlightStyleName);
              }
            }
            activeRange = null;
          }
        },
        isActive: false,
      });
      registeredIds.current.add(actionId);
    }

    return () => {
      for (const id of registeredIds.current) {
        coordinator.unregister(id);
      }
      registeredIds.current.clear();
      // Clear all annotation highlights
      if (typeof CSS !== 'undefined' && CSS.highlights) {
        for (const key of Array.from(CSS.highlights.keys())) {
          if (key.startsWith('annotation-')) {
            CSS.highlights.delete(key);
          }
        }
      }
      // Remove any orphaned label elements
      if (containerRef.current) {
        containerRef.current.querySelectorAll('.annotation-label').forEach(el => el.remove());
      }
    };
  }, [coordinator, annotations, wordIndexRef, containerRef]);
}
