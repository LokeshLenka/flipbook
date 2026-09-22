// Minimal typings for the legacy jQuery FlipBook engine (global scripts).
export interface FlipBookCtrl {
  cmdForward: () => void;
  cmdBackward: () => void;
  cmdFastForward: () => void;
  cmdFastBackward: () => void;
  cmdZoomIn: () => void;
  cmdZoomOut: () => void;
  cmdDefaultZoom: () => void;
  cmdFullScreen: () => void;
  cmdToc: () => void;
  cmdPrint: () => void;
  cmdSave: () => void;
  goToPage: (page: number) => void;
  getPage: () => number;
  getPages: () => number;
}

export interface FlipBookScene {
  ctrl?: FlipBookCtrl;
  book?: { getPages?: () => number; getPage?: () => number };
  dispose?: () => void;
  ready?: boolean;
}

declare global {
  interface Window {
    jQuery: any;
    PDFJS_LOCALE?: { pdfJsWorker: string };
  }
}
