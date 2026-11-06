import { SlidePreview } from '../../../types/lesson';
import { SlideRenderConfig } from '../../../types/slideRender';
import { inPx, hexColor } from './constants';
import { renderFormattedInline } from './formatText';

interface Props {
  slide: SlidePreview;
  config: SlideRenderConfig;
}

export function TitleSlide({ slide, config }: Props) {
  const typo = config.slideTypography.title;

  return (
    <div style={{ position: 'absolute', inset: 0, backgroundColor: hexColor(config.theme.titleBg) }}>
      {/* Heading */}
      <div
        style={{
          position: 'absolute',
          left: inPx(0.8),
          top: inPx(2.0),
          width: inPx(11.7),
          height: inPx(2.0),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        {renderFormattedInline(slide.heading, {
          fontSize: typo.headingSize,
          fontFamily: config.headingFont,
          color: config.theme.titleFontColor,
          bold: true,
          italic: config.isHeadingItalic,
        })}
      </div>

      {/* Subtitle */}
      {slide.body && (
        <div
          style={{
            position: 'absolute',
            left: inPx(0.8),
            top: inPx(4.2),
            width: inPx(11.7),
            height: inPx(1.0),
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          {renderFormattedInline(slide.body, {
            fontSize: typo.bodySize,
            fontFamily: config.bodyFont,
            color: config.theme.accentColor,
          })}
        </div>
      )}

      {/* Decorative bottom bar */}
      <div
        style={{
          position: 'absolute',
          left: inPx(4.0),
          top: inPx(5.5),
          width: inPx(5.33),
          height: inPx(0.08),
          backgroundColor: hexColor(config.theme.accentColor),
        }}
      />
    </div>
  );
}
