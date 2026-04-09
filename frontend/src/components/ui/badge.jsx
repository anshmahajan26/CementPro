import { cn } from "@/lib/utils";

export const Badge = ({ className, children }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold tracking-wide",
      className
    )}
  >
    {children}
  </span>
);
