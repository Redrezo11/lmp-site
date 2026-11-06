import { SlidePreview } from '../../../types/lesson';
import { SlideRenderConfig } from '../../../types/slideRender';
import { inPx, ptToPx, hexColor } from './constants';
import { renderFormattedInline } from './formatText';

interface Props {
  slide: SlidePreview;
  config: SlideRenderConfig;
}

export function VocabularySlide({ slide, config }: Props) {
  const typo = config.slideTypography.vocabulary;

  // Parse vocabulary pairs from body text (format: "term: definition" per line)
  const lines = (slide.body || '').split('\n').filter(l => l.trim());
  const pairs = lines.map(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      return { term: line.slice(0, colonIdx).trim(), definition: line.slice(colonIdx + 1).trim() };
    }
    return { term: line, definition: '' };
  });

  // Vocab term styling from design
  const vocabBold = config.vocabTermStyle !== 'italic-underline';
  const vocabItalic = config.vocabTermStyle === 'bold-italic' || config.vocabTermStyle === 'italic-underline';
  const vocabUnderline = config.vocabTermStyle === 'italic-underline';

  // Row height matching pptx.ts: Math.max(0.6, (bodySize * 1.5) / 72 + 0.15)
  const rowH = Math.max(0.6, (typo.bodySize * 1.5) / 72 + 0.15);

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

      {/* Vocabulary table */}
      <div
        style={{
          position: 'absolute',
          left: inPx(0.8),
          top: inPx(1.8),
          width: inPx(11.7),
          overflow: 'hidden',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
          }}
        >
          <colgroup>
            <col style={{ width: inPx(3.5) }} />
            <col style={{ width: inPx(8.2) }} />
          </colgroup>
          <tbody>
            {pairs.map((pair, i) => (
              <tr key={i}>
                <td
                  style={{
                    border: '0.67px solid #E5E7EB',
                    padding: `${ptToPx(3)}px ${ptToPx(5)}px`,
                    height: inPx(rowH),
                    verticalAlign: 'middle',
                  }}
                >
                  {renderFormattedInline(pair.term, {
                    fontSize: typo.bodySize,
                    fontFamily: config.headingFont,
                    color: config.theme.headingFontColor,
                    bold: vocabBold,
                    italic: vocabItalic,
                    underline: vocabUnderline,
                  })}
                </td>
                <td
                  style={{
                    border: '0.67px solid #E5E7EB',
                    padding: `${ptToPx(3)}px ${ptToPx(5)}px`,
                    height: inPx(rowH),
                    verticalAlign: 'middle',
                  }}
                >
                  {renderFormattedInline(pair.definition, {
                    fontSize: typo.bodySize,
                    fontFamily: config.bodyFont,
                    color: config.theme.bodyFontColor,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
