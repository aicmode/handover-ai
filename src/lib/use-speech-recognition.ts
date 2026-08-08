"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSpeechRecognitionCtor,
  type SpeechRecognitionLike,
} from "./speech-types";
import { useIsClient } from "./use-is-client";

interface UseSpeechRecognitionOptions {
  /** 確定した認識結果を受け取る */
  onFinalResult: (text: string) => void;
  lang?: string;
}

interface UseSpeechRecognitionResult {
  supported: boolean;
  listening: boolean;
  /** 認識途中のテキスト（確定前） */
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed":
    "マイクの使用が許可されていません。ブラウザの設定を確認してください。",
  "service-not-allowed":
    "音声認識サービスを利用できません。ブラウザの設定を確認してください。",
  "no-speech": "音声が検出されませんでした。もう一度お試しください。",
  "audio-capture": "マイクが見つかりません。接続を確認してください。",
  network: "ネットワークエラーにより音声認識を継続できません。",
};

/**
 * Web Speech API による音声入力。
 * SpeechRecognition / webkitSpeechRecognition の双方に対応する。
 * 音声データはブラウザ内で処理され、このアプリのサーバーへは保存も送信もしない。
 */
export function useSpeechRecognition({
  onFinalResult,
  lang = "ja-JP",
}: UseSpeechRecognitionOptions): UseSpeechRecognitionResult {
  const isClient = useIsClient();
  const supported = isClient && getSpeechRecognitionCtor() !== null;

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const manualStopRef = useRef(false);
  const callbackRef = useRef(onFinalResult);

  useEffect(() => {
    callbackRef.current = onFinalResult;
  }, [onFinalResult]);

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText.trim()) {
        callbackRef.current(finalText.trim());
        setInterim("");
      } else {
        setInterim(interimText);
      }
    };

    recognition.onerror = (event) => {
      setError(
        ERROR_MESSAGES[event.error] ??
          `音声認識でエラーが発生しました（${event.error}）`,
      );
      if (event.error !== "no-speech") {
        manualStopRef.current = true;
        setListening(false);
      }
    };

    recognition.onend = () => {
      // continuous でも一定時間で自動終了するため、手動停止でなければ再開する。
      if (!manualStopRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // 再開できない場合は停止扱いにする。
        }
      }
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = recognition;

    return () => {
      manualStopRef.current = true;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // 既に停止している場合は無視する。
      }
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    setError(null);
    manualStopRef.current = false;
    try {
      recognition.start();
    } catch {
      // 既に開始済みの場合は無視する。
    }
    setListening(true);
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    manualStopRef.current = true;
    try {
      recognition.stop();
    } catch {
      // 既に停止している場合は無視する。
    }
    setListening(false);
    setInterim("");
  }, []);

  return { supported, listening, interim, error, start, stop };
}
