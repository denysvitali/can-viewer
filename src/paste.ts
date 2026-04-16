import type { Signal } from "./types.ts";
import { state } from "./state.ts";
import {
  $pasteInput, $pasteDecode, $pasteOutput, $pasteMeta, $pasteClear,
} from "./dom.ts";
import { esc, fmt, formatHexId, signalColor } from "./helpers.ts";
import { decodeMessage, parseFrames } from "./decode.ts";
import { renderPayloadGrid } from "./bits.ts";
import { openMessage } from "./message.ts";
import { openSignal } from "./signal.ts";
import { switchTab } from "./views.ts";

export function initPasteView(): void {
  $pasteDecode.addEventListener("click", renderDecoded);
  $pasteClear.addEventListener("click", () => {
    $pasteInput.value = "";
    $pasteOutput.innerHTML = hint();
    updateMeta();
    $pasteInput.focus();
  });
  $pasteInput.addEventListener("input", updateMeta);
  $pasteInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      renderDecoded();
    }
  });

  $pasteOutput.addEventListener("click", onOutputClick);

  // Initial state
  $pasteOutput.innerHTML = hint();
  updateMeta();
}

function hint(): string {
  return `<div class="paste-hint">
    Paste frames one per line in the form <code>ID:DATA</code> or <code>IDs:DATA</code>,
    then hit <strong>Decode</strong>.<br>Bit values are rendered against the loaded
    database and <strong>muxed signals are gated by the selector</strong> bits you
    can see painted in the grid.
  </div>`;
}

function updateMeta(): void {
  const lines = $pasteInput.value.split(/\r?\n/).filter((l) => l.trim()).length;
  $pasteMeta.textContent = lines
    ? `${lines} line${lines === 1 ? "" : "s"}`
    : "paste frames";
}

function renderDecoded(): void {
  const { frames, errors } = parseFrames($pasteInput.value);

  if (!frames.length && !errors.length) {
    $pasteOutput.innerHTML = hint();
    return;
  }

  // Group by ID, dedup identical payloads.
  const byId = new Map<number, { payload: string; data: Uint8Array; count: number; order: number }[]>();
  let order = 0;
  for (const f of frames) {
    const key = bytesToHex(f.data);
    const arr = byId.get(f.id) ?? [];
    const existing = arr.find((x) => x.payload === key);
    if (existing) existing.count++;
    else arr.push({ payload: key, data: f.data, count: 1, order: order++ });
    byId.set(f.id, arr);
  }

  const ids = [...byId.keys()].sort((a, b) => a - b);

  let h = "";
  h += `<div class="paste-summary-bar">
    <span class="summary-stat"><strong>${frames.length}</strong><span class="stat-label">frames</span></span>
    <span class="summary-sep"></span>
    <span class="summary-stat"><strong>${ids.length}</strong><span class="stat-label">IDs</span></span>
    <span class="summary-sep"></span>
    <span class="summary-stat"><strong>${totalPayloads(byId)}</strong><span class="stat-label">unique payloads</span></span>
    ${errors.length ? `<span class="summary-sep"></span><span class="summary-stat"><strong style="color:var(--warn)">${errors.length}</strong><span class="stat-label">skipped</span></span>` : ""}
  </div>`;

  if (errors.length) {
    h += `<details class="paste-errors"><summary>Skipped ${errors.length} line${errors.length === 1 ? "" : "s"}</summary><ul>`;
    for (const e of errors.slice(0, 50)) {
      h += `<li><span class="err-line">line ${e.line}</span> <code>${esc(e.text)}</code> — ${esc(e.reason)}</li>`;
    }
    if (errors.length > 50) h += `<li>…and ${errors.length - 50} more</li>`;
    h += `</ul></details>`;
  }

  for (const id of ids) {
    h += renderIdBlock(id, byId.get(id)!);
  }

  $pasteOutput.innerHTML = h;
}

function totalPayloads(byId: Map<number, { payload: string }[]>): number {
  let n = 0;
  for (const arr of byId.values()) n += arr.length;
  return n;
}

function renderIdBlock(
  id: number,
  payloads: { payload: string; data: Uint8Array; count: number; order: number }[],
): string {
  payloads.sort((a, b) => a.order - b.order);
  const msg = state.messages[id];
  const msgSigs: Signal[] = msg
    ? msg.signals.map((k) => state.sigByKey[k]).filter((s): s is Signal => Boolean(s))
    : [];

  const totalFrames = payloads.reduce((n, p) => n + p.count, 0);
  const known = !!msg;
  const header = known
    ? `<div>
        <div class="pb-title-row">
          <span class="pb-name">${esc(msg.name)}</span>
          <span class="pb-id">${formatHexId(id)}</span>
        </div>
        <div class="pb-meta">
          <span><b>${msgSigs.length}</b> signals</span>
          <span><b>${totalFrames}</b> frames</span>
          <span><b>${payloads.length}</b> unique</span>
          ${msg.cycleTime ? `<span>cycle <b>${msg.cycleTime}ms</b></span>` : ""}
          ${msg.bus ? `<span>bus <b>${esc(msg.bus)}</b></span>` : ""}
        </div>
      </div>`
    : `<div>
        <div class="pb-title-row">
          <span class="pb-name unknown">Unknown message</span>
          <span class="pb-id">${formatHexId(id)}</span>
        </div>
        <div class="pb-meta">
          <span><b>${totalFrames}</b> frames</span>
          <span><b>${payloads.length}</b> unique</span>
          <span>not in loaded database</span>
        </div>
      </div>`;

  const openBtn = known
    ? `<button class="pb-open" data-mid="${id}" title="Open message detail">
        Open
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 2 6 5 3 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
       </button>`
    : "";

  let body = "";
  for (const p of payloads) body += renderPayload(p, msgSigs);

  return `<div class="paste-block${known ? "" : " unknown"}" data-mid="${id}">
    <div class="pb-header">${header}${openBtn}</div>
    <div class="pb-body">${body}</div>
  </div>`;
}

function renderPayload(
  p: { payload: string; data: Uint8Array; count: number },
  msgSigs: Signal[],
): string {
  const hexRow = prettyHexRow(p.data);
  const countTag = p.count > 1
    ? `<span class="pp-count">×${p.count}</span>`
    : "";

  if (!msgSigs.length) {
    return `<div class="paste-payload">
      <div class="pp-head">${hexRow}${countTag}</div>
      <div class="pp-empty">No definitions for this ID in the loaded database.</div>
    </div>`;
  }

  const decoded = decodeMessage(msgSigs, p.data);
  const selector = decoded.find((d) => d.isSelector);
  const selectorRaw = selector?.raw;

  // Bit grid (painted against active signals only).
  const grid = renderPayloadGrid(msgSigs, p.data, {
    selectorKey: selector?.key,
    selectorRaw,
  });

  const nonMuxed = decoded.filter((d) => d.muxId === undefined && !d.isSelector);
  const muxed = decoded.filter((d) => d.muxId !== undefined);

  const rowFor = (d: typeof decoded[number], inMuxGroup = false): string => {
    const physStr = Number.isFinite(d.physical) ? fmt(d.physical) : "—";
    const vd = d.valueDescription ? ` <span class="pp-enum">${esc(d.valueDescription)}</span>` : "";
    const units = d.units ? `<span class="pp-units">${esc(d.units)}</span>` : "";
    const color = signalColor(d.key);
    const dot = `<span class="pp-dot" style="background:${color}"></span>`;
    const badge = d.isSelector ? ` <span class="mux-badge">MUX</span>`
      : inMuxGroup ? ` <span class="mux-badge" title="Only present for this selector value">ID ${d.muxId}</span>`
      : "";
    const sig = msgSigs.find((s) => s.key === d.key)?.Signal;
    const bits = sig && sig.Width
      ? `<span class="pp-bits">${sig.StartPosition}:${sig.Width}</span>`
      : "";
    return `<tr data-sigkey="${esc(d.key)}">
      <td class="pp-name">${dot}${esc(d.name)}${badge}${bits}</td>
      <td class="pp-raw">${d.raw}</td>
      <td class="pp-phys">${physStr}${units}${vd}</td>
    </tr>`;
  };

  let rows = "";
  if (selector) rows += rowFor(selector);
  for (const d of nonMuxed) rows += rowFor(d);
  if (muxed.length) {
    const selName = selector?.name ?? "selector";
    rows += `<tr><td colspan="3" class="pp-mux-divider">When ${esc(selName)} = ${selector?.raw ?? "?"}</td></tr>`;
    for (const d of muxed) rows += rowFor(d, true);
  }

  const selectorChip = selector
    ? `<span class="pp-selector-chip" title="Mux selector">${esc(selector.name)}=<b>${selector.raw}</b></span>`
    : "";

  return `<div class="paste-payload">
    <div class="pp-head">${hexRow}${countTag}${selectorChip}</div>
    <div class="pp-grid-wrap">${grid}</div>
    <table class="pp-table">
      <thead><tr><th>Signal</th><th style="text-align:right">Raw</th><th style="text-align:right">Value</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function prettyHexRow(data: Uint8Array): string {
  let h = '<div class="pp-hex-row">';
  for (const b of data) {
    h += `<span class="pp-hex-byte">${b.toString(16).toUpperCase().padStart(2, "0")}</span>`;
  }
  h += "</div>";
  return h;
}

function bytesToHex(data: Uint8Array): string {
  let s = "";
  for (const b of data) s += b.toString(16).padStart(2, "0");
  return s;
}

function onOutputClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  const openBtn = target.closest<HTMLElement>(".pb-open");
  if (openBtn) {
    const mid = Number(openBtn.dataset.mid);
    if (!Number.isNaN(mid)) {
      switchTab("signals");
      openMessage(mid);
    }
    return;
  }
  const row = target.closest<HTMLElement>("tr[data-sigkey]");
  if (row) {
    const key = row.dataset.sigkey;
    if (!key) return;
    const idx = state.filtered.findIndex((x) => x.key === key);
    if (idx >= 0) {
      switchTab("signals");
      openSignal(idx);
    }
  }
}
