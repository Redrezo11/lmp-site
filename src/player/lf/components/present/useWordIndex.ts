import { useEffect, useRef } from 'react';

export interface WordPosition {
  textNode: Text;
  startOffset: number;
  endOffset: number;
}

/**
 * Build a word-position index from rendered text nodes.
 * Maps each word (lowercase, stripped of punctuation) to its positions
 * in the DOM so we can create Range objects for CSS Custom Highlights.
 */
export function buildWordIndex(containerEl: HTMLElement): Map<string, WordPosition[]> {
  const index = new Map<string, WordPosition[]>();
  const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT);
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    const text = node!.textContent || '';
    const wordRegex = /\S+/g;
    let match: RegExpExecArray | null;

    while ((match = wordRegex.exec(text))) {
      const raw = match[0];
      const word = raw.toLowerCase().replace(/[.,!?;:'"()[\]{}\u2014\u2013\-]/g, '');
      if (!word) continue;

      const positions = index.get(word) || [];
      positions.push({
        textNode: node!,
        startOffset: match.index,
        endOffset: match.index + raw.length,
      });
      index.set(word, positions);
    }
  }

  return index;
}

/**
 * Find the Range for a target text phrase within a container using the word index.
 * Returns null if not found.
 */
export function findTextRange(
  targetText: string,
  wordIndex: Map<string, WordPosition[]>,
  usedPositions: Set<string> = new Set(),
): Range | null {
  const words = targetText.toLowerCase().split(/\s+/).map(w => w.replace(/[.,!?;:'"()[\]{}\u2014\u2013\-]/g, ''));
  if (words.length === 0) return null;

  const firstWord = words[0];
  const positions = wordIndex.get(firstWord);
  if (!positions) return null;

  for (const startPos of positions) {
    const key = `${startPos.textNode}:${startPos.startOffset}`;
    if (usedPositions.has(key)) continue;

    if (words.length === 1) {
      const range = new Range();
      range.setStart(startPos.textNode, startPos.startOffset);
      range.setEnd(startPos.textNode, startPos.endOffset);
      usedPositions.add(key);
      return range;
    }

    // Multi-word: find the last word after the first
    const lastWord = words[words.length - 1];
    const lastPositions = wordIndex.get(lastWord);
    if (!lastPositions) continue;

    for (const endPos of lastPositions) {
      // Must be after start position
      const isAfter = endPos.textNode === startPos.textNode
        ? endPos.startOffset > startPos.startOffset
        : typeof document.compareDocumentPosition === 'function'
          ? startPos.textNode.compareDocumentPosition(endPos.textNode) & Node.DOCUMENT_POSITION_FOLLOWING
          : true;

      if (isAfter) {
        const range = new Range();
        range.setStart(startPos.textNode, startPos.startOffset);
        range.setEnd(endPos.textNode, endPos.endOffset);
        usedPositions.add(key);
        return range;
      }
    }
  }

  return null;
}

/**
 * Hook: builds word index after the container mounts and rebuilds
 * when DOM content changes (e.g., elements revealed by RevealOnTime).
 */
export function useWordIndex(containerRef: React.RefObject<HTMLElement | null>) {
  const indexRef = useRef<Map<string, WordPosition[]>>(new Map());

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Build initial index
    indexRef.current = buildWordIndex(el);

    // Rebuild when DOM changes (elements revealed)
    const observer = new MutationObserver(() => {
      indexRef.current = buildWordIndex(el);
    });
    observer.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, [containerRef]);

  return indexRef;
}
