"use client";

import { useState } from "react";
import { Pause, Play, Square, Volume2, VolumeX } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { sbarToSpeechText } from "@/lib/format";
import { useIsClient } from "@/lib/use-is-client";
import { useSpeechSynthesis } from "@/lib/use-speech-synthesis";
import type { Sbar } from "@/lib/types";

type Target = "summary" | "sbar";

export function SpeechPanel({
  briefSummary,
  sbar,
}: {
  briefSummary: string;
  sbar: Sbar;
}) {
  const isClient = useIsClient();
  const { supported, state, voiceName, speak, pause, resume, cancel } =
    useSpeechSynthesis();
  const [target, setTarget] = useState<Target>("summary");

  const text = target === "summary" ? briefSummary : sbarToSpeechText(sbar);

  // ハイドレーション前は対応可否を判定できないため、非対応表示を出さない。
  if (isClient && !supported) {
    return (
      <Card>
        <CardHeader title="音声読み上げ" icon={<VolumeX size={16} aria-hidden />} />
        <CardBody>
          <p className="text-sm text-fg-muted">
            このブラウザでは音声読み上げを利用できません。
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="音声読み上げ"
        description={
          voiceName ? `使用中の音声: ${voiceName}` : "日本語音声が見つかりません（既定の音声を使用）"
        }
        icon={<Volume2 size={16} aria-hidden />}
        actions={
          <div className="flex gap-1">
            {(
              [
                { id: "summary" as Target, label: "Brief Summary" },
                { id: "sbar" as Target, label: "SBAR全文" },
              ]
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  cancel();
                  setTarget(option.id);
                }}
                className={
                  target === option.id
                    ? "rounded border border-brand bg-brand px-2.5 py-1 text-xs font-medium text-brand-fg"
                    : "rounded border border-line-strong px-2.5 py-1 text-xs font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => speak(text)}
            disabled={!text.trim()}
          >
            <Play size={14} aria-hidden />
            読み上げ開始
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={pause}
            disabled={state !== "speaking"}
          >
            <Pause size={14} aria-hidden />
            一時停止
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={resume}
            disabled={state !== "paused"}
          >
            <Play size={14} aria-hidden />
            再開
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={cancel}
            disabled={state === "idle"}
          >
            <Square size={14} aria-hidden />
            停止
          </Button>
          <span className="text-xs text-fg-muted">
            状態:{" "}
            {state === "speaking" ? "読み上げ中" : state === "paused" ? "一時停止" : "待機"}
          </span>
        </div>
        <p className="max-h-24 overflow-y-auto rounded border border-line bg-surface-2 px-3 py-2 text-xs leading-relaxed text-fg-muted">
          {text.trim() || "読み上げる内容がありません。先にAI生成を実行してください。"}
        </p>
      </CardBody>
    </Card>
  );
}
