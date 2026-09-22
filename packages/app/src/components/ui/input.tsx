import * as React from "react";
import { cn } from "../../lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-xl border border-[var(--border)] bg-white/[0.06] px-3 py-1 text-sm text-[var(--foreground)] shadow-xs transition-colors placeholder:text-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-40",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
