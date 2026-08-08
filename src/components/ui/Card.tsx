import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-card border border-line bg-surface shadow-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  icon,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-brand">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-wide text-fg">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("px-4 py-4", className)}>{children}</div>;
}
