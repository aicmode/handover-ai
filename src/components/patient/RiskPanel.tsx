"use client";

import { ShieldAlert } from "lucide-react";
import { Accordion, CountBadge } from "@/components/ui/Accordion";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { PRIORITY_LEGEND, RiskBadge, riskAccentClass } from "@/components/ui/RiskBadge";
import { risksToText } from "@/lib/format";
import type { RiskItem, RiskLevel } from "@/lib/types";

function RiskCard({ risk }: { risk: RiskItem }) {
  return (
    <li
      className={`rounded border border-line border-l-4 bg-surface-2 px-3 py-2 ${riskAccentClass[risk.level]}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <RiskBadge level={risk.level} />
        <span className="text-sm font-semibold text-fg">{risk.category}</span>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-fg">{risk.detail}</p>
      {risk.evidence.length > 0 ? (
        <p className="mt-1 text-[11px] text-fg-muted">
          入力情報からの抽出根拠: {risk.evidence.join(" / ")}
        </p>
      ) : null}
    </li>
  );
}

export function RiskPanel({ risks }: { risks: RiskItem[] }) {
  const byLevel = (level: RiskLevel) => risks.filter((risk) => risk.level === level);
  const high = byLevel("HIGH");
  const medium = byLevel("MEDIUM");
  const low = byLevel("LOW");

  return (
    <Card>
      <CardHeader
        title="確認優先度（リスク・注意事項）"
        description={`HIGH ${high.length} / MEDIUM ${medium.length} / LOW ${low.length} ｜ ${PRIORITY_LEGEND}`}
        icon={<ShieldAlert size={16} aria-hidden />}
        actions={
          <CopyButton
            text={() => risksToText(risks)}
            label="確認優先度をコピー"
            successMessage="確認優先度の一覧をコピーしました"
          />
        }
      />
      <CardBody className="space-y-3">
        {risks.length === 0 ? (
          <p className="py-4 text-center text-sm text-fg-muted">
            入力情報からは確認候補が抽出されませんでした。
          </p>
        ) : (
          <>
            {high.length > 0 ? (
              <ul className="space-y-2">
                {high.map((risk) => (
                  <RiskCard key={risk.id} risk={risk} />
                ))}
              </ul>
            ) : null}

            {/* 件数が多くなりがちな MEDIUM / LOW は折りたたんで一覧性を保つ。 */}
            {medium.length > 0 ? (
              <Accordion
                title="MEDIUM PRIORITY"
                description="確認優先度 中"
                defaultOpen
                badge={<CountBadge count={medium.length} />}
              >
                <ul className="space-y-2">
                  {medium.map((risk) => (
                    <RiskCard key={risk.id} risk={risk} />
                  ))}
                </ul>
              </Accordion>
            ) : null}

            {low.length > 0 ? (
              <Accordion
                title="LOW PRIORITY"
                description="確認優先度 低"
                badge={<CountBadge count={low.length} />}
              >
                <ul className="space-y-2">
                  {low.map((risk) => (
                    <RiskCard key={risk.id} risk={risk} />
                  ))}
                </ul>
              </Accordion>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}
