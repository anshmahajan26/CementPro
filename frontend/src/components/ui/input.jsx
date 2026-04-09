import { cn } from "@/lib/utils";

export const Input = ({ className, ...props }) => (
  <input
    className={cn(
      "h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent",
      className
    )}
    {...props}
  />
);
