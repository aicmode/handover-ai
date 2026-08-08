"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIsClient } from "./use-is-client";

export type SpeechState = "idle" | "speaking" | "paused";

interface UseSpeechSynthesisResult {
  supported: boolean;
  state: SpeechState;
  /** 選択された音声（日本語を優先） */
  voiceName: string | null;
  speak: (text: string) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

const isSupported = (): boolean =>
  typeof window !== "undefined" && "speechSynthesis" in window;

/** ja-JP の音声を優先して選択する。 */
const pickJapaneseVoice = (
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null =>
  voices.find((voice) => voice.lang === "ja-JP") ??
  voices.find((voice) => voice.lang.toLowerCase().startsWith("ja")) ??
  null;

/**
 * Web Speech API（SpeechSynthesis）による読み上げ。
 * speechSynthesis.getVoices() から ja-JP の音声を優先して選択する。
 */
export function useSpeechSynthesis(): UseSpeechSynthesisResult {
  const isClient = useIsClient();
  const supported = isClient && isSupported();

  const [state, setState] = useState<SpeechState>("idle");
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!isSupported()) return;
    const synth = window.speechSynthesis;

    // getVoices() は非同期に読み込まれるブラウザがあるためイベントでも取得する。
    const applyVoices = () => setVoice(pickJapaneseVoice(synth.getVoices()));
    synth.addEventListener("voiceschanged", applyVoices);
    applyVoices();

    return () => {
      synth.removeEventListener("voiceschanged", applyVoices);
      synth.cancel();
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported()) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      const synth = window.speechSynthesis;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(trimmed);
      utterance.lang = voice?.lang ?? "ja-JP";
      if (voice) utterance.voice = voice;
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onend = () => setState("idle");
      utterance.onerror = () => setState("idle");

      utteranceRef.current = utterance;
      synth.speak(utterance);
      setState("speaking");
    },
    [voice],
  );

  const pause = useCallback(() => {
    if (!isSupported()) return;
    window.speechSynthesis.pause();
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    if (!isSupported()) return;
    window.speechSynthesis.resume();
    setState("speaking");
  }, []);

  const cancel = useCallback(() => {
    if (!isSupported()) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setState("idle");
  }, []);

  return {
    supported,
    state,
    voiceName: voice?.name ?? null,
    speak,
    pause,
    resume,
    cancel,
  };
}
