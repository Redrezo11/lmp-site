import { lazy, type ComponentType } from 'react';
import {
  BlockProps, TextBlock, ImageBlock, AudioBlock, VideoBlock, InfoBlock, SummaryBlock,
  MultipleChoiceBlock, MultipleResponseBlock, TrueFalseBlock, FillBlankBlock, MatchingBlock,
  OrderingBlock, ShortAnswerBlock, UnknownBlock,
} from '../player/core/blocks';
// The LessonForge players load only when a LessonForge lesson opens (most of the code)
const LfViewer = lazy(() => import('../player/lf/LfBlocks').then(m => ({ default: m.LfViewer })));
const LfSession = lazy(() => import('../player/lf/LfBlocks').then(m => ({ default: m.LfSession })));

/**
 * Block type → component (website-spec §5). Adding a type = one line here.
 * The four lf.* blocks are the LessonForge players (src/player/lf); they fill
 * the screen, so their lessons are shown without the lesson frame.
 */
export const REGISTRY: Record<string, ComponentType<BlockProps>> = {
  text: TextBlock,
  image: ImageBlock,
  audio: AudioBlock,
  video: VideoBlock,
  info: InfoBlock,
  summary: SummaryBlock,
  'multiple-choice': MultipleChoiceBlock,
  'multiple-response': MultipleResponseBlock,
  'true-false': TrueFalseBlock,
  'fill-blank': FillBlankBlock,
  matching: MatchingBlock,
  ordering: OrderingBlock,
  'short-answer': ShortAnswerBlock,
  'lf.presentation': LfViewer,
  'lf.deck': LfViewer,
  'lf.exercises': LfViewer,
  'lf.student-session': LfSession,
};

/** Block types that take the whole screen (a lesson holding one shows it alone) */
export const FULL_SCREEN_TYPES = new Set(['lf.presentation', 'lf.deck', 'lf.exercises', 'lf.student-session']);

export const componentFor = (type: string): ComponentType<BlockProps> => REGISTRY[type] || UnknownBlock;
