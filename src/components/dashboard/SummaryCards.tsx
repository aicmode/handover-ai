import {
  AlertTriangle,
  CircleCheck,
  CircleDashed,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface SummaryItem {
  label: string;
  sublabel: string;
  value: number;
  icon: LucideIcon;
  accent: string;
  valueClass?: string;
}

export function SummaryCards({
  total,
  completed,
  pending,
  attention,
}: {
  total: number;
  completed: number;
  pending: number;
  attention: number;
}) {
  const items: SummaryItem[] = [
    {
      label: "本日の患者数",
      sublabel: "Total Patients",
      value: total,
      icon: Users,
      accent: "text-brand",
    },
    {
      label: "申し送り完了",
      sublabel: "Completed",
      value: completed,
      icon: CircleCheck,
      accent: "text-ok",
    },
    {
      label: "未完了",
      sublabel: "Pending",
      value: pending,
      icon: CircleDashed,
      accent: "text-warn",
    },
    {
      label: "要注意患者",
      sublabel: "High Risk",
      value: attention,
      icon: AlertTriangle,
      accent: "text-danger",
      valueClass: attention > 0 ? "text-danger" : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-card border border-line bg-surface px-4 py-3 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-fg-muted">
                {item.label}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-fg-muted/70">
                {item.sublabel}
              </p>
            </div>
            <item.icon size={18} className={item.accent} aria-hidden />
          </div>
          <p
            className={cn(
              "mt-2 text-3xl font-semibold tabular-nums text-fg",
              item.valueClass,
            )}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
