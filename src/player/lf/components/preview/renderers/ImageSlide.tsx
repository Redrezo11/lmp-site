import { SlidePreview } from '../../../types/lesson';
import { SlideRenderConfig } from '../../../types/slideRender';

/**
 * A slide shown as its original picture(s):
 * - Slide Decks (PDF pages): one picture, letterboxed on black.
 * - Exercise explainers: 1–4 textbook pages on white. Two pages sit side by
 *   side (textbook pages are tall, so a spread fills a widescreen slide);
 *   three or four go in a 2×2 grid.
 * Pictures are never cropped or stretched (object-fit: contain).
 */
export function ImageSlide({ slide }: { slide: SlidePreview; config: SlideRenderConfig }) {
  const exercise = slide.layout === 'exercise';
  const pictures = slide.imageUrls?.length ? slide.imageUrls : slide.imageUrl ? [slide.imageUrl] : [];
  const grid = pictures.length > 2;
  return (
    <div style={{
      width: 1280, height: 720, background: exercise ? '#fff' : '#000',
      display: 'grid', boxSizing: 'border-box', padding: exercise ? 24 : 0, gap: pictures.length > 1 ? 16 : 0,
      gridTemplateColumns: pictures.length > 1 ? '1fr 1fr' : '1fr',
      gridTemplateRows: grid ? '1fr 1fr' : '1fr',
      alignItems: 'center', justifyItems: 'center',
    }}>
      {pictures.length ? pictures.map((url, i) => (
        <img
          key={url + i}
          src={url}
          alt={pictures.length > 1 ? `${slide.heading} — page ${i + 1}` : slide.heading}
          loading="lazy"
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain', minWidth: 0, minHeight: 0 }}
        />
      )) : (
        <span style={{ color: '#94a3b8', fontSize: 32 }}>{slide.heading}</span>
      )}
    </div>
  );
}
