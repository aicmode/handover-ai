"use client";

import { ListChecks } from "lucide-react";
import { Accordion, CountBadge } from "@/components/ui/Accordion";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { PRIORITY_LEGEND, RiskBadge } from "@/components/ui/RiskBadge";
import { tasksToText } from "@/lib/format";
import type { NextShiftTask } from "@/lib/types";

function TaskList({
  tasks,
  onToggle,
}: {
  tasks: NextShiftTask[];
  onToggle: (id: string, done: boolean) => void;
}) {
  return (
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
  );
}

export function NextShiftTasksCard({
  tasks,
  onToggle,
}: {
  tasks: NextShiftTask[];
  onToggle: (id: string, done: boolean) => void;
}) {
  const done = tasks.filter((task) => task.done).length;
  const high = tasks.filter((task) => task.priority === "HIGH");
  const medium = tasks.filter((task) => task.priority === "MEDIUM");
  const other = tasks.filter((task) => task.priority === "LOW");

  return (
    <Card>
      <CardHeader
        title="次勤務への観察項目（確認候補）"
        description={`${done} / ${tasks.length} 件チェック済み ｜ ${PRIORITY_LEGEND}`}
        icon={<ListChecks size={16} aria-hidden />}
        actions={
          <CopyButton
            text={() => tasksToText(tasks)}
            label="観察項目をコピー"
            successMessage="次勤務への観察項目をコピーしました"
          />
        }
      />
      <CardBody className="space-y-3">
        {tasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-fg-muted">
            観察項目はまだ生成されていません。
          </p>
        ) : (
          <>
            {high.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-danger">
                  High Priority
                </p>
                <TaskList tasks={high} onToggle={onToggle} />
              </div>
            ) : null}

            {medium.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-warn">
                  Medium Priority
                </p>
                <TaskList tasks={medium} onToggle={onToggle} />
              </div>
            ) : null}

            {other.length > 0 ? (
              <Accordion
                title="OTHER"
                description="確認優先度 低（基本的な観察項目）"
                defaultOpen={high.length === 0 && medium.length === 0}
                badge={<CountBadge count={other.length} />}
              >
                <TaskList tasks={other} onToggle={onToggle} />
              </Accordion>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}
