import { SlidePreview } from '../../../types/lesson';
import { SlideRenderConfig } from '../../../types/slideRender';
import { inPx, ptToPx, hexColor } from './constants';
import { renderFormattedInline } from './formatText';

interface Props {
  slide: SlidePreview;
  config: SlideRenderConfig;
}

export function VideoSlide({ slide, config }: Props) {
  const typo = config.slideTypography.video;

  // Parse video title and URL from body (format: "title\nurl")
  const bodyLines = (slide.body || '').split('\n');
  const videoTitle = bodyLines[0] || '';
  const videoUrl = bodyLines[1] || '';

  return (
    <div style={{ position: 'absolute', inset: 0, backgroundColor: hexColor(config.theme.contentBg) }}>
      {/* Heading */}
      <div
        style={{
          position: 'absolute',
          left: inPx(0.8),
          top: inPx(1.0),
          width: inPx(11.7),
          height: inPx(1.2),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
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

      {/* Play button circle */}
      <div
        style={{
          position: 'absolute',
          left: inPx(5.9),
          top: inPx(2.8),
          width: inPx(1.5),
          height: inPx(1.5),
          borderRadius: '50%',
          backgroundColor: hexColor(config.theme.accentColor),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: ptToPx(36),
            color: '#FFFFFF',
            marginLeft: 4, // optical centering for play triangle
          }}
        >
          ▶
        </span>
      </div>

      {/* Video title */}
      <div
        style={{
          position: 'absolute',
          left: inPx(1.5),
          top: inPx(4.8),
          width: inPx(10.3),
          height: inPx(0.8),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        {renderFormattedInline(videoTitle, {
          fontSize: typo.bodySize,
          fontFamily: config.bodyFont,
          color: config.theme.bodyFontColor,
          bold: true,
        })}
      </div>

      {/* Video URL */}
      {videoUrl && (
        <div
          style={{
            position: 'absolute',
            left: inPx(1.5),
            top: inPx(5.5),
            width: inPx(10.3),
            height: inPx(0.6),
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: ptToPx(14),
              fontFamily: config.bodyFont,
              color: hexColor(config.theme.accentColor),
              textDecoration: 'underline',
            }}
          >
            {videoUrl}
          </a>
        </div>
      )}
    </div>
  );
}
