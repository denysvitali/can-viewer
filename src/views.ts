import { $drop, $list, $detail, $msg } from "./dom.ts";

export function showView(view: HTMLElement): void {
  for (const v of [$drop, $list, $detail, $msg]) {
    if (v === view) {
      v.classList.remove("hidden", "hidden-left");
    } else if (v === $list && (view === $detail || view === $msg)) {
      v.classList.remove("hidden");
      v.classList.add("hidden-left");
    } else {
      v.classList.add("hidden");
      v.classList.remove("hidden-left");
    }
  }
}

export { $drop, $list, $detail, $msg };
