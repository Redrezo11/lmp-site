import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SlidePreview } from '../../types/lesson';
import { CaptionLine, Exercise, exercisePages } from '../../types/exercise';
import { captionsFor } from '../../utils/captions';

/**
 * Presenter playback — everything about narration, "This slide" / "Play all",
 * language, speed and captions, shared by the desktop presenter
 * (PresentationViewer) and the student phone player (MobilePlayer), so both
 * behave identically. Layout (controls, grid, keyboard, touch) stays in the
 * shells.
 *
 * Rules that must hold (memory: playback_model.md):
 * - stopAudio is TEARDOWN only (navigation, language change, unmount, new
 *   track). The user's pause is pauseAudio: it keeps the element, its
 *   position and audioRef, so RevealOnTime keeps revealed text on screen.
 * - toggleAudio never changes playbackMode; onended reads playbackModeRef.
 * - No exercise/assessment guard in the auto-play effect.
 * - Effect order: language teardown → auto-play → pending "This slide" →
 *   silent advance.
 */

export interface SlideAudioItem {
  slideId: number;
  url: string;
  duration: number;
  /** What the narrator says (student phone shows it as readable text) */
  narration?: string;
  /** Closed captions (exercise explainers) */
  captions?: CaptionLine[];
}

/** An optional exercise explainer shown after the lesson */
export interface ExerciseSlideItem {
  slide: SlidePreview;
  audio?: SlideAudioItem | null;
  audioAr?: SlideAudioItem | null;
}

// Exercise slides sit after the lesson; ids well clear of lesson slide ids
const EXERCISE_ID_BASE = 100000;

export function toExerciseSlides(list: Exercise[]): ExerciseSlideItem[] {
  return list.map((ex, i) => {
    const slideId = EXERCISE_ID_BASE + i;
    return {
      slide: { id: slideId, type: 'image', layout: 'exercise', heading: `Exercise ${i + 1}`, imageUrl: ex.imageUrl, imageUrls: exercisePages(ex) },
      audio: ex.audio ? { slideId, narration: ex.narration, ...ex.audio } : null,
      audioAr: ex.audioAr ? { slideId, narration: ex.narrationAr, ...ex.audioAr } : null,
    };
  });
}

export type PlaybackMode = 'manual' | 'slideshow';
export type Lang = 'en' | 'ar';

// Narration speed: cycles through these; English defaults to 0.9× (the ideal
// EFL pace — OpenAI's speed param is ignored by gpt-4o-mini-tts, so we slow
// playback client-side with pitch preservation), Arabic defaults to 1×.
const RATE_CYCLE = [0.9, 0.8, 0.7, 1];
const DEFAULT_RATES = { en: 0.9, ar: 1 };
const RATES_STORAGE_KEY = 'presenterPlaybackRates';
const CC_STORAGE_KEY = 'presenterCaptions';
const NO_EXERCISES: ExerciseSlideItem[] = [];
// LMP site (website-spec §4, format sheet §7.7 rule 6): Play all moves on from a
// slide with no narration after 5 s everywhere — LessonForge's projector stalls
export const SITE_SILENT_ADVANCE_MS = 5000;

function loadCaptionsOn(): boolean {
  try { return localStorage.getItem(CC_STORAGE_KEY) !== 'off'; } catch { return true; }
}

function loadRates(): { en: number; ar: number } {
  try {
    const saved = JSON.parse(localStorage.getItem(RATES_STORAGE_KEY) || '');
    return {
      en: RATE_CYCLE.includes(saved?.en) ? saved.en : DEFAULT_RATES.en,
      ar: RATE_CYCLE.includes(saved?.ar) ? saved.ar : DEFAULT_RATES.ar,
    };
  } catch { return { ...DEFAULT_RATES }; }
}

export interface PlaybackOptions {
  slides: SlidePreview[];
  slidesAr?: SlidePreview[];
  slideAudio?: SlideAudioItem[];
  slideAudioAr?: SlideAudioItem[];
  /** Play all: move past a slide with no narration after this many ms (Slide Decks) */
  silentAdvanceMs?: number;
  exercises?: ExerciseSlideItem[];
  /** Called on every user action (the desktop shell shows its controls) */
  onInteraction?: () => void;
  /** Keep the caption clock running even with CC off (the phone's narration panel) */
  trackCaptionTime?: boolean;
  /** Caption every narrated clip, timing its narration by length when it has no word-timed track (Slide Decks: a page picture has no text to read along) */
  narrationCaptions?: boolean;
  initialLanguage?: Lang;
}

export function usePresentationPlayback({
  slides, slidesAr, slideAudio, slideAudioAr, silentAdvanceMs = SITE_SILENT_ADVANCE_MS,
  exercises = NO_EXERCISES, onInteraction, trackCaptionTime = false, initialLanguage = 'en', narrationCaptions = false,
}: PlaybackOptions) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('manual');
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [language, setLanguage] = useState<Lang>(initialLanguage);
  const [playbackRates, setPlaybackRates] = useState<{ en: number; ar: number }>(loadRates);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  // What to do once the EN/AR choice is made: start "Play all", or play one slide
  const [pendingAction, setPendingAction] = useState<'slideshow' | 'slide' | null>(null);
  // "This slide" finished on its own — its button offers Replay
  const [slideFinished, setSlideFinished] = useState(false);
  // Play the current slide once a jump / language change has rendered, so the
  // audio URL used is the new slide's (or new language's), not the old one
  const [pendingSlidePlay, setPendingSlidePlay] = useState(false);
  // Closed captions: on by default, remembered on this device
  const [captionsOn, setCaptionsOn] = useState(loadCaptionsOn);
  const [captionTime, setCaptionTime] = useState<number | null>(null);

  // audioRef = the LOADED track (null when torn down — RevealOnTime relies on
  // that). elementRef = the one <audio> element reused for every track: phones
  // (iOS especially) only allow play() on an element a tap has unlocked, so
  // Play all's auto-advance must reuse it rather than create a new one.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const elementRef = useRef<HTMLAudioElement | null>(null);
  // Each track gets a token; late events from an older track are ignored
  const trackRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // onended closures are created once per track — read the CURRENT mode from a
  // ref so pausing/resuming mid-track doesn't act on a stale value
  const playbackModeRef = useRef<PlaybackMode>('manual');
  playbackModeRef.current = playbackMode;
  // Language is asked once per presentation, not on every resume
  const hasChosenLanguageRef = useRef(false);
  const interactionRef = useRef(onInteraction);
  interactionRef.current = onInteraction;
  const interact = useCallback(() => interactionRef.current?.(), []);

  const lessonSlides = language === 'ar' && slidesAr?.length ? slidesAr : slides;
  const lessonAudio = language === 'ar' && slideAudioAr?.length ? slideAudioAr : slideAudio;
  const lessonCount = lessonSlides.length;
  // Exercises follow the lesson. Arabic falls back to English audio, as the
  // lesson does; English never plays Arabic.
  const activeSlides = useMemo(
    () => exercises.length ? [...lessonSlides, ...exercises.map(e => e.slide)] : lessonSlides,
    [lessonSlides, exercises],
  );
  const activeAudio = useMemo(() => {
    const ex = exercises
      .map(e => (language === 'ar' ? e.audioAr || e.audio : e.audio))
      .filter((a): a is SlideAudioItem => !!a);
    if (!ex.length) return lessonAudio;
    return [...(lessonAudio || []), ...ex];
  }, [lessonAudio, exercises, language]);
  const hasArabic = (!!slidesAr && slidesAr.length > 0) || exercises.some(e => e.audioAr);
  const total = activeSlides.length;
  const currentSlide = activeSlides[currentIndex];

  const currentAudio = currentSlide ? activeAudio?.find(a => a.slideId === currentSlide.id) : undefined;
  const currentAudioUrl = currentAudio?.url || null;
  const currentCaptions = useMemo(
    () => (narrationCaptions ? captionsFor(currentAudio) : currentAudio?.captions),
    [narrationCaptions, currentAudio],
  );
  const hasCaptions = !!activeAudio?.some(a => a.captions?.length || (narrationCaptions && a.narration?.trim()));
  const playableSlideIds = useMemo(() => (activeAudio || []).map(a => a.slideId), [activeAudio]);

  // Show toast briefly
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Stop audio — TEARDOWN ONLY (navigation, unmount, before a new track).
  // Never use this for the user's pause: it rewinds, and nulling the ref makes
  // RevealOnTime hide the revealed text.
  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      trackRef.current++; // any late event from this track is now stale
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      // Unload without firing 'error' (setting src='' fires one later, which
      // would land on the NEXT track's handler now that the element is reused)
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
    }
    setIsAudioPlaying(false);
    setSlideFinished(false);
  }, []);

  // True pause: keep the element, its position, and the ref alive so the
  // narration resumes mid-word and the revealed text stays on screen.
  const pauseAudio = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    setIsAudioPlaying(false);
  }, []);

  const resumeAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setIsAudioPlaying(true);
    audio.play().catch(() => {
      setIsAudioPlaying(false);
      showToast('Audio blocked by browser — tap play again');
    });
  }, [showToast]);

  // Play all: move from `fromIndex` to the next slide, or stop the run at the
  // end / at an exercise or assessment slide (the teacher takes over there)
  const advanceSlideshow = useCallback((fromIndex: number) => {
    const nextIndex = fromIndex + 1;
    // The lesson's end: exercises are the teacher's call, not part of the run
    if (fromIndex < lessonCount && nextIndex >= lessonCount && nextIndex < total) {
      setPlaybackMode('manual');
      showToast(`End of the lesson — ${total - lessonCount === 1 ? 'an exercise follows' : 'exercises follow'}`);
      return;
    }
    if (nextIndex >= total) {
      setPlaybackMode('manual');
      showToast('End of presentation');
      return;
    }
    const nextSlide = activeSlides[nextIndex];
    if (nextSlide.type === 'activity' || nextSlide.type === 'assessment') {
      setCurrentIndex(nextIndex);
      setPlaybackMode('manual');
      showToast(nextSlide.type === 'assessment' ? 'Assessment slide — slideshow paused' : 'Exercise slide — slideshow paused');
      return;
    }
    setCurrentIndex(nextIndex);
  }, [total, lessonCount, activeSlides, showToast]);

  // Play audio for current slide
  const playCurrentAudio = useCallback(() => {
    stopAudio();
    if (!currentAudioUrl) return;

    const audio = elementRef.current ?? (elementRef.current = new Audio());
    const token = ++trackRef.current;
    audio.src = currentAudioUrl;
    // Loading a source resets playbackRate to defaultPlaybackRate — set both
    audio.defaultPlaybackRate = playbackRates[language];
    audio.playbackRate = playbackRates[language];
    (audio as any).preservesPitch = true;
    audioRef.current = audio;
    setIsAudioPlaying(true);
    setSlideFinished(false);

    audio.onended = () => {
      if (token !== trackRef.current) return;
      setIsAudioPlaying(false);
      // Play all: auto-advance (read live mode, not the closure's).
      // This slide: stop here and offer Replay.
      if (playbackModeRef.current === 'slideshow') advanceSlideshow(currentIndex);
      else setSlideFinished(true);
    };

    audio.onerror = () => {
      if (token !== trackRef.current) return;
      setIsAudioPlaying(false);
      showToast('Audio failed to load for this slide');
    };

    audio.play().catch((err) => {
      if (token !== trackRef.current || err?.name === 'AbortError') return;
      setIsAudioPlaying(false);
      showToast('Audio blocked by browser — tap play again');
    });
  }, [currentAudioUrl, currentIndex, stopAudio, showToast, playbackRates, language, advanceSlideshow]);

  // Cycle the current language's narration speed; applies live to playing audio
  const cyclePlaybackRate = useCallback(() => {
    setPlaybackRates(prev => {
      const idx = RATE_CYCLE.indexOf(prev[language]);
      const nextRate = RATE_CYCLE[(idx + 1) % RATE_CYCLE.length];
      const next = { ...prev, [language]: nextRate };
      try { localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      if (audioRef.current) {
        audioRef.current.defaultPlaybackRate = nextRate;
        audioRef.current.playbackRate = nextRate;
      }
      return next;
    });
  }, [language]);

  // Switching language invalidates the loaded track — tear it down so a
  // paused narration can never resume in the wrong language. Declared BEFORE
  // the auto-play effect so teardown runs first when both fire together.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    stopAudio();
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-play audio when the slide changes in slideshow mode.
  // NOTE: no exercise/assessment guard here — stopping the run when ARRIVING
  // at such a slide is handled in the onended advance path. Guarding here too
  // made the play button dead on those slides (it re-paused itself instantly).
  useEffect(() => {
    if (playbackMode === 'slideshow' && currentSlide) {
      // Resuming a paused run continues mid-track; a new slide (whose audio was
      // torn down on navigation) starts fresh.
      if (audioRef.current && !audioRef.current.ended) resumeAudio();
      else playCurrentAudio();
    }
  }, [currentIndex, playbackMode, language]); // eslint-disable-line react-hooks/exhaustive-deps

  // "This slide" requested — runs after the teardown/auto-play effects above,
  // once any jump or language change has rendered
  useEffect(() => {
    if (!pendingSlidePlay) return;
    setPendingSlidePlay(false);
    if (!currentAudioUrl) { showToast('No narration on this slide yet'); return; }
    playCurrentAudio();
  }, [pendingSlidePlay, currentIndex, language]); // eslint-disable-line react-hooks/exhaustive-deps

  // Play all over a slide with no narration: move on after a pause instead of
  // stalling — only when the host asks for it (Slide Decks)
  useEffect(() => {
    if (playbackMode !== 'slideshow' || !silentAdvanceMs || !currentSlide || currentAudioUrl) return;
    const timer = setTimeout(() => advanceSlideshow(currentIndex), silentAdvanceMs);
    return () => clearTimeout(timer);
  }, [currentIndex, playbackMode, language, currentAudioUrl, silentAdvanceMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Captions follow the live audio element (so speed changes stay in sync);
  // nothing shows when no narration is loaded or it has finished
  const needCaptionTime = (captionsOn || trackCaptionTime) && !!currentCaptions?.length;
  useEffect(() => {
    if (!needCaptionTime) { setCaptionTime(null); return; }
    const tick = () => {
      const a = audioRef.current;
      setCaptionTime(a && !a.ended ? a.currentTime : null);
    };
    tick();
    const timer = setInterval(tick, 150);
    return () => clearInterval(timer);
  }, [needCaptionTime, currentCaptions]);
  const captionIndex = captionTime === null || !currentCaptions
    ? -1
    : currentCaptions.findIndex(c => captionTime >= c.start && captionTime < c.end);
  const captionText = captionIndex >= 0 ? currentCaptions![captionIndex].text : null;

  const toggleCaptions = useCallback(() => {
    setCaptionsOn(on => {
      try { localStorage.setItem(CC_STORAGE_KEY, on ? 'off' : 'on'); } catch { /* ignore */ }
      return !on;
    });
  }, []);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      clearTimeout(toastTimerRef.current);
    };
  }, [stopAudio]);

  // Navigation
  const goNext = useCallback(() => {
    stopAudio();
    setPlaybackMode('manual');
    setCurrentIndex(i => Math.min(i + 1, total - 1));
    interact();
  }, [total, interact, stopAudio]);

  const goPrev = useCallback(() => {
    stopAudio();
    setPlaybackMode('manual');
    setCurrentIndex(i => Math.max(i - 1, 0));
    interact();
  }, [interact, stopAudio]);

  const goTo = useCallback((index: number) => {
    stopAudio();
    setPlaybackMode('manual');
    setCurrentIndex(Math.max(0, Math.min(index, total - 1)));
    interact();
  }, [total, interact, stopAudio]);

  // "This slide": play one slide's narration without being carried through the
  // rest. Asks EN/AR once per presentation, exactly as "Play all" does.
  const requestSlidePlay = useCallback(() => {
    if (hasArabic && !hasChosenLanguageRef.current) {
      setPendingAction('slide');
      setShowLanguagePicker(true);
      return;
    }
    setPendingSlidePlay(true);
  }, [hasArabic]);

  // Grid ▶: jump to a slide and play just that slide
  const playSlideAt = useCallback((index: number) => {
    goTo(index);
    requestSlidePlay();
  }, [goTo, requestSlidePlay]);

  // Toggle slideshow mode
  const toggleSlideshow = useCallback(() => {
    if (playbackMode === 'slideshow') {
      pauseAudio(); // pause, don't rewind — ▶ resumes mid-track
      setPlaybackMode('manual');
      showToast('Slideshow paused');
    } else if (hasArabic && !hasChosenLanguageRef.current) {
      // Ask for the language ONCE per presentation — not on every resume
      setPendingAction('slideshow');
      setShowLanguagePicker(true);
    } else {
      setPlaybackMode('slideshow');
      showToast('Slideshow started');
    }
    interact();
  }, [playbackMode, pauseAudio, showToast, interact, hasArabic]);

  // Handle language picker selection
  const selectLanguage = useCallback((lang: Lang) => {
    setLanguage(lang);
    hasChosenLanguageRef.current = true; // don't ask again this presentation
    setShowLanguagePicker(false);
    if (pendingAction === 'slideshow') {
      setPlaybackMode('slideshow');
      showToast(lang === 'ar' ? 'بدء العرض' : 'Slideshow started');
    } else if (pendingAction === 'slide') {
      setPendingSlidePlay(true);
    }
    setPendingAction(null);
    interact();
  }, [pendingAction, showToast, interact]);

  const cancelLanguagePicker = useCallback(() => {
    setShowLanguagePicker(false);
    setPendingAction(null);
  }, []);

  const toggleLanguage = useCallback(() => {
    if (!hasArabic) return;
    hasChosenLanguageRef.current = true;
    setLanguage(l => (l === 'en' ? 'ar' : 'en'));
  }, [hasArabic]);

  // Play/pause the current slide's narration. Deliberately does NOT touch
  // playbackMode: pausing during a slideshow just pauses — resuming continues
  // the run because onended still fires and auto-advances.
  const toggleAudio = useCallback(() => {
    if (isAudioPlaying) {
      pauseAudio();
    } else if (audioRef.current && !audioRef.current.ended) {
      resumeAudio(); // live, unfinished element → resume where it stopped
    } else if (playbackModeRef.current === 'slideshow') {
      playCurrentAudio(); // the run's own track
    } else {
      requestSlidePlay(); // "This slide": nothing loaded, or it finished → fresh
    }
    interact();
  }, [isAudioPlaying, pauseAudio, resumeAudio, playCurrentAudio, requestSlidePlay, interact]);

  return {
    // slides
    currentIndex, currentSlide, activeSlides, activeAudio, total, lessonCount, playableSlideIds,
    // audio
    audioRef, currentAudio, currentAudioUrl, isAudioPlaying, slideFinished,
    playbackMode, isSlideshowMode: playbackMode === 'slideshow',
    toggleAudio, toggleSlideshow, playSlideAt,
    goNext, goPrev, goTo,
    // speed
    playbackRate: playbackRates[language], cyclePlaybackRate,
    // language
    language, hasArabic, toggleLanguage, showLanguagePicker, selectLanguage, cancelLanguagePicker,
    // captions
    captionsOn, toggleCaptions, hasCaptions, currentCaptions, captionTime, captionIndex, captionText,
    // toast
    toast, showToast,
  };
}

export type Playback = ReturnType<typeof usePresentationPlayback>;
