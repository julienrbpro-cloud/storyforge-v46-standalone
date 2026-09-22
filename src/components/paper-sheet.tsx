import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PaperSheet({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-3 mb-4 flex min-h-0 flex-1 flex-col rounded-2xl bg-cream p-3 text-paper-ink",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TabsBar({
  tabs,
  value,
  onChange,
  tone = "paper",
}: {
  tabs: ReadonlyArray<readonly [string, string]>;
  value: string;
  onChange: (id: string) => void;
  tone?: "paper" | "dark";
}) {
  return (
    <div
      className={cn(
        "mb-3 flex gap-1 overflow-x-auto border-b-2",
        tone === "paper" ? "border-tab-line" : "border-line",
      )}
    >
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={cn(
            "min-h-11 min-w-[72px] flex-1 border-b-[3px] border-transparent px-2 py-2 text-[13px] font-bold whitespace-nowrap transition-colors",
            tone === "paper" ? "text-tab" : "text-muted",
            value === id && (tone === "paper" ? "border-accent text-tab-on" : "border-accent text-accent"),
          )}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}