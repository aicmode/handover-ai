/**
 * Web Speech API（音声認識）の型定義。
 * `SpeechRecognition` は標準の lib.dom.d.ts に含まれないため、
 * 必要な範囲だけを独自に定義する。
 */

export interface SpeechRecognitionResultEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message?: string;
}

export interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechCapableWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

/** ブラウザが提供する SpeechRecognition コンストラクタを取得する。 */
export const getSpeechRecognitionCtor = ():
  | SpeechRecognitionConstructor
  | null => {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as SpeechCapableWindow;
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
};
