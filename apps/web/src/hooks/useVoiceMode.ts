import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionEvent = {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

type SpeechRecognitionErrorEvent = {
  error: string;
  message?: string;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionInstance)
    | null;
}

/** Pick the best English voice, preferring en-AU, then en-GB, then any en-*. */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  return (
    voices.find((v) => v.lang === "en-AU") ??
    voices.find((v) => v.lang.startsWith("en-") && v.default) ??
    voices.find((v) => v.lang.startsWith("en")) ??
    voices[0]
  );
}

/**
 * Chrome pauses speechSynthesis after ~15 s of continuous speech.
 * Calling pause()+resume() on a short interval works around this.
 */
function startChromePauseWorkaround(): () => void {
  const id = setInterval(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 10_000);
  return () => clearInterval(id);
}

function createUtterance(text: string): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  utterance.rate = 1.05;
  return utterance;
}

export type VoiceModeState = {
  supported: boolean;
  listening: boolean;
  speaking: boolean;
  active: boolean;
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  speak: (text: string) => Promise<void>;
  queueSentence: (text: string) => void;
  markStreamDone: () => void;
  cancelSpeech: () => void;
  /** Pause recognition while external TTS plays */
  stopRecognitionForSpeech: () => void;
  /** Resume recognition after external TTS finishes */
  resumeListening: () => void;
};

/**
 * Wraps the browser's SpeechRecognition (STT) and SpeechSynthesis (TTS) APIs
 * into a single React hook for voice-driven AI chat.
 */
export function useVoiceMode(onFinalTranscript: (text: string) => void): VoiceModeState {
  const [supported] = useState(() => !!getSpeechRecognitionCtor() && "speechSynthesis" in window);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [active, setActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const activeRef = useRef(false);
  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;
  const cleanupWorkaroundRef = useRef<(() => void) | null>(null);

  // Eagerly load voices (Chrome fires onvoiceschanged async)
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.getVoices();
    const handler = () => { window.speechSynthesis.getVoices(); };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", handler);
  }, []);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.abort();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  const startRecognition = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    stopRecognition();

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-AU";

    recognition.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }
      setTranscript(interim || final);
      if (final) {
        setTranscript("");
        setListening(false);
        onFinalRef.current(final.trim());
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(`Speech recognition error: ${e.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      if (activeRef.current) {
        setTimeout(() => {
          if (activeRef.current && !window.speechSynthesis.speaking) {
            startRecognition();
          }
        }, 300);
      }
    };

    recognitionRef.current = recognition;
    setListening(true);
    setError(null);

    try {
      recognition.start();
    } catch {
      setListening(false);
      setError("Could not start microphone. Check permissions.");
    }
  }, [stopRecognition]);

  const cancelSpeech = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string): Promise<void> =>
      new Promise((resolve) => {
        if (!("speechSynthesis" in window)) {
          resolve();
          return;
        }
        window.speechSynthesis.cancel();
        const utterance = createUtterance(text);
        setSpeaking(true);
        utterance.onend = () => {
          setSpeaking(false);
          resolve();
          if (activeRef.current) {
            setTimeout(() => {
              if (activeRef.current) startRecognition();
            }, 200);
          }
        };
        utterance.onerror = () => {
          setSpeaking(false);
          resolve();
        };
        window.speechSynthesis.speak(utterance);
      }),
    [startRecognition],
  );

  const streamDoneRef = useRef(false);
  const queueCountRef = useRef(0);

  const queueSentence = useCallback(
    (text: string) => {
      if (!text.trim() || !("speechSynthesis" in window)) return;
      stopRecognition();
      const utterance = createUtterance(text.trim());
      queueCountRef.current += 1;
      setSpeaking(true);
      utterance.onend = () => {
        queueCountRef.current -= 1;
        if (queueCountRef.current <= 0) {
          queueCountRef.current = 0;
          setSpeaking(false);
          if (streamDoneRef.current && activeRef.current) {
            streamDoneRef.current = false;
            setTimeout(() => {
              if (activeRef.current) startRecognition();
            }, 200);
          }
        }
      };
      utterance.onerror = () => {
        queueCountRef.current -= 1;
        if (queueCountRef.current <= 0) {
          queueCountRef.current = 0;
          setSpeaking(false);
        }
      };
      window.speechSynthesis.speak(utterance);
    },
    [startRecognition, stopRecognition],
  );

  const markStreamDone = useCallback(() => {
    streamDoneRef.current = true;
    if (queueCountRef.current <= 0 && activeRef.current) {
      streamDoneRef.current = false;
      setSpeaking(false);
      setTimeout(() => {
        if (activeRef.current) startRecognition();
      }, 200);
    }
  }, [startRecognition]);

  const stopRecognitionForSpeech = useCallback(() => {
    stopRecognition();
    setSpeaking(true);
  }, [stopRecognition]);

  const resumeListening = useCallback(() => {
    setSpeaking(false);
    if (activeRef.current) {
      startRecognition();
    }
  }, [startRecognition]);

  const start = useCallback(() => {
    setActive(true);
    activeRef.current = true;
    streamDoneRef.current = false;
    queueCountRef.current = 0;
    setError(null);

    // Warm up speechSynthesis on the user gesture so later speak() calls work
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const warmup = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(warmup);
      window.speechSynthesis.cancel();
    }

    cleanupWorkaroundRef.current = startChromePauseWorkaround();
    startRecognition();
  }, [startRecognition]);

  const stop = useCallback(() => {
    setActive(false);
    activeRef.current = false;
    streamDoneRef.current = false;
    queueCountRef.current = 0;
    stopRecognition();
    cancelSpeech();
    setTranscript("");
    cleanupWorkaroundRef.current?.();
    cleanupWorkaroundRef.current = null;
  }, [stopRecognition, cancelSpeech]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      stopRecognition();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      cleanupWorkaroundRef.current?.();
    };
  }, [stopRecognition]);

  return {
    supported, listening, speaking, active, transcript, error,
    start, stop, speak, queueSentence, markStreamDone, cancelSpeech,
    stopRecognitionForSpeech, resumeListening,
  };
}
