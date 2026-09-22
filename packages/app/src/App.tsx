import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Maximize,
  Minimize,
} from "lucide-react";
import FlipBookViewer from "./components/FlipBookViewer";
import Toolbar from "./components/Toolbar";
import { Button } from "./components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/ui/tooltip";
import type { FlipBookScene } from "./flipbook-types";
import "./App.css";

const SAMPLES = [{ label: "Condo Living (33 pages)", url: "/books/sample.pdf" }];

export default function App() {
  const [pdfUrl, setPdfUrl] = useState(SAMPLES[0].url);
  const [fileName, setFileName] = useState("CondoLiving.pdf");
  const [reloadKey, setReloadKey] = useState(0);
  const [scene, setScene] = useState<FlipBookScene | null>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [isFull, setIsFull] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  // Floating toolbar drag state (ref-driven: no re-renders while dragging).
  const barRef = useRef<HTMLDivElement>(null);
  const barPos = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ sx: number; sy: number; dx: number; dy: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);
  // Pinch zoom state
  const pinchRef = useRef<{ pointers: Map<number, {x:number,y:number}>; lastDist: number | null; lastZoomTime: number }>({
    pointers: new Map(),
    lastDist: null,
    lastZoomTime: 0,
  });

  const handleReady = useCallback((s: FlipBookScene | null) => {
    setScene(s);
  }, []);

  // Page counter lives in the floating toolbar (chip stays filename-only).
  const handlePage = useCallback((pg: number, total: number) => {
    setPage(pg);
    setPages(total);
  }, []);

  useEffect(() => {
    setPage(0);
    setPages(0);
  }, [pdfUrl, reloadKey]);

  // Arrow-key navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") scene?.ctrl?.cmdForward();
      if (e.key === "ArrowLeft") scene?.ctrl?.cmdBackward();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scene]);

  // Wheel over parent-level chrome (floating toolbar, chips, arrows):
  // events from the book iframe never reach the parent window, so anything
  // arriving here is outside the PDF and safe to turn into page flips.
  // (Wheel inside the iframe is handled there: margins flip, book zooms.)
  useEffect(() => {
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (!t || t.closest("input,textarea,select")) return;
      if (!stageRef.current?.contains(t)) return;
      const now = performance.now();
      if (now - last < 900) return;
      const ctrl = scene?.ctrl;
      if (!ctrl) return;
      last = now;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        if (e.deltaX > 0) ctrl.cmdForward();
        else if (e.deltaX < 0) ctrl.cmdBackward();
      } else {
        if (e.deltaY > 0) ctrl.cmdForward();
        else if (e.deltaY < 0) ctrl.cmdBackward();
      }
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [scene]);

  // Pinch zoom on the viewer (two-finger pinch) – works on trackpad & touch.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const state = pinchRef.current;

    const onPointerDown = (e: PointerEvent) => {
      state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (state.pointers.size === 2) {
        const pts = Array.from(state.pointers.values());
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        state.lastDist = Math.hypot(dx, dy);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!state.pointers.has(e.pointerId)) return;
      state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (state.pointers.size === 2 && state.lastDist !== null) {
        const pts = Array.from(state.pointers.values());
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        const dist = Math.hypot(dx, dy);
        const now = performance.now();
        // debounce zoom actions (min 120ms)
        if (now - state.lastZoomTime > 120) {
          const ctrl = scene?.ctrl;
          if (ctrl) {
            if (dist > state.lastDist * 1.02) {
              ctrl.cmdZoomIn();
              state.lastZoomTime = now;
            } else if (dist < state.lastDist * 0.98) {
              ctrl.cmdZoomOut();
              state.lastZoomTime = now;
            }
          }
        }
        state.lastDist = dist;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      state.pointers.delete(e.pointerId);
      if (state.pointers.size < 2) {
        state.lastDist = null;
      }
    };

    viewer.addEventListener("pointerdown", onPointerDown);
    viewer.addEventListener("pointermove", onPointerMove);
    viewer.addEventListener("pointerup", onPointerUp);
    viewer.addEventListener("pointercancel", onPointerUp);
    viewer.addEventListener("pointerleave", onPointerUp);

    return () => {
      viewer.removeEventListener("pointerdown", onPointerDown);
      viewer.removeEventListener("pointermove", onPointerMove);
      viewer.removeEventListener("pointerup", onPointerUp);
      viewer.removeEventListener("pointercancel", onPointerUp);
      viewer.removeEventListener("pointerleave", onPointerUp);
    };
  }, [scene]);

  // Track fullscreen to swap the maximize icon.
  useEffect(() => {
    const onFull = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFull);
    return () => document.removeEventListener("fullscreenchange", onFull);
  }, []);

  // Release blob URLs on unmount.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPdfUrl(url);
    setFileName(file.name);
    setReloadKey((k) => k + 1);
  };

  const toggleFull = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  // Draggable floating toolbar: drag from anywhere except text fields;
  // buttons keep working via a 5px click-vs-drag threshold + click suppression.
  const applyBarPos = () => {
    const bar = barRef.current;
    if (!bar) return;
    const { x, y } = barPos.current;
    bar.style.transform = `translate(calc(-50% + ${x}px), ${y}px)`;
  };

  const onBarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input,textarea,select")) return;
    // NOTE: no setPointerCapture here — capturing on pointerdown would
    // retarget the follow-up click to the wrapper and break every button.
    // Capture starts only once a real drag is detected (see move handler).
    dragRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      dx: barPos.current.x,
      dy: barPos.current.y,
      dragging: false,
    };
  };

  const onBarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const mx = e.clientX - d.sx;
    const my = e.clientY - d.sy;
    if (!d.dragging && Math.hypot(mx, my) < 5) return;
    if (!d.dragging) {
      d.dragging = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    const stage = stageRef.current;
    const bar = barRef.current;
    let x = d.dx + mx;
    let y = d.dy + my;
    if (stage && bar) {
      // Clamp inside the stage so the bar can't be lost off-screen.
      const sr = stage.getBoundingClientRect();
      const br = bar.getBoundingClientRect();
      x = Math.min(Math.max(x, -(sr.width / 2 - br.width / 2 - 8)), sr.width / 2 - br.width / 2 - 8);
      y = Math.min(Math.max(y, -(sr.height - br.height - 8)), 0);
    }
    barPos.current = { x, y };
    applyBarPos();
  };

  const onBarPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.dragging) {
      // A real drag just happened — swallow the click that follows so a
      // button under the cursor doesn't fire accidentally.
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
  };

  const onBarClickCapture = (e: React.SyntheticEvent) => {
    if (suppressClick.current) {
      e.stopPropagation();
      e.preventDefault();
      suppressClick.current = false;
    }
  };

  const onBarDoubleClick = () => {
    // Double-click empty bar area snaps it back to bottom-center.
    barPos.current = { x: 0, y: 0 };
    applyBarPos();
  };

  const ctrl = scene?.ctrl;
  const busy = !ctrl;

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* slim header */}
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[#0b0d12]/85 px-4 py-2.5 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#f2b544] to-[#e07f3a] text-[#241a05] shadow-[0_6px_20px_rgba(242,181,68,0.35)]">
            <BookOpenText size={18} />
          </span>
          <div className="leading-tight">
            <h1 className="m-0 text-[16px] font-semibold tracking-tight">Folio</h1>
            <p className="m-0 text-xs text-[var(--muted)]">Immersive 3D reader</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <select
            className="h-9 max-w-44 cursor-pointer rounded-xl border border-[var(--border)] bg-white/[0.06] px-2.5 text-sm text-[var(--foreground)] sm:max-w-60"
            value={pdfUrl.startsWith("blob:") ? "__upload__" : pdfUrl}
            aria-label="Sample book"
            onChange={(e) => {
              if (e.target.value === "__upload__") return;
              setPdfUrl(e.target.value);
              setFileName("CondoLiving.pdf");
              setReloadKey((k) => k + 1);
            }}
          >
            {SAMPLES.map((s) => (
              <option key={s.url} value={s.url} className="text-black">
                {s.label}
              </option>
            ))}
            {pdfUrl.startsWith("blob:") && (
              <option value="__upload__" className="text-black">
                Uploaded file
              </option>
            )}
          </select>
            </TooltipTrigger>
            <TooltipContent container={isFull ? stageRef.current : undefined}>Sample book</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild title="Open your own PDF">
            <label className="cursor-pointer">
              <FileUp />
              <span className="hidden sm:inline">Open PDF</span>
              <input
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </label>
          </Button>
            </TooltipTrigger>
            <TooltipContent container={isFull ? stageRef.current : undefined}>Open your own PDF</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* immersive stage — fills all remaining space */}
      <main ref={stageRef} className="stage-wrap relative flex min-h-0 flex-1 flex-col items-center px-3 py-3 sm:px-5">
        <div className="lamp" aria-hidden />

        <div className="stage-box relative flex min-h-0 w-full max-w-[1180px] flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[#141824] shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
          <div ref={viewerRef} className="viewer relative min-h-0 flex-1 bg-[#0e1119]">
            <FlipBookViewer
              pdfUrl={pdfUrl}
              reloadKey={reloadKey}
              onReady={handleReady}
              onPage={handlePage}
            />

            {/* filename chip */}
            <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[60%] truncate rounded-full border border-[var(--border)] bg-black/55 px-3 py-1.5 text-[13px] font-medium backdrop-blur-md" title={fileName}>
              {fileName}
            </div>

            {/* maximize */}
            <Tooltip>
              <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              aria-label={isFull ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={toggleFull}
              className="absolute right-4 top-4 z-10 h-10 w-10 rounded-full border-white/15 bg-black/55 text-white shadow-xl backdrop-blur-md hover:bg-black/75"
            >
              {isFull ? <Minimize /> : <Maximize />}
            </Button>
              </TooltipTrigger>
              <TooltipContent container={isFull ? stageRef.current : undefined}>{isFull ? "Exit fullscreen (Esc)" : "Fullscreen"}</TooltipContent>
            </Tooltip>

            {/* modern side arrows */}
            <Tooltip>
              <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Previous page"
              disabled={busy}
              onClick={() => ctrl?.cmdBackward()}
              className="absolute left-3 top-1/2 z-10 h-12 w-12 -translate-y-1/2 rounded-full border-white/15 bg-black/55 text-white shadow-xl backdrop-blur-md hover:bg-black/75 sm:left-5"
            >
              <ChevronLeft className="!size-6" />
            </Button>
              </TooltipTrigger>
              <TooltipContent side="right" container={isFull ? stageRef.current : undefined}>Previous page</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Next page"
              disabled={busy}
              onClick={() => ctrl?.cmdForward()}
              className="absolute right-3 top-1/2 z-10 h-12 w-12 -translate-y-1/2 rounded-full border-white/15 bg-black/55 text-white shadow-xl backdrop-blur-md hover:bg-black/75 sm:right-5"
            >
              <ChevronRight className="!size-6" />
            </Button>
              </TooltipTrigger>
              <TooltipContent side="left" container={isFull ? stageRef.current : undefined}>Next page</TooltipContent>
            </Tooltip>

            {/* floating draggable toolbar */}
            <div
              ref={barRef}
              className="absolute bottom-4 left-1/2 z-10 cursor-grab [touch-action:none] active:cursor-grabbing"
              style={{ transform: "translate(-50%, 0)" }}
              onPointerDown={onBarPointerDown}
              onPointerMove={onBarPointerMove}
              onPointerUp={onBarPointerUp}
              onPointerCancel={onBarPointerUp}
              onClickCapture={onBarClickCapture}
              onDoubleClick={onBarDoubleClick}
            >
              <Toolbar
                page={page}
                pages={pages}
                busy={busy}
                tooltipContainer={isFull ? stageRef.current : undefined}
                onPrev={() => ctrl?.cmdBackward()}
                onNext={() => ctrl?.cmdForward()}
                onFastPrev={() => ctrl?.cmdFastBackward()}
                onFastNext={() => ctrl?.cmdFastForward()}
                onGoTo={(n) => ctrl?.goToPage(Math.min(Math.max(n - 1, 0), Math.max(0, pages - 1)))}
                onZoomIn={() => ctrl?.cmdZoomIn()}
                onZoomOut={() => ctrl?.cmdZoomOut()}
                onFit={() => ctrl?.cmdDefaultZoom()}
                onPrint={() => ctrl?.cmdPrint()}
                onDownload={() => {
                  const a = document.createElement("a");
                  a.href = pdfUrl;
                  a.download = fileName || "book.pdf";
                  a.click();
                }}
                onFull={toggleFull}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
    </TooltipProvider>
  );
}
