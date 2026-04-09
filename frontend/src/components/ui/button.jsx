import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(14,165,233,0.35)] hover:-translate-y-0.5 hover:brightness-95",
        outline: "border border-border bg-card/80 hover:bg-muted",
        ghost: "hover:bg-muted/80"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export const Button = ({ className, variant, size, ...props }) => (
  <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
);
