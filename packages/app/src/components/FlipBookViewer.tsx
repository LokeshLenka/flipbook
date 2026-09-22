// Minimal type for engine scene
interface FlipBookScene {
  ctrl?: any;
  book?: any;
  dispose?: () => void;
  ready?: boolean;
}

import { useEffect, useRef } from 'react';

interface Props {
  /** URL of the PDF, or a blob: URL from an uploaded file */
  pdfUrl: string;
  /** Increment to force a reload of the same URL */
  reloadKey: number;
  onReady: (scene: FlipBookScene | null) => void;
  onPage: (page: number, pages: number) => void;
}

function readPage(scene: FlipBookScene | null): { page: number; pages: number } {
  try {
    const ctrl = scene?.ctrl as any;
    const book = (scene as any)?.book as any;
    if (!ctrl) return { page: 0, pages: 0 };
    const page = Number(ctrl.getPage?.() ?? 0);
    // Total lives on the Book, not the controller.
    const pages = Number(
      ctrl.getPages?.() ?? book?.getPages?.() ?? ctrl.book?.getPages?.() ?? 0,
    );
    return {
      page: Number.isFinite(page) ? page : 0,
      pages: Number.isFinite(pages) ? pages : 0,
    };
  } catch {
    return { page: 0, pages: 0 };
  }
}

export default function FlipBookViewer({ pdfUrl, reloadKey, onReady, onPage }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const onPageRef = useRef(onPage);
  onReadyRef.current = onReady;
  onPageRef.current = onPage;

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    if (!window.jQuery) {
      console.error('Legacy jQuery engine not loaded');
      return;
    }
    const $ = window.jQuery;
    let scene: FlipBookScene | null = null;
    let disposed = false;
    let poll: number | undefined;
    let guard: number | undefined;

    // The engine renders inside same-origin iframes. This returns the book
    // iframe(s) — skipping helper frames (print/PDF preload) that have no
    // .flip-book template in them.
    const bookFrames = (): { frame: HTMLIFrameElement; doc: Document }[] => {
      const out: { frame: HTMLIFrameElement; doc: Document }[] = [];
      try {
        el.querySelectorAll("iframe").forEach((frame) => {
          const doc = frame.contentDocument;
          if (doc && doc.querySelector(".flip-book")) {
            out.push({ frame: frame as HTMLIFrameElement, doc });
          }
        });
      } catch {
        /* ignore (iframe not ready / cross-origin) */
      }
      return out;
    };

    // BUG FIX — arrow keys: keyboard focus lives inside the book iframe, so
    // keydown never bubbles to the parent window listener in App.tsx.
    // Listen in the iframe document itself (once per document).
    //
    // WHEEL: two-finger trackpad scroll / mouse wheel over the viewer margins
    // flips pages; over the book itself the engine keeps its wheel-zoom, and
    // pinch-zoom (ctrl/meta+wheel) always passes through untouched. The
    // listener runs in the capture phase and stops margin events before the
    // engine's zoom handler (bound on the canvas) ever sees them.
    // "Over the book" is decided by raycasting the pointer into the live
    // 3D scene, so it stays correct while zoomed or panned.
    const WHEEL_COOLDOWN = 900;
    let lastWheelFlip = 0;

    const isOverBook = (clientX: number, clientY: number): boolean => {
      try {
        const frames = bookFrames();
        const sc = scene as any;
        const fw = frames[0]?.frame.contentWindow as any;
        const THREE = fw?.THREE;
        const visual = sc?.visual;
        const book = sc?.book;
        if (!frames[0] || !THREE || !visual?.camera || !book?.three) return false;
        const r = frames[0].frame.getBoundingClientRect();
        const nx = ((clientX - r.left) / r.width) * 2 - 1;
        const ny = -((clientY - r.top) / r.height) * 2 + 1;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(nx, ny), visual.camera);
        return ray.intersectObject(book.three, true).length > 0;
      } catch {
        return false;
      }
    };

    const flipByWheel = (dx: number, dy: number) => {
      const now = performance.now();
      if (now - lastWheelFlip < WHEEL_COOLDOWN) return;
      const ctrl = scene?.ctrl;
      if (!ctrl) return;
      lastWheelFlip = now;
      // Scroll down / swipe left = forward (matches reader conventions).
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) ctrl.cmdForward();
        else if (dx < 0) ctrl.cmdBackward();
      } else {
        if (dy > 0) ctrl.cmdForward();
        else if (dy < 0) ctrl.cmdBackward();
      }
    };

    const attachIframeHandlers = (s: FlipBookScene) => {
      bookFrames().forEach(({ doc }) => {
        const d = doc as Document & { __folioInput?: boolean };
        if (d.__folioInput) return;
        d.__folioInput = true;
        d.addEventListener("keydown", (e: KeyboardEvent) => {
          const t = e.target as HTMLElement | null;
          if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
          if (e.key === "ArrowRight") {
            e.preventDefault();
            s.ctrl?.cmdForward();
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            s.ctrl?.cmdBackward();
          }
        });
        d.addEventListener(
          "wheel",
          (e: WheelEvent) => {
            if (disposed || e.ctrlKey || e.metaKey || e.buttons !== 0) return;
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
            if (isOverBook(e.clientX, e.clientY)) return;
            e.preventDefault();
            e.stopPropagation();
            flipByWheel(e.deltaX, e.deltaY);
          },
          { capture: true, passive: false },
        );
      });
    };

    // BUG FIX — stuck corner drag: the engine binds mousedown/mousemove on
    // its canvas but mouseup only on the IFRAME document. Grab a corner,
    // drag the cursor out over the parent page and release there, and the
    // iframe never sees mouseup — the page freezes mid-flip. Forward parent
    // releases (and moves, so the peel keeps tracking) into the iframe.
    // Forwarded mouseup needs no coords (release handler is stateless);
    // mousemove coords are translated into iframe-viewport space so the
    // engine's pageX/pageY math stays correct.
    const forwardRelease = () => {
      if (disposed) return;
      bookFrames().forEach(({ doc }) => {
        try {
          doc.dispatchEvent(
            new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
          );
        } catch {
          /* ignore */
        }
      });
    };

    const forwardMove = (e: MouseEvent) => {
      if (disposed) return;
      // Parent mousemove only fires while the pointer is over the parent
      // document (outside the iframe) — exactly the gap the engine misses.
      bookFrames().forEach(({ frame, doc }) => {
        try {
          const canvas = doc.querySelector("canvas");
          if (!canvas) return;
          const r = frame.getBoundingClientRect();
          canvas.dispatchEvent(
            new MouseEvent("mousemove", {
              bubbles: true,
              cancelable: true,
              clientX: e.clientX - r.left,
              clientY: e.clientY - r.top,
            }),
          );
        } catch {
          /* ignore */
        }
      });
    };

    window.addEventListener("mouseup", forwardRelease);
    window.addEventListener("pointerup", forwardRelease);
    window.addEventListener("mousemove", forwardMove);

    const startPolling = () => {
      let last = '';
      poll = window.setInterval(() => {
        if (disposed || !scene?.ctrl) return;
        const { page, pages } = readPage(scene);
        const key = `${page}/${pages}`;
        if (key !== last) {
          last = key;
          onPageRef.current(page, pages);
        }
      }, 250);
    };

    const stripLegacyChrome = () => {
      try {
        // The engine renders the whole book UI inside a same-origin
        // iframe, so parent-document CSS/jQuery can never reach it.
        // Inject a hiding stylesheet + remove the nodes in there.
        // Controllers bind to these at construction (before ready), so
        // stripping is safe — our React toolbar drives ctrl directly.
        bookFrames().forEach(({ doc }) => {
          if (!doc.getElementById("folio-chrome-kill") && doc.head) {
            const st = doc.createElement("style");
            st.id = "folio-chrome-kill";
            st.textContent =
              // 1. Legacy chrome that our React UI replaces.
              ".flip-book .controls,.flip-book .float-wnd," +
              ".flip-book .view>.fnav" +
              "{display:none!important;visibility:hidden!important;" +
              "height:0!important;pointer-events:none!important}" +
              // 2. Loading screens, redesigned to the Folio dark theme.
              // The engine keeps driving them (live % caption), we only
              // reskin: gif spinners become amber ring spinners.
              "@keyframes folioSpin{to{transform:rotate(360deg)}}" +
              ".flip-book .view .loading-progress{z-index:5;text-align:center}" +
              ".flip-book .loading-progress .progress{width:46px;height:46px;" +
              "margin:0 auto 14px;padding:0;background:transparent;" +
              "border:3px solid rgba(255,255,255,.14);border-top-color:#f2b544;" +
              "border-radius:50%;box-shadow:none;animation:folioSpin .9s linear infinite}" +
              ".flip-book .loading-progress .progress::after{display:none}" +
              ".flip-book .loading-progress .caption{background:rgba(20,24,36,.94);" +
              "border:1px solid rgba(255,255,255,.1);color:#edeff5;" +
              "font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;" +
              "font-size:13px;font-weight:500;font-style:normal;" +
              "font-variant-numeric:tabular-nums;padding:10px 18px;border-radius:12px;" +
              "box-shadow:0 16px 40px rgba(0,0,0,.5)}" +
              ".flip-book .page-loading{width:58px;height:58px;" +
              "background:rgba(10,12,18,.62);border:1px solid rgba(255,255,255,.12);" +
              "border-radius:50%;backdrop-filter:blur(4px)}" +
              ".flip-book .page-loading::after{content:' ';display:block;" +
              "width:30px;height:30px;margin:13px;background:transparent;background-image:none;" +
              "border:3px solid rgba(255,255,255,.16);border-top-color:#f2b544;" +
              "border-radius:50%;animation:folioSpin .9s linear infinite}";
            doc.head.appendChild(st);
          }
          doc
            .querySelectorAll(".controls,.float-wnd,.view > .fnav")
            .forEach((n) => n.remove());
        });
      } catch {
        /* ignore (iframe not ready / cross-origin) */
      }
    };

    const sweep = (s: FlipBookScene | null) => {
      if (disposed) return;
      stripLegacyChrome();
      if (s) attachIframeHandlers(s);
    };

    // Guard sweep runs from mount (not just ready): the legacy loading
    // screen and bottom bar exist BEFORE ready fires, so the skin + strip
    // must already be in place or the user sees the old white UI flash.
    // The scene object identity is stable (populated in place), so passing
    // the pre-ready scene for key binding is safe.
    guard = window.setInterval(() => sweep(scene), 400);

    $(el).empty();
    try {
      scene = $(el).FlipBook({
        pdf: pdfUrl,
        propertiesCallback: (props: any) => {
          // Slightly thinner pages + a touch of padding so PDFs sit naturally.
          if (props?.page && typeof props.page.depth === 'number') {
            props.page.depth /= 1.6;
          }
          if (props?.cover && typeof props.cover.padding === 'number') {
            props.cover.padding = 0.002;
          }
          return props;
        },
        template: {
          html: '/legacy/templates/default-book-view.html',
          links: [{ rel: 'stylesheet', href: '/legacy/css/font-awesome.min.css' }],
          styles: ['/legacy/css/white-book-view.css'],
          script: '/legacy/js/default-book-view.js',
          sounds: {
            startFlip: '/legacy/sounds/start-flip.mp3',
            endFlip: '/legacy/sounds/end-flip.mp3',
          },
        },
        ready: (s: FlipBookScene) => {
          if (disposed) return;
          scene = s;
          sweep(s);
          onReadyRef.current(s);
          const { page, pages } = readPage(s);
          onPageRef.current(page, pages);
          startPolling();
        },
      }) as FlipBookScene;
    } catch (err) {
      console.error('FlipBook init failed', err);
    }

    return () => {
      disposed = true;
      if (poll !== undefined) window.clearInterval(poll);
      if (guard !== undefined) window.clearInterval(guard);
      window.removeEventListener("mouseup", forwardRelease);
      window.removeEventListener("pointerup", forwardRelease);
      window.removeEventListener("mousemove", forwardMove);
      onReadyRef.current(null);
      try {
        // Legacy engine's dispose is async-aware via ready/pendingDispose flags.
        scene?.dispose?.();
      } catch {
        /* ignore */
      }
      try {
        $(el).empty();
      } catch {
        /* ignore */
      }
    };
    // Re-init when the PDF URL or reloadKey changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl, reloadKey]);

  return <div ref={mountRef} className="fb-engine" aria-label="3D book viewer" />;
}
