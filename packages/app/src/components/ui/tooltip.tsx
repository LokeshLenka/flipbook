import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../../lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    /** Optional container to render the tooltip into (for fullscreen support) */
    container?: HTMLElement | null;
  }
>(({ className, sideOffset = 6, container, ...props }, ref) => (
  <TooltipPrimitive.Portal container={container ?? undefined}>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-lg border border-[var(--border)] bg-[#20263a] px-2.5 py-1.5 text-xs font-medium text-[#edeff5] shadow-[0_10px_30px_rgba(0,0,0,0.5)]",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
