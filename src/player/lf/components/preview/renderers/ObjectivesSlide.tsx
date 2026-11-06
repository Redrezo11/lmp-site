import { SlidePreview } from '../../../types/lesson';
import { SlideRenderConfig } from '../../../types/slideRender';
import { inPx, ptToPx, hexColor, BULLET_CHARS } from './constants';
import { renderFormattedInline } from './formatText';

interface Props {
  slide: SlidePreview;
  config: SlideRenderConfig;
}

export function ObjectivesSlide({ slide, config }: Props) {
  const typo = config.slideTypography.objectives;
  const bulletChar = BULLET_CHARS[config.bulletCharacter] || '\u2022';
  const lines = (slide.body || '').split('\n').filter(l => l.trim());

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
          left: inPx(0.8),
          top: inPx(0.5),
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
          color: config.theme.headingFontColor,
          bold: true,
          italic: config.isHeadingItalic,
        })}
      </div>

      {/* Bulleted body */}
      <div
        style={{
          position: 'absolute',
          left: inPx(1.2),
          top: inPx(1.8),
          width: inPx(10.5),
          height: inPx(4.5),
          overflow: 'hidden',
        }}
      >
        {lines.map((line, i) => {
          const cleanLine = line.replace(/^[•►★◆✓—○]\s*/, '');
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: ptToPx(6),
                marginBottom: i < lines.length - 1 ? ptToPx(12) : 0,
                lineHeight: config.lineSpacing,
              }}
            >
              <span
                style={{
                  fontSize: ptToPx(typo.bodySize),
                  fontFamily: config.bodyFont,
                  color: hexColor(config.theme.accentColor),
                  flexShrink: 0,
                  width: ptToPx(typo.bodySize),
                  textAlign: 'center',
                }}
              >
                {bulletChar}
              </span>
              <span>
                {renderFormattedInline(cleanLine, {
                  fontSize: typo.bodySize,
                  fontFamily: config.bodyFont,
                  color: config.theme.bodyFontColor,
                })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
