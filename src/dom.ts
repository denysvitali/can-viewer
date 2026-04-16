// Centralised DOM element references. Casts are safe because the elements
// are declared in index.html and present before main.ts runs.

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

// Header / nav
export const $tabs = byId<HTMLElement>("tabs");
export const $fileLabel = byId<HTMLSpanElement>("fileLabel");
export const $fileDot = byId<HTMLSpanElement>("fileDot");
export const $loadFileBtn = byId<HTMLButtonElement>("loadFileBtn");

// Tab panels
export const $signalsTab = byId<HTMLElement>("signalsTab");
export const $decoderTab = byId<HTMLElement>("decoderTab");

// Signals tab — drop zone + split pane
export const $drop = byId<HTMLDivElement>("dropView");
export const $dropBox = byId<HTMLDivElement>("dropBox");
export const $dropBtn = byId<HTMLButtonElement>("dropBtn");
export const $fileInput = byId<HTMLInputElement>("fileInput");

export const $signalsPane = byId<HTMLDivElement>("signalsPane");
export const $signalsContent = byId<HTMLElement>("signalsContent");
export const $signalsEmpty = byId<HTMLDivElement>("signalsEmpty");

// Sidebar (list, search, filters, stats)
export const $scroll = byId<HTMLDivElement>("scrollArea");
export const $sigList = byId<HTMLDivElement>("signalList");
export const $loadMore = byId<HTMLDivElement>("loadMore");
export const $search = byId<HTMLInputElement>("search");
export const $stats = byId<HTMLDivElement>("statsBar");
export const $filters = byId<HTMLDivElement>("filters");

// Signal detail pane
export const $detail = byId<HTMLDivElement>("detailView");
export const $detailTitle = byId<HTMLDivElement>("detailTitle");
export const $detailScroll = byId<HTMLDivElement>("detailScroll");
export const $detailBack = byId<HTMLButtonElement>("detailBack");

// Message detail pane
export const $msg = byId<HTMLDivElement>("msgView");
export const $msgTitle = byId<HTMLDivElement>("msgTitle");
export const $msgScroll = byId<HTMLDivElement>("msgScroll");
export const $msgBack = byId<HTMLButtonElement>("msgBack");
export const $msgCopy = byId<HTMLButtonElement>("msgCopy");

// Decoder tab
export const $pasteInput = byId<HTMLTextAreaElement>("pasteInput");
export const $pasteDecode = byId<HTMLButtonElement>("pasteDecode");
export const $pasteOutput = byId<HTMLDivElement>("pasteOutput");
export const $pasteMeta = byId<HTMLDivElement>("pasteMeta");
export const $pasteClear = byId<HTMLButtonElement>("pasteClear");
