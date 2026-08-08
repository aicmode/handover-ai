"use client";

import { ClipboardList } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import type { StructuredNote, Vitals } from "@/lib/types";

type NoteKey = keyof Omit<StructuredNote, "vitals">;

const VITAL_FIELDS: Array<{ key: keyof Vitals; label: string; hint: string; placeholder: string }> = [
  { key: "temperature", label: "体温", hint: "℃", placeholder: "36.8" },
  { key: "bloodPressure", label: "血圧", hint: "mmHg", placeholder: "118/62" },
  { key: "pulse", label: "脈拍", hint: "回/分", placeholder: "88" },
  { key: "spo2", label: "SpO2", hint: "%", placeholder: "97" },
  { key: "respiratoryRate", label: "呼吸数", hint: "回/分", placeholder: "18" },
];

const NOTE_FIELDS: Array<{ key: NoteKey; label: string; placeholder: string; rows?: number }> = [
  { key: "consciousness", label: "意識状態", placeholder: "清明 / JCS 0" },
  { key: "pain", label: "疼痛", placeholder: "創部痛 NRS 3" },
  { key: "mealIntake", label: "食事摂取量", placeholder: "朝食5割" },
  { key: "fluidIntake", label: "水分摂取", placeholder: "経口 400ml / 点滴 500ml" },
  { key: "elimination", label: "排泄", placeholder: "排尿6回・排便なし" },
  { key: "sleep", label: "睡眠", placeholder: "夜間トイレ3回で中断あり" },
  { key: "infusion", label: "点滴", placeholder: "右前腕 末梢ルート 継続中" },
  { key: "medication", label: "内服", placeholder: "カロナール500mg 頓用" },
  { key: "treatment", label: "処置", placeholder: "創部ガーゼ交換" },
  { key: "examination", label: "検査", placeholder: "本日採血・胸部X線予定" },
  { key: "doctorOrder", label: "医師指示", placeholder: "38.0℃以上でカロナール頓用可", rows: 3 },
  { key: "family", label: "家族対応", placeholder: "長女が夕方面会予定" },
  { key: "other", label: "その他注意事項", placeholder: "食事はとろみ付き", rows: 3 },
];

export function StructuredInputCard({
  value,
  onChange,
}: {
  value: StructuredNote;
  onChange: (next: StructuredNote) => void;
}) {
  const setVital = (key: keyof Vitals, next: string) => {
    onChange({ ...value, vitals: { ...value.vitals, [key]: next } });
  };

  const setNote = (key: NoteKey, next: string) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <Card>
      <CardHeader
        title="構造化入力"
        description="バイタルと項目別の記録。入力した内容はAI生成の判定根拠に使われます。"
        icon={<ClipboardList size={16} aria-hidden />}
      />
      <CardBody className="space-y-4">
        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-fg-muted">
            バイタルサイン
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {VITAL_FIELDS.map((field) => (
              <Field key={field.key} label={field.label} hint={field.hint}>
                <TextInput
                  value={value.vitals[field.key]}
                  placeholder={field.placeholder}
                  onChange={(next) => setVital(field.key, next)}
                />
              </Field>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-fg-muted">
            観察項目
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {NOTE_FIELDS.map((field) => (
              <Field key={field.key} label={field.label}>
                {field.rows ? (
                  <TextArea
                    rows={field.rows}
                    value={value[field.key]}
                    placeholder={field.placeholder}
                    onChange={(next) => setNote(field.key, next)}
                  />
                ) : (
                  <TextInput
                    value={value[field.key]}
                    placeholder={field.placeholder}
                    onChange={(next) => setNote(field.key, next)}
                  />
                )}
              </Field>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
