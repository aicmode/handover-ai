"use client";

import { Mic, MicOff, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useIsClient } from "@/lib/use-is-client";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";

/**
 * 音声入力ボタン。
 * 認識結果はテキストエリアへ追記され、音声データはサーバーへ送信・保存されない。
 */
export function VoiceInputButton({
  onAppend,
}: {
  onAppend: (text: string) => void;
}) {
  const isClient = useIsClient();
  const { supported, listening, interim, error, start, stop } =
    useSpeechRecognition({ onFinalResult: onAppend });

  // ハイドレーション前は対応可否を判定できないため、無効状態のボタンを表示する。
  if (!isClient) {
    return (
      <Button type="button" variant="secondary" size="sm" disabled>
        <Mic size={14} aria-hidden />
        音声入力を開始
      </Button>
    );
  }

  if (!supported) {
    return (
      <div className="flex items-center gap-2 rounded border border-line-strong bg-surface-2 px-2.5 py-1.5 text-xs text-fg-muted">
        <MicOff size={14} aria-hidden />
        このブラウザでは音声入力を利用できません
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {listening ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
            録音中 — 話してください
          </span>
          <Button type="button" variant="danger" size="sm" onClick={stop}>
            <Square size={13} aria-hidden />
            停止
          </Button>
        </>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={start}>
          <Mic size={14} aria-hidden />
          音声入力を開始
        </Button>
      )}

      {interim ? (
        <span className="max-w-full truncate rounded bg-surface-2 px-2 py-1 text-xs text-fg-muted">
          認識中: {interim}
        </span>
      ) : null}

      {error ? (
        <span className="text-xs text-danger" role="status">
          {error}
        </span>
      ) : null}
    </div>
  );
}
