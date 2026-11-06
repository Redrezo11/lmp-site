import { ReactNode, CSSProperties } from 'react';
import { ptToPx, hexColor } from './constants';

export interface TextStyle {
  fontSize: number;      // pt
  fontFamily: string;
  color: string;         // 6-digit hex (no #)
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/**
 * Render a single line of text with **bold**, *italic*, ***bold-italic*** markdown.
 * Mirrors parseFormattedText() from pptx.ts but produces React elements.
 */
export function renderFormattedInline(text: string, style: TextStyle): ReactNode {
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  const base: CSSProperties = {
    fontSize: ptToPx(style.fontSize),
    fontFamily: style.fontFamily,
    color: hexColor(style.color),
    fontWeight: style.bold ? 'bold' : 'normal',
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: style.underline ? 'underline' : 'none',
  };

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++} style={base}>{text.slice(lastIndex, match.index)}</span>);
    }
    if (match[2]) {
      // ***bold italic***
      parts.push(<span key={key++} style={{ ...base, fontWeight: 'bold', fontStyle: 'italic' }}>{match[2]}</span>);
    } else if (match[3]) {
      // **bold**
      parts.push(<span key={key++} style={{ ...base, fontWeight: 'bold' }}>{match[3]}</span>);
    } else if (match[4]) {
      // *italic*
      parts.push(<span key={key++} style={{ ...base, fontStyle: 'italic' }}>{match[4]}</span>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={key++} style={base}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? <>{parts}</> : <span style={base}>{text}</span>;
}

/**
 * Render multiline body text as paragraphs with spacing.
 * Each line becomes a div with marginBottom for paraSpaceAfter.
 */
export function renderBody(
  text: string,
  style: TextStyle,
  lineSpacing: number,
  paraSpaceAfter: number, // pt
): ReactNode {
  const lines = text.split('\n').filter(l => l.trim());
  return (
    <>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            lineHeight: lineSpacing,
            marginBottom: i < lines.length - 1 ? ptToPx(paraSpaceAfter) : 0,
          }}
        >
          {renderFormattedInline(line, style)}
        </div>
      ))}
    </>
  );
}
