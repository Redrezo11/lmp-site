import { QrCode } from 'lucide-react';
import { SlidePreview } from '../../../types/lesson';
import { SlideRenderConfig } from '../../../types/slideRender';
import { inPx, hexColor } from './constants';
import { renderFormattedInline } from './formatText';

interface Props {
  slide: SlidePreview;
  config: SlideRenderConfig;
}

export function AssessmentSlide({ slide, config }: Props) {
  const typo = config.slideTypography.assessment ?? config.slideTypography.activity;

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
          color: 'FFFFFF',
          bold: true,
          italic: config.isHeadingItalic,
        })}
      </div>

      {/* Centered QR cue + instruction */}
      <div
        style={{
          position: 'absolute',
          left: inPx(1.5),
          top: inPx(1.8),
          width: inPx(10.33),
          height: inPx(5.0),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: inPx(0.4),
          textAlign: 'center',
        }}
      >
        <QrCode
          style={{
            width: inPx(1.8),
            height: inPx(1.8),
            color: hexColor(config.theme.accentColor),
          }}
        />
        {slide.body && renderFormattedInline(slide.body, {
          fontSize: typo.bodySize,
          fontFamily: config.bodyFont,
          color: config.theme.bodyFontColor,
        })}
      </div>
    </div>
  );
}
