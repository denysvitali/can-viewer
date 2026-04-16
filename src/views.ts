import {
  $tabs, $signalsTab, $decoderTab,
  $drop, $signalsPane, $signalsEmpty,
  $detail, $msg,
} from "./dom.ts";

export type TabName = "signals" | "decoder";

let activeTab: TabName = "signals";

export function initViews(): void {
  $tabs.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".tab-btn");
    if (!btn) return;
    const name = btn.dataset.tab as TabName | undefined;
    if (name) switchTab(name);
  });
}

export function switchTab(name: TabName): void {
  activeTab = name;
  for (const btn of $tabs.querySelectorAll<HTMLButtonElement>(".tab-btn")) {
    const on = btn.dataset.tab === name;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-selected", String(on));
  }
  $signalsTab.classList.toggle("hidden", name !== "signals");
  $decoderTab.classList.toggle("hidden", name !== "decoder");
}

export function currentTab(): TabName { return activeTab; }

// Called after a database is loaded — swap the initial drop panel for the
// split sidebar+detail layout inside the Signals tab.
export function revealSignalsPane(): void {
  $drop.classList.add("hidden");
  $signalsPane.classList.remove("hidden");
}

// Three visual states for the signals content area on desktop:
// - empty placeholder (default after load)
// - message detail
// - signal detail
// On mobile, the empty state is hidden and the panes slide in over the list.
export function showPane(which: "empty" | "msg" | "detail"): void {
  $signalsEmpty.classList.toggle("hidden", which !== "empty");
  $msg.classList.toggle("hidden", which !== "msg");
  $detail.classList.toggle("hidden", which !== "detail");
}
