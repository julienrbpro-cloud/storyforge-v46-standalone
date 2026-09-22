import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  track = "dark",
  className,
}: {
  value: number;
  track?: "dark" | "paper";
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn(
        "h-1.5 overflow-hidden rounded-full",
        track === "paper" ? "bg-bar-paper" : "bg-bar",
        className,
      )}
    >
      <i
        className="block h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}