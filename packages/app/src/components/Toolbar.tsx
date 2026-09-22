import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Expand,
  GripVertical,
  Printer,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface Props {
  page: number; // 0-based from engine
  pages: number;
  busy: boolean;
  onPrev: () => void;
  onNext: () => void;
  onFastPrev: () => void;
  onFastNext: () => void;
  onGoTo: (page1Based: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onFull: () => void;
  onPrint: () => void;
  onDownload: () => void;
  /** Container to render tooltips into (for fullscreen support) */
  tooltipContainer?: HTMLElement | null;
}

function Tip({ label, children, container }: { label: string; children: React.ReactNode; container?: HTMLElement | null }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" container={container}>{label}</TooltipContent>
    </Tooltip>
  );
}

function Grip({ side, container }: { side: "left" | "right"; container?: HTMLElement | null }) {
  return (
    <Tip label="Drag to move bar" container={container}>
      <span
        data-grip={side}
        className="flex cursor-grab items-center text-[var(--muted)] active:cursor-grabbing"
      >
        <GripVertical size={15} />
      </span>
    </Tip>
  );
}

export default function Toolbar(p: Props) {
  const current = p.pages > 0 ? p.page + 1 : 0;

  const go = (value: string) => {
    const n = parseInt(value, 10);
    if (Number.isFinite(n)) p.onGoTo(n);
  };

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1 rounded-full border border-[var(--border)] bg-[#141824]/85 px-2.5 py-1.5 shadow-[0_16px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      role="toolbar"
      aria-label="Reader controls"
    >
      <Grip side="left" container={p.tooltipContainer} />

      <div className="flex items-center gap-0.5">
        <Tip label="10 pages back" container={p.tooltipContainer}>
          <Button variant="ghost" size="icon-sm" aria-label="10 pages back" onClick={p.onFastPrev} disabled={p.busy}>
            <ChevronsLeft />
          </Button>
        </Tip>
        <Tip label="Previous page" container={p.tooltipContainer}>
          <Button variant="ghost" size="icon-sm" aria-label="Previous page" onClick={p.onPrev} disabled={p.busy}>
            <ChevronLeft />
          </Button>
        </Tip>
        <Tip label="Current page — type a number, Enter to jump" container={p.tooltipContainer}>
          <div className="flex items-center gap-1.5 px-2">
            <Input
              key={`${current}-${p.pages}`}
              className="h-8 w-13 text-center tabular-nums"
              defaultValue={current || ""}
              inputMode="numeric"
              aria-label="Go to page"
              onKeyDown={(e) => {
                if (e.key === "Enter") go((e.target as HTMLInputElement).value);
              }}
              onBlur={(e) => {
                if (e.target.value !== String(current)) go(e.target.value);
              }}
            />
            <span className="text-[13px] text-[var(--muted)]">/</span>
            <span className="text-[13px] text-[var(--muted)] tabular-nums">{p.pages || "–"}</span>
          </div>
        </Tip>
        <Tip label="Next page" container={p.tooltipContainer}>
          <Button variant="ghost" size="icon-sm" aria-label="Next page" onClick={p.onNext} disabled={p.busy}>
            <ChevronRight />
          </Button>
        </Tip>
        <Tip label="10 pages forward" container={p.tooltipContainer}>
          <Button variant="ghost" size="icon-sm" aria-label="10 pages forward" onClick={p.onFastNext} disabled={p.busy}>
            <ChevronsRight />
          </Button>
        </Tip>
      </div>

      <div className="h-5 w-px bg-[var(--border)]" />

      <div className="flex items-center gap-0.5">
        <Tip label="Zoom out" container={p.tooltipContainer}>
          <Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={p.onZoomOut} disabled={p.busy}>
            <ZoomOut />
          </Button>
        </Tip>
        <Tip label="Fit view" container={p.tooltipContainer}>
          <Button variant="ghost" size="icon-sm" aria-label="Fit view" onClick={p.onFit} disabled={p.busy}>
            <RotateCcw />
          </Button>
        </Tip>
        <Tip label="Zoom in" container={p.tooltipContainer}>
          <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={p.onZoomIn} disabled={p.busy}>
            <ZoomIn />
          </Button>
        </Tip>
      </div>

      <div className="h-5 w-px bg-[var(--border)]" />

      <div className="flex items-center gap-0.5">
        <Tip label="Download PDF" container={p.tooltipContainer}>
          <Button variant="ghost" size="icon-sm" aria-label="Download PDF" onClick={p.onDownload}>
            <Download />
          </Button>
        </Tip>
        <Tip label="Print" container={p.tooltipContainer}>
          <Button variant="ghost" size="icon-sm" aria-label="Print" onClick={p.onPrint} disabled={p.busy}>
            <Printer />
          </Button>
        </Tip>
        <Tip label="Fullscreen" container={p.tooltipContainer}>
          <Button variant="ghost" size="icon-sm" aria-label="Fullscreen" onClick={p.onFull}>
            <Expand />
          </Button>
        </Tip>
      </div>

      <Grip side="right" container={p.tooltipContainer} />
    </div>
  );
}
