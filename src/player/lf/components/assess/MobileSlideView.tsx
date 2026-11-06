import React, { useRef, useEffect } from 'react';
import { SlidePreview } from '../../types/lesson';
import { SlideRenderConfig } from '../../types/slideRender';
import { parseSlideContent, isArabicText } from '../../utils/slideContent';
import { usePinchZoom } from '../../hooks/usePinchZoom';
import { BULLET_CHARS } from '../preview/renderers/constants';

interface MobileSlideViewProps {
  slide: SlidePreview;
  renderConfig: SlideRenderConfig;
  /** rem font size, owned by the overlay (shared with its A−/A+ buttons) */
  fontSize: number;
  setFontSize: React.Dispatch<React.SetStateAction<number>>;
  rtl?: boolean;
}

/** Inline markdown: ***bold-italic***, **bold**, *italic* — inherits size/colour */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined) parts.push(<strong key={key++}><em>{m[2]}</em></strong>);
    else if (m[3] !== undefined) parts.push(<strong key={key++}>{m[3]}</strong>);
    else if (m[4] !== undefined) parts.push(<em key={key++}>{m[4]}</em>);
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

/**
 * Phone-optimised rendering of a lesson slide: the slide's CONTENT as a
 * normal reflowing document instead of a 1280×720 canvas scaled to ~0.29×
 * (which made hint text ~6px and forced pinch-and-pan).
 */
export function MobileSlideView({ slide, renderConfig, fontSize, setFontSize, rtl }: MobileSlideViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  usePinchZoom(scrollRef, fontSize, setFontSize);

  // New slide → back to the top of the reader
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [slide]);

  const blocks = parseSlideContent(slide);
  const accent = `#${renderConfig?.theme?.accentColor || '4F46E5'}`;
  const bullet = BULLET_CHARS[renderConfig?.bulletCharacter || '2022'] || '•';
  const termStyle = renderConfig?.vocabTermStyle || 'bold';
  const dir = rtl ? 'rtl' : undefined;
  const alignClass = rtl ? 'text-right' : 'text-left';
  const arabicFont = "'Noto Sans Arabic','Segoe UI',Tahoma,sans-serif";

  const blockDir = (text: string) => (rtl || isArabicText(text) ? 'rtl' : undefined);
  const blockClass = (text: string) => (rtl || isArabicText(text) ? 'text-right' : '');
  const blockStyle = (text: string): React.CSSProperties =>
    (rtl || isArabicText(text) ? { fontFamily: arabicFont } : {});

  return (
    <div
      ref={scrollRef}
      className="absolute inset-0 overflow-y-auto bg-white"
      style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
    >
      {/* Heading band — keeps the lesson's visual identity */}
      <div className="px-5 py-4 text-white sticky top-0 z-10" style={{ backgroundColor: accent }}>
        <h2
          className={`font-bold leading-snug ${alignClass}`}
          dir={dir}
          style={{ fontSize: `${fontSize * 1.25}rem`, fontFamily: rtl ? arabicFont : undefined }}
        >
          {renderInline(slide.heading || '')}
        </h2>
      </div>

      <div
        className="max-w-2xl mx-auto px-5 py-5 leading-relaxed text-slate-800"
        style={{ fontSize: `${fontSize}rem`, paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}
      >
        {slide.imageUrl && (
          <img src={slide.imageUrl} alt="" className="w-full rounded-xl mb-4 border border-slate-200" />
        )}

        {blocks.length === 0 && (
          <p className="text-slate-400 italic">This slide has no extra text.</p>
        )}

        {blocks.map((b, i) => {
          switch (b.kind) {
            case 'vocab':
              return (
                <div key={i} className="mb-3 pb-3 border-b border-slate-100 last:border-0">
                  <p
                    className={`${termStyle.includes('bold') ? 'font-bold' : ''} ${termStyle.includes('italic') ? 'italic' : ''} ${termStyle.includes('underline') ? 'underline' : ''}`}
                    style={{ color: accent }}
                  >
                    {renderInline(b.term)}
                  </p>
                  {b.definition && (
                    <p className={`mt-0.5 ${blockClass(b.definition)}`} dir={blockDir(b.definition)} style={blockStyle(b.definition)}>
                      {renderInline(b.definition)}
                    </p>
                  )}
                </div>
              );

            case 'bullet':
              return (
                <div key={i} className={`flex gap-2 mb-3 ${rtl ? 'flex-row-reverse' : ''}`} dir={blockDir(b.text)}>
                  <span className="shrink-0" style={{ color: accent }}>{bullet}</span>
                  <p className={blockClass(b.text)} style={blockStyle(b.text)}>{renderInline(b.text)}</p>
                </div>
              );

            case 'instruction':
              return (
                <p
                  key={i}
                  className={`mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200 font-medium ${blockClass(b.text)}`}
                  dir={blockDir(b.text)}
                  style={blockStyle(b.text)}
                >
                  {renderInline(b.text)}
                </p>
              );

            case 'exerciseItem':
              return (
                <p
                  key={i}
                  className={`mb-2 ${b.indent ? (rtl ? 'mr-5' : 'ml-5') : 'mt-3 font-medium'} ${blockClass(b.text)}`}
                  dir={blockDir(b.text)}
                  style={blockStyle(b.text)}
                >
                  {renderInline(b.text)}
                </p>
              );

            case 'link':
              return (
                <a
                  key={i}
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mb-4 p-3 rounded-lg bg-indigo-50 text-indigo-700 font-medium underline break-words"
                >
                  {b.text}
                </a>
              );

            case 'subtitle':
              return (
                <p key={i} className={`mb-4 text-slate-600 ${blockClass(b.text)}`} dir={blockDir(b.text)} style={blockStyle(b.text)}>
                  {renderInline(b.text)}
                </p>
              );

            default:
              return (
                <p key={i} className={`mb-4 ${blockClass(b.text)}`} dir={blockDir(b.text)} style={blockStyle(b.text)}>
                  {renderInline(b.text)}
                </p>
              );
          }
        })}
      </div>
    </div>
  );
}
