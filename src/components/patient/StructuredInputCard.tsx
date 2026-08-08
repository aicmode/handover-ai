"use client";

import { ClipboardList } from "lucide-react";
import { Accordion, CountBadge } from "@/components/ui/Accordion";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import type { StructuredNote, Vitals } from "@/lib/types";

type NoteKey = keyof Omit<StructuredNote, "vitals">;

interface VitalField {
  kind: "vital";
  key: keyof Vitals;
  label: string;
  hint: string;
  placeholder: string;
}

interface NoteField {
  kind: "note";
  key: NoteKey;
  label: string;
  placeholder: string;
  rows?: number;
}

type InputField = VitalField | NoteField;

/**
 * 構造化入力のカテゴリ。
 * 縦に長くなりすぎないよう、カテゴリ単位で開閉できるようにしている。
 */
const SECTIONS: Array<{
  id: string;
  title: string;
  description: string;
  defaultOpen: boolean;
  fields: InputField[];
}> = [
  {
    id: "vitals",
    title: "バイタル・観察",
    description: "体温・血圧・脈拍・SpO2・呼吸数・意識状態・疼痛",
    defaultOpen: true,
    fields: [
      { kind: "vital", key: "temperature", label: "体温", hint: "℃", placeholder: "36.8" },
      { kind: "vital", key: "bloodPressure", label: "血圧", hint: "mmHg", placeholder: "118/62" },
      { kind: "vital", key: "pulse", label: "脈拍", hint: "回/分", placeholder: "88" },
      { kind: "vital", key: "spo2", label: "SpO2", hint: "%", placeholder: "97" },
      { kind: "vital", key: "respiratoryRate", label: "呼吸数", hint: "回/分", placeholder: "18" },
      { kind: "note", key: "consciousness", label: "意識状態", placeholder: "清明 / JCS 0" },
      { kind: "note", key: "pain", label: "疼痛", placeholder: "創部痛 NRS 3" },
    ],
  },
  {
    id: "daily",
    title: "生活状況",
    description: "食事・水分・排泄・睡眠",
    defaultOpen: false,
    fields: [
      { kind: "note", key: "mealIntake", label: "食事摂取量", placeholder: "朝食5割" },
      { kind: "note", key: "fluidIntake", label: "水分摂取", placeholder: "経口 400ml / 点滴 500ml" },
      { kind: "note", key: "elimination", label: "排泄", placeholder: "排尿6回・排便なし" },
      { kind: "note", key: "sleep", label: "睡眠", placeholder: "夜間トイレ3回で中断あり" },
    ],
  },
  {
    id: "treatment",
    title: "治療・処置",
    description: "点滴・内服・処置・検査",
    defaultOpen: false,
    fields: [
      { kind: "note", key: "infusion", label: "点滴", placeholder: "右前腕 末梢ルート 継続中" },
      { kind: "note", key: "medication", label: "内服", placeholder: "カロナール500mg 頓用" },
      { kind: "note", key: "treatment", label: "処置", placeholder: "創部ガーゼ交換" },
      { kind: "note", key: "examination", label: "検査", placeholder: "本日採血・胸部X線予定" },
    ],
  },
  {
    id: "orders",
    title: "指示・連携",
    description: "医師指示・家族対応・その他注意事項",
    defaultOpen: false,
    fields: [
      {
        kind: "note",
        key: "doctorOrder",
        label: "医師指示",
        placeholder: "38.0℃以上でカロナール頓用可",
        rows: 3,
      },
      { kind: "note", key: "family", label: "家族対応", placeholder: "長女が夕方面会予定" },
      { kind: "note", key: "other", label: "その他注意事項", placeholder: "食事はとろみ付き", rows: 3 },
    ],
  },
];

const fieldValue = (value: StructuredNote, field: InputField): string =>
  field.kind === "vital" ? value.vitals[field.key] : value[field.key];

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
    <Card className="flex flex-col">
      <CardHeader
        title="構造化入力"
        description="バイタルと項目別の記録。入力した内容はAI生成の抽出根拠に使われます。カテゴリを開いて入力してください。"
        icon={<ClipboardList size={16} aria-hidden />}
      />
      <CardBody className="space-y-2">
        {SECTIONS.map((section) => {
          const filled = section.fields.filter(
            (field) => fieldValue(value, field).trim().length > 0,
          ).length;

          return (
            <Accordion
              key={section.id}
              title={section.title}
              description={section.description}
              defaultOpen={section.defaultOpen}
              badge={<CountBadge count={filled} total={section.fields.length} />}
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {section.fields.map((field) => (
                  <Field
                    key={field.key}
                    label={field.label}
                    hint={field.kind === "vital" ? field.hint : undefined}
                    className={field.kind === "note" && field.rows ? "sm:col-span-2" : undefined}
                  >
                    {field.kind === "note" && field.rows ? (
                      <TextArea
                        rows={field.rows}
                        value={value[field.key]}
                        placeholder={field.placeholder}
                        onChange={(next) => setNote(field.key, next)}
                      />
                    ) : (
                      <TextInput
                        value={fieldValue(value, field)}
                        placeholder={field.placeholder}
                        onChange={(next) =>
                          field.kind === "vital"
                            ? setVital(field.key, next)
                            : setNote(field.key, next)
                        }
                      />
                    )}
                  </Field>
                ))}
              </div>
            </Accordion>
          );
        })}
      </CardBody>
    </Card>
  );
}
