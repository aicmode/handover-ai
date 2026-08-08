"use client";

import { NotebookPen, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { VoiceInputButton } from "./VoiceInputButton";

const PLACEHOLDER =
  "例）昨夜38.2℃の発熱あり。カロナール内服後、今朝36.8℃まで解熱。夜間トイレ3回あり、立位時ふらつきあり。朝食5割摂取。右前腕より点滴継続中。";

export function HandoverInputCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const appendTranscript = (text: string) => {
    onChange(value ? `${value.replace(/\s*$/, "")} ${text}` : text);
  };

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Handover Input — 自由記載"
        description="勤務中の経過を自由に記載してください。構造化入力と併用できます。"
        icon={<NotebookPen size={16} aria-hidden />}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            disabled={!value}
          >
            <Trash2 size={14} aria-hidden />
            クリア
          </Button>
        }
      />
      <CardBody className="flex flex-1 flex-col gap-3">
        <TextArea
          value={value}
          onChange={onChange}
          rows={7}
          placeholder={PLACEHOLDER}
          className="min-h-40 flex-1"
        />
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <VoiceInputButton onAppend={appendTranscript} />
            <span className="text-[11px] text-fg-muted">{value.length}文字</span>
          </div>
          {/*
            ブラウザのSpeechRecognition実装によっては、音声がブラウザ／外部の
            音声認識サービス側で処理される場合がある。実在患者の情報は入力しない。
          */}
          <p className="rounded border border-line bg-surface-2 px-2.5 py-1.5 text-[11px] leading-relaxed text-fg-muted">
            音声入力は本アプリのサーバーへ保存されませんが、ブラウザの実装によっては音声認識がブラウザまたは外部サービス側で処理される場合があります。デモでは架空情報のみ使用してください。
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
