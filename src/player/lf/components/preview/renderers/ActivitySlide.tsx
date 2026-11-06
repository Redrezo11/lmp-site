import { SlidePreview } from '../../../types/lesson';
import { SlideRenderConfig } from '../../../types/slideRender';
import { inPx, hexColor } from './constants';
import { renderFormattedInline, renderBody } from './formatText';

interface Props {
  slide: SlidePreview;
  config: SlideRenderConfig;
}

export function ActivitySlide({ slide, config }: Props) {
  const typo = config.slideTypography.activity;

  return (
    <div style={{ position: 'absolute', inset: 0, backgroundColor: hexColor(config.theme.contentBg) }}>
      {/* Accent header bar (1.2" tall) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: inPx(13.33),
          height: inPx(1.2),
          backgroundColor: hexColor(config.theme.accentColor),
        }}
      />

      {/* Heading (white text inside the header bar) */}
      <div
        style={{
          position: 'absolute',
          left: inPx(0.8),
          top: inPx(0.1),
          width: inPx(11.7),
          height: inPx(1.0),
          display: 'flex',
          alignItems: 'center',
          textAlign: typo.textAlign,
        }}
      >
        {renderFormattedInline(slide.heading, {
          fontSize: typo.headingSize,
          fontFamily: config.headingFont,
          color: 'FFFFFF', // White text on accent bar
          bold: true,
          italic: config.isHeadingItalic,
        })}
      </div>

      {/* Body */}
      <div
        style={{
          position: 'absolute',
          left: inPx(0.8),
          top: inPx(1.6),
          width: inPx(11.7),
          height: inPx(5.2),
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
          8, // paraSpaceAfter for activity slides
        )}
      </div>
    </div>
  );
}
