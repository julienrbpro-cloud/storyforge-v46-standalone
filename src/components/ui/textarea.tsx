import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-24 w-full resize-y rounded-md border border-paper-line bg-paper px-3 py-2 text-base leading-relaxed text-paper-ink placeholder:text-paper-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";