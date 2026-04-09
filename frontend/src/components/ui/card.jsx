import { cn } from "@/lib/utils";

export const Card = ({ className, ...props }) => (
  <div className={cn("glass animate-soft-pop rounded-2xl border border-border/80 bg-card/90 shadow-[0_16px_44px_rgba(15,23,42,0.12)]", className)} {...props} />
);

export const CardHeader = ({ className, ...props }) => (
  <div className={cn("p-5 pb-0", className)} {...props} />
);

export const CardTitle = ({ className, ...props }) => (
  <h3 className={cn("font-heading text-lg tracking-wide", className)} {...props} />
);

export const CardDescription = ({ className, ...props }) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);

export const CardContent = ({ className, ...props }) => (
  <div className={cn("p-5", className)} {...props} />
);
