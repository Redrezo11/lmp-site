import React, { useEffect, useRef, useMemo } from 'react';
import { SlidePreview, SlideElement } from '../../types/lesson';
import { SlideRenderConfig } from '../../types/slideRender';
import { SlideCanvas } from './SlideCanvas';
import { loadFonts, fontFamily } from '../../utils/fontLoader';
import { RevealOnTime, AlwaysVisible } from '../present/RevealOnTime';
import { renderFormattedInline } from './renderers/formatText';
import { SlideTimingCoordinator } from '../present/SlideTimingCoordinator';
import { useWordIndex } from '../present/useWordIndex';
import { useAnnotations, AnnotationTiming } from '../present/useAnnotations';
import {
  TitleSlide, ObjectivesSlide, VocabularySlide, ContentSlide,
  ActivitySlide, VideoSlide, RecapSlide, AssessmentSlide, EndSlide,
} from './renderers';
import { ImageSlide } from './renderers/ImageSlide';

export interface ElementTimingData {
  elementId: string;
  showAt: number;
}

export interface AnnotationTimingData {
  type: 'highlight' | 'underline' | 'color' | 'strike' | 'clear' | 'label';
  elementId: string;
  targetText?: string;
  color?: string;
  labelText?: string;
  showAt: number;
  hideAt?: number;
}

interface SlideViewerProps {
  slide: SlidePreview;
  renderConfig: SlideRenderConfig;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  elementTimings?: ElementTimingData[];
  annotationTimings?: AnnotationTimingData[];
  isAudioPlaying?: boolean;
}

type RendererComponent = React.FC<{ slide: SlidePreview; config: SlideRenderConfig }>;

const RENDERERS: Record<string, RendererComponent> = {
  title: TitleSlide,
  objectives: ObjectivesSlide,
  vocabulary: VocabularySlide,
  content: ContentSlide,
  activity: ActivitySlide,
  video: VideoSlide,
  recap: RecapSlide,
  assessment: AssessmentSlide,
  end: EndSlide,
  image: ImageSlide,
};

/** Client-side fallback: build elements from body string if not stored on slide */
function buildElementsFallback(slide: SlidePreview): SlideElement[] {
  const elements: SlideElement[] = [
    { id: 'heading', content: slide.heading, type: 'heading', revealGroup: 0 },
  ];
  if (!slide.body) return elements;

  if (slide.type === 'vocabulary') {
    const lines = slide.body.split('\n').filter(l => l.trim());
    lines.forEach((line, i) => {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        elements.push({ id: `vocab_term_${i+1}`, content: line.slice(0, colonIdx).trim(), type: 'term', revealGroup: i+1 });
        elements.push({ id: `vocab_def_${i+1}`, content: line.slice(colonIdx+1).trim(), type: 'definition', revealGroup: i+1 });
      } else {
        elements.push({ id: `vocab_item_${i+1}`, content: line.trim(), type: 'body', revealGroup: i+1 });
      }
    });
  } else if (slide.type === 'objectives' || slide.type === 'recap') {
    const lines = slide.body.split('\n').filter(l => l.trim());
    lines.forEach((line, i) => {
      elements.push({ id: `bullet_${i+1}`, content: line.replace(/^[•·\-]\s*/, '').trim(), type: 'bullet', revealGroup: i+1 });
    });
  } else if (slide.type === 'title' || slide.type === 'end') {
    elements.push({ id: 'subtitle', content: slide.body, type: 'body', revealGroup: 0 });
  } else if (slide.type === 'assessment') {
    elements.push({ id: 'instruction', content: slide.body, type: 'instruction', revealGroup: 0 });
  } else {
    let paragraphs = slide.body.split(/\n\n+/).filter(p => p.trim());
    if (paragraphs.length <= 1) paragraphs = slide.body.split('\n').filter(p => p.trim());
    paragraphs.forEach((p, i) => {
      elements.push({ id: `body_${i+1}`, content: p.trim(), type: 'body', revealGroup: i+1 });
    });
  }
  return elements;
}

export function SlideViewer({ slide, renderConfig, audioRef, elementTimings, annotationTimings, isAudioPlaying }: SlideViewerProps) {
  // Resolve font families with Google Fonts fallbacks
  const config: SlideRenderConfig = {
    ...renderConfig,
    headingFont: fontFamily(renderConfig.headingFont),
    bodyFont: fontFamily(renderConfig.bodyFont),
  };

  useEffect(() => {
    loadFonts([renderConfig.headingFont, renderConfig.bodyFont]);
  }, [renderConfig.headingFont, renderConfig.bodyFont]);

  const Renderer = RENDERERS[slide.type] || ContentSlide;

  // Progressive reveal: if timings exist, use structured overlay (elements start hidden, reveal with audio)
  // Build elements client-side as fallback if not stored on the slide
  const resolvedElements = slide.elements || (elementTimings && elementTimings.length > 0 ? buildElementsFallback(slide) : undefined);
  const useReveal = resolvedElements && elementTimings && elementTimings.length > 0 && audioRef;

  return (
    <SlideCanvas className="rounded-xl shadow-lg border border-gray-200">
      {/* Always render the base slide */}
      <div style={useReveal ? { visibility: 'hidden', position: 'absolute' } : undefined}>
        <Renderer slide={slide} config={config} />
      </div>

      {/* Overlay: structured elements with progressive reveal */}
      {useReveal && resolvedElements && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
          <StructuredSlide
            elements={resolvedElements}
            elementTimings={elementTimings!}
            annotationTimings={annotationTimings}
            audioRef={audioRef!}
            config={config}
            slideType={slide.type}
          />
        </div>
      )}
    </SlideCanvas>
  );
}

/** Renders slide elements with RevealOnTime wrappers + annotations */
function StructuredSlide({
  elements, elementTimings, annotationTimings, audioRef, config, slideType,
}: {
  elements: SlideElement[];
  elementTimings: ElementTimingData[];
  annotationTimings?: AnnotationTimingData[];
  audioRef: React.RefObject<HTMLAudioElement | null>;
  config: SlideRenderConfig;
  slideType: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wordIndexRef = useWordIndex(containerRef);

  // Set up annotation coordinator
  const coordinator = useMemo(() => {
    if (!audioRef) return null;
    return new SlideTimingCoordinator(audioRef);
  }, [audioRef]);

  // Start/stop coordinator based on audio state
  useEffect(() => {
    if (!coordinator) return;
    coordinator.start();
    return () => coordinator.destroy();
  }, [coordinator]);

  // Register annotations with coordinator
  const annoTimings: AnnotationTiming[] = useMemo(() => {
    if (!annotationTimings) return [];
    return annotationTimings.map(a => ({
      type: a.type,
      elementId: a.elementId,
      targetText: a.targetText,
      color: a.color,
      labelText: a.labelText,
      showAt: a.showAt,
      hideAt: a.hideAt,
    }));
  }, [annotationTimings]);

  useAnnotations(coordinator, annoTimings, wordIndexRef, containerRef);
  const typography = config.slideTypography?.[slideType] || config.slideTypography?.content;
  const headingSize = typography?.headingSize || 32;
  const bodySize = typography?.bodySize || 18;

  // Consistent light background across all slides — no color inversion between title/content
  const bg = `#${config.theme.contentBg}`;
  const textColor = `#${config.theme.bodyFontColor}`;
  const headingColor = `#${config.theme.headingFontColor}`;

  return (
    <div ref={containerRef} style={{
      position: 'relative',
      padding: '48px 77px',
      fontFamily: config.bodyFont,
      color: textColor,
      backgroundColor: bg,
      height: '100%',
    }}>
      {elements.map(el => {
        const timing = elementTimings.find(t => t.elementId === el.id);
        const isAlwaysVisible = el.revealGroup === 0 || el.revealGroup === undefined;
        const style = getElementStyle(el, config, headingSize, bodySize, headingColor, textColor);

        // Render with markdown formatting (bold/italic)
        const textStyle = { color: style.color || textColor, fontSize: style.fontSize };
        const content = (
          <div key={el.id} style={style}>
            {renderFormattedInline(el.content, textStyle as any)}
          </div>
        );

        if (isAlwaysVisible || !timing) {
          return <AlwaysVisible key={el.id}>{content}</AlwaysVisible>;
        }

        return (
          <RevealOnTime key={el.id} time={timing.showAt} audioRef={audioRef}>
            {content}
          </RevealOnTime>
        );
      })}
    </div>
  );
}

function getElementStyle(el: SlideElement, config: SlideRenderConfig, headingSize: number, bodySize: number, headingColor: string, textColor: string): React.CSSProperties {
  switch (el.type) {
    case 'heading':
      return {
        fontFamily: config.headingFont,
        fontSize: headingSize * 1.333,
        fontWeight: 'bold',
        color: headingColor,
        marginBottom: 16,
        fontStyle: config.isHeadingItalic ? 'italic' : 'normal',
      };
    case 'term':
      return {
        fontSize: bodySize * 1.333,
        fontWeight: 'bold',
        display: 'inline',
        marginRight: 8,
      };
    case 'definition':
      return {
        fontSize: bodySize * 1.333,
        display: 'inline',
        marginBottom: 8,
      };
    case 'bullet':
      return {
        fontSize: bodySize * 1.333,
        marginBottom: 6,
        paddingLeft: 20,
      };
    case 'example':
      return {
        fontSize: bodySize * 1.333,
        fontStyle: 'italic',
        color: `#${config.theme.accentColor}`,
        marginBottom: 8,
        paddingLeft: 16,
        borderLeft: `3px solid #${config.theme.accentColor}`,
      };
    case 'instruction':
      return {
        fontSize: bodySize * 1.333,
        fontStyle: 'italic',
        marginBottom: 12,
      };
    default:
      return {
        fontSize: bodySize * 1.333,
        marginBottom: 8,
        lineHeight: config.lineSpacing || 1.4,
      };
  }
}
