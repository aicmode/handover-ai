"use client";

import { FileText } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { TextArea } from "@/components/ui/Field";

export function BriefSummaryCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Brief Summary"
        description="口頭申し送り用の要約（30〜60秒目安）。患者識別→主病名→直近の変化→現在状態→入力済み医師指示→確認候補の順。編集できます。"
        icon={<FileText size={16} aria-hidden />}
        actions={
          <CopyButton
            text={value}
            label="要約をコピー"
            successMessage="Brief Summaryをコピーしました"
          />
        }
      />
      <CardBody className="space-y-2">
        <TextArea value={value} onChange={onChange} rows={5} />
        <p className="text-[11px] text-fg-muted">
          {value.length}文字（およそ{Math.max(1, Math.round(value.length / 5))}秒）
        </p>
      </CardBody>
    </Card>
  );
}
