import { SlidePreview } from '../../../types/lesson';
import { SlideRenderConfig } from '../../../types/slideRender';
import { inPx, hexColor } from './constants';
import { renderFormattedInline, renderBody } from './formatText';

interface Props {
  slide: SlidePreview;
  config: SlideRenderConfig;
}

export function ContentSlide({ slide, config }: Props) {
  const typo = config.slideTypography.content;
  const hasImage = !!(slide.imageUrl && (slide.imageUrl.startsWith('http') || slide.imageUrl.startsWith('/api/images/')));
  const isImageLeft = slide.layout === 'image-left-text-right' && hasImage;

  const textW = hasImage ? 7.0 : 11.7;
  const textX = isImageLeft ? 6.5 : 0.8;
  const imgX = isImageLeft ? 0.5 : 8.2;

  return (
    <div style={{ position: 'absolute', inset: 0, backgroundColor: hexColor(config.theme.contentBg) }}>
      {/* Top accent bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: inPx(13.33),
          height: inPx(0.12),
          backgroundColor: hexColor(config.theme.accentColor),
        }}
      />

      {/* Heading */}
      <div
        style={{
          position: 'absolute',
          left: inPx(textX),
          top: inPx(0.5),
          width: inPx(textW),
          height: inPx(1.0),
          display: 'flex',
          alignItems: 'center',
          textAlign: typo.textAlign,
        }}
      >
        {renderFormattedInline(slide.heading, {
          fontSize: typo.headingSize,
          fontFamily: config.headingFont,
          color: config.theme.headingFontColor,
          bold: true,
          italic: config.isHeadingItalic,
        })}
      </div>

      {/* Body */}
      <div
        style={{
          position: 'absolute',
          left: inPx(textX),
          top: inPx(1.8),
          width: inPx(textW),
          height: inPx(5.0),
          overflow: 'hidden',
        }}
      >
        {slide.body && renderBody(
          slide.body,
          {
            fontSize: typo.bodySize,
            fontFamily: config.bodyFont,
            color: config.theme.bodyFontColor,
          },
          config.lineSpacing,
          8, // paraSpaceAfter for content slides
        )}
      </div>

      {/* Image */}
      {hasImage && (
        <div
          style={{
            position: 'absolute',
            left: inPx(imgX),
            top: inPx(0.8),
            width: inPx(4.8),
            height: inPx(6.0),
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <img
            src={slide.imageUrl}
            alt={slide.heading}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}
    </div>
  );
}
