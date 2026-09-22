import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-md border border-paper-line bg-paper px-3 text-base text-paper-ink placeholder:text-paper-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="mb-2.5 block">
    <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-paper-muted">
      {label}
    </span>
    {children}
  </label>
);