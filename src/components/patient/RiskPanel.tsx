"use client";

import { ShieldAlert } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { RiskBadge, riskAccentClass } from "@/components/ui/RiskBadge";
import { risksToText } from "@/lib/format";
import type { RiskItem } from "@/lib/types";

export function RiskPanel({ risks }: { risks: RiskItem[] }) {
  const counts = {
    HIGH: risks.filter((risk) => risk.level === "HIGH").length,
    MEDIUM: risks.filter((risk) => risk.level === "MEDIUM").length,
    LOW: risks.filter((risk) => risk.level === "LOW").length,
  };

  return (
    <Card>
      <CardHeader
        title="リスク・注意事項"
        description={`HIGH ${counts.HIGH} / MEDIUM ${counts.MEDIUM} / LOW ${counts.LOW}`}
        icon={<ShieldAlert size={16} aria-hidden />}
        actions={
          <CopyButton
            text={() => risksToText(risks)}
            label="リスクをコピー"
            successMessage="リスク一覧をコピーしました"
          />
        }
      />
      <CardBody>
        {risks.length === 0 ? (
          <p className="py-4 text-center text-sm text-fg-muted">
            抽出されたリスクはありません。
          </p>
        ) : (
          <ul className="space-y-2">
            {risks.map((risk) => (
              <li
                key={risk.id}
                className={`rounded border border-line border-l-4 bg-surface-2 px-3 py-2 ${riskAccentClass[risk.level]}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge level={risk.level} />
                  <span className="text-sm font-semibold text-fg">
                    {risk.category}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-fg">{risk.detail}</p>
                {risk.evidence.length > 0 ? (
                  <p className="mt-1 text-[11px] text-fg-muted">
                    判定根拠: {risk.evidence.join(" / ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
