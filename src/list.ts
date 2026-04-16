import type { Signal } from "./types.ts";
import { state, BATCH } from "./state.ts";
import {
  $sigList, $loadMore, $scroll, $search, $stats, $filters,
} from "./dom.ts";
import { esc, formatHexId } from "./helpers.ts";
import { openSignal } from "./signal.ts";
import { openMessage } from "./message.ts";

let activeKey: string | null = null;

export function initList(): void {
  $scroll.addEventListener("scroll", onScroll, { passive: true });
  $sigList.addEventListener("click", onListClick);

  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  $search.addEventListener("input", () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilter, 150);
  });

  $filters.addEventListener("click", (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>(".fchip");
    if (!chip) return;
    state.currentBus = chip.dataset.bus ?? "all";
    $filters.querySelectorAll<HTMLElement>(".fchip").forEach((x) => {
      x.classList.toggle("on", x === chip);
    });
    applyFilter();
  });
}

export function applyFilter(): void {
  const q = $search.value.toLowerCase().trim();
  state.filtered = state.allSignals.filter((s) => {
    if (state.currentBus !== "all" && s.BusName !== state.currentBus) return false;
    if (!q) return true;
    return (
      s.key.toLowerCase().includes(q)
      || (s.MessageName?.toLowerCase().includes(q) ?? false)
      || (s.Signal?.Units?.toLowerCase().includes(q) ?? false)
      || String(s.ID).includes(q)
      || formatHexId(s.ID).toLowerCase().includes(q)
    );
  });
  state.rendered = 0;
  $sigList.innerHTML = "";
  renderBatch();
  updateStats();
}

export function markActiveSignal(key: string | null): void {
  activeKey = key;
  for (const el of $sigList.querySelectorAll<HTMLElement>(".signal-card")) {
    el.classList.toggle("active", el.dataset.key === key);
  }
}

function updateStats(): void {
  const msgCount = Object.values(state.messages)
    .filter((m) => state.currentBus === "all" || m.bus === state.currentBus)
    .length;
  const sigN = state.filtered.length.toLocaleString();
  $stats.textContent = `${sigN} signals · ${msgCount} messages`;
}

function renderBatch(): void {
  const end = Math.min(state.rendered + BATCH, state.filtered.length);
  const frag = document.createDocumentFragment();
  for (let i = state.rendered; i < end; i++) {
    const sig = state.filtered[i];
    if (sig) frag.appendChild(makeCard(sig, i));
  }
  $sigList.appendChild(frag);
  state.rendered = end;
  $loadMore.textContent = state.rendered >= state.filtered.length ? "" : "scroll for more";
}

function onScroll(): void {
  if (state.rendered >= state.filtered.length) return;
  const threshold = $scroll.scrollHeight - $scroll.scrollTop - $scroll.clientHeight;
  if (threshold < 400) renderBatch();
}

function onListClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  const msgLink = target.closest<HTMLElement>(".msg-link");
  if (msgLink) {
    e.stopPropagation();
    openMessage(Number(msgLink.dataset.mid));
    return;
  }
  const card = target.closest<HTMLElement>(".signal-card");
  if (card) openSignal(Number(card.dataset.idx));
}

function makeCard(s: Signal, idx: number): HTMLElement {
  const d = document.createElement("div");
  d.className = "signal-card";
  d.dataset.idx = String(idx);
  d.dataset.key = s.key;
  if (s.key === activeKey) d.classList.add("active");
  const sig = s.Signal ?? {};
  d.innerHTML = `
    <div class="sig-name">${esc(s.Name || s.key)}</div>
    <div class="sig-sub">
      <span class="sig-tag hex">${formatHexId(s.ID)}</span>
      <span class="sig-tag msg-link" data-mid="${s.ID}">${esc(s.MessageName ?? "")}</span>
      <span class="sig-tag bus">${esc(s.BusName ?? "")}</span>
      ${sig.Width ? `<span class="sig-tag bits">${sig.StartPosition}:${sig.Width}</span>` : ""}
      ${sig.Signedness === "SIGNED" ? `<span class="sig-tag signed">signed</span>` : ""}
    </div>`;
  return d;
}
