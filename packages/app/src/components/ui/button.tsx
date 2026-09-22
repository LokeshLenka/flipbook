import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow hover:brightness-105",
        secondary:
          "bg-white/[0.07] text-[var(--foreground)] border border-[var(--border)] hover:bg-white/[0.12]",
        ghost: "text-[var(--foreground)] hover:bg-white/[0.08]",
        outline:
          "border border-[var(--border)] bg-transparent hover:bg-white/[0.06] text-[var(--foreground)]",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-[13px]",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
