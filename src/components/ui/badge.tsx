import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
  onClick,
}: {
  className?: string;
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const cls = cn(
    "inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-extrabold leading-none",
    className,
  );
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {children}
      </button>
    );
  }
  return <span className={cls}>{children}</span>;
}