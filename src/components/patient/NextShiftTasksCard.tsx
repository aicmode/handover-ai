"use client";

import { ListChecks } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { tasksToText } from "@/lib/format";
import type { NextShiftTask } from "@/lib/types";

export function NextShiftTasksCard({
  tasks,
  onToggle,
}: {
  tasks: NextShiftTask[];
  onToggle: (id: string, done: boolean) => void;
}) {
  const done = tasks.filter((task) => task.done).length;

  return (
    <Card>
      <CardHeader
        title="次勤務への観察項目"
        description={`${done} / ${tasks.length} 件チェック済み`}
        icon={<ListChecks size={16} aria-hidden />}
        actions={
          <CopyButton
            text={() => tasksToText(tasks)}
            label="観察項目をコピー"
            successMessage="次勤務への観察項目をコピーしました"
          />
        }
      />
      <CardBody>
        {tasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-fg-muted">
            観察項目はまだ生成されていません。
          </p>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map((task) => (
              <li key={task.id}>
                <label className="flex cursor-pointer items-start gap-2.5 rounded border border-line bg-surface-2 px-3 py-2 transition-colors hover:border-line-strong">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={(event) => onToggle(task.id, event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        task.done
                          ? "block text-sm text-fg-muted line-through"
                          : "block text-sm text-fg"
                      }
                    >
                      {task.label}
                    </span>
                  </span>
                  <RiskBadge level={task.priority} className="shrink-0" />
                </label>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
