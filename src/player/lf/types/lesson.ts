export interface WizardState {
  // Step 1
  topic: string;
  instructions: string;
  
  // Step 2
  gradeLevel: string;
  subject: string;
  region: string;
  
  // Step 3
  includeObjectives: boolean;
  includeVocabulary: boolean;
  includeActivities: boolean;
  includeVideo: boolean;
  slideCount: number;
  
  // Step 4
  theme: string;

  // Settings
  aiModel?: string;
}

export interface VocabItem {
  word: string;
  definition: string;
}

export interface ContentSection {
  heading: string;
  body: string;
  imagePrompt?: string;
}

export interface Activity {
  title: string;
  description: string;
}

export interface VideoSuggestion {
  title: string;
  url: string;
}

export interface PresentationDesign {
  headingFont: string;
  bodyFont: string;
  bulletCharacter: string;
  vocabTermStyle: string;
  headingStyle: string;
}

export interface AssessmentQuestion {
  type: 'multiple-choice' | 'gap-fill';
  questionText: string;      // gap-fill uses _____ for the blank
  options: string[];         // 3-4 for both types; gap-fill: candidate words for the blank (may be empty on legacy assessments)
  correctAnswer: string;     // MCQ: matches one option verbatim; gap-fill: the missing word(s)
  explanation: string;       // English feedback
  explanationArabic: string; // Arabic feedback (authored in Arabic — never translated)
  sourceHeading?: string;    // Heading of the lesson section this question tests (for "view related slide")

  // ── Assisted (bilingual) overlay for concept-check (CCQ) questions ──
  // Students preferred English, so English is the default and this is opt-in:
  // `options`/`correctAnswer` above are ALWAYS English and remain what grading
  // matches. These fields only change what an assist-mode student READS.
  conceptCheck?: boolean;
  questionTextArabic?: string; // the question in Modern Standard Arabic
  optionsArabic?: string[];    // same length and ORDER as `options`
  example?: string;            // the English text under discussion, verbatim (shown in BOTH modes)
}

export interface LessonPlan {
  title: string;
  subject: string;
  gradeLevel: string;
  objectives: string[];
  vocabulary: VocabItem[];
  contentSections: ContentSection[];
  activities: Activity[];
  videoSuggestion: VideoSuggestion | null;
  recap: string[];
  assessment?: AssessmentQuestion[];
  design?: PresentationDesign;
}

export type SlideElementType = 'heading' | 'body' | 'example' | 'rule' | 'term' | 'definition' | 'bullet' | 'instruction' | 'exercise_demo';

export interface SlideElement {
  id: string;
  content: string;
  type: SlideElementType;
  revealGroup?: number; // 0 = always visible, 1+ = progressive reveal order
}

export interface SlidePreview {
  id: number;
  // 'image' = a slide deck page shown as its original picture (Slide Decks)
  type: 'title' | 'objectives' | 'vocabulary' | 'content' | 'video' | 'activity' | 'recap' | 'assessment' | 'end' | 'image';
  heading: string;
  body?: string;
  imageUrl?: string;
  imageUrlHires?: string;
  /** Several pictures on one slide (a multi-page exercise), shown side by side */
  imageUrls?: string[];
  layout?: string;
  activityData?: any;
  elements?: SlideElement[];
}
