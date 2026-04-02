import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = {
  variant: {
    default: "bg-cyan-300 text-slate-950 hover:bg-cyan-200",
    secondary:
      "border border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10",
    ghost: "text-slate-300 hover:bg-white/8 hover:text-white"
  },
  size: {
    default: "h-10 px-4 py-2 text-sm",
    sm: "h-8 rounded-lg px-3 text-xs",
    lg: "h-11 px-5 text-sm"
  }
} as const;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants.variant;
  size?: keyof typeof buttonVariants.size;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 disabled:pointer-events-none disabled:opacity-50",
          buttonVariants.variant[variant],
          buttonVariants.size[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
