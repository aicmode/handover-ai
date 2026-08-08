"use client";

import { Layers } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { TextArea } from "@/components/ui/Field";
import { sbarToText } from "@/lib/format";
import type { Sbar } from "@/lib/types";

const SECTIONS: Array<{
  key: keyof Sbar;
  letter: string;
  title: string;
  description: string;
  accent: string;
}> = [
  {
    key: "situation",
    letter: "S",
    title: "Situation",
    description: "現在の状態・今回最も重要な情報",
    accent: "bg-blue-600",
  },
  {
    key: "background",
    letter: "B",
    title: "Background",
    description: "疾患・治療・入院背景",
    accent: "bg-slate-600",
  },
  {
    key: "assessment",
    letter: "A",
    title: "Assessment",
    description: "現在の評価・看護上の問題",
    accent: "bg-amber-600",
  },
  {
    key: "recommendation",
    letter: "R",
    title: "Recommendation",
    description: "次勤務で必要な対応・観察",
    accent: "bg-emerald-700",
  },
];

export function SbarPanel({
  sbar,
  onChange,
}: {
  sbar: Sbar;
  onChange: (next: Sbar) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="SBAR"
        description="各項目は生成後に手動で編集できます。"
        icon={<Layers size={16} aria-hidden />}
        actions={
          <CopyButton
            text={() => sbarToText(sbar)}
            label="SBARをコピー"
            successMessage="SBARをコピーしました"
          />
        }
      />
      <CardBody className="grid gap-3 xl:grid-cols-2">
        {SECTIONS.map((section) => (
          <div
            key={section.key}
            className="rounded border border-line bg-surface-2 p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white ${section.accent}`}
              >
                {section.letter}
              </span>
              <div>
                <p className="text-xs font-semibold text-fg">{section.title}</p>
                <p className="text-[10px] text-fg-muted">{section.description}</p>
              </div>
            </div>
            <TextArea
              value={sbar[section.key]}
              rows={6}
              onChange={(next) => onChange({ ...sbar, [section.key]: next })}
            />
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
