import type { SlideElement } from './lesson';

/**
 * LMP site (website-spec §5.3): a Slide Deck page as LessonForge stores it
 * (`SlideDeck.slides` is Mixed there; this is its shape). `type: 'image'` for
 * PDF pages (a picture), `'content'` for PPTX slides (text + elements).
 */
export interface DeckSlide {
  id: number;
  n: number;
  heading: string;
  type: 'image' | 'content';
  imageUrl?: string;
  body?: string;
  elements?: SlideElement[];
  extractedText?: string;
  notes?: string;
  title?: string;
  text?: string[];
  visual?: string;
}
