import type { Signal } from "./types.ts";
import { state } from "./state.ts";
import {
  $paste, $pasteBack, $pasteInput, $pasteDecode, $pasteOutput, $list,
} from "./dom.ts";
import { esc, fmt, formatHexId } from "./helpers.ts";
import { showView } from "./views.ts";
import { decodeMessage, parseFrames } from "./decode.ts";
import { openMessage } from "./message.ts";
import { openSignal } from "./signal.ts";

export function initPasteView(): void {
  $pasteBack.addEventListener("click", () => showView($list));
  $pasteDecode.addEventListener("click", renderDecoded);
  $pasteOutput.addEventListener("click", onOutputClick);
}

export function openPasteView(): void {
  showView($paste);
  if (!$pasteInput.value) $pasteOutput.innerHTML = hint();
}

function hint(): string {
  return `<div class="paste-hint">
    Paste frames, one per line, in the form
    <code>ID:DATA</code> (e.g. <code>7FF:06A0340003</code>) or
    <code>IDs:DATA</code>. Press <b>Decode</b> to interpret them against the
    loaded database.
  </div>`;
}

function renderDecoded(): void {
  const text = $pasteInput.value;
  const { frames, errors } = parseFrames(text);

  if (!frames.length && !errors.length) {
    $pasteOutput.innerHTML = hint();
    return;
  }

  // Group frames by ID. Within each ID, dedupe identical payloads and keep
  // track of how many times each one appeared, plus the first occurrence
  // line order so tables feel predictable.
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
  let h = `<div class="paste-summary">
    ${frames.length} frame${frames.length === 1 ? "" : "s"} &middot;
    ${ids.length} unique ID${ids.length === 1 ? "" : "s"}
    ${errors.length ? ` &middot; <span class="paste-err-count">${errors.length} line${errors.length === 1 ? "" : "s"} skipped</span>` : ""}
  </div>`;

  if (errors.length) {
    h += `<details class="paste-errors"><summary>Skipped lines</summary><ul>`;
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
  const header = msg
    ? `<div class="pb-title">${esc(msg.name)} <span class="pb-id">${formatHexId(id)}</span></div>
       <div class="pb-sub">${msgSigs.length} signal${msgSigs.length === 1 ? "" : "s"} &middot; ${totalFrames} frame${totalFrames === 1 ? "" : "s"} &middot; ${payloads.length} unique payload${payloads.length === 1 ? "" : "s"}</div>`
    : `<div class="pb-title pb-unknown">Unknown message <span class="pb-id">${formatHexId(id)}</span></div>
       <div class="pb-sub">${totalFrames} frame${totalFrames === 1 ? "" : "s"} &middot; ${payloads.length} unique payload${payloads.length === 1 ? "" : "s"}</div>`;

  let body = "";
  for (const p of payloads) {
    body += renderPayload(id, p, msgSigs);
  }

  return `<div class="paste-block" data-mid="${id}">
    <div class="pb-header">
      <div>${header}</div>
      ${msg ? `<button class="pb-open" data-mid="${id}" title="Open message">&rsaquo;</button>` : ""}
    </div>
    <div class="pb-body">${body}</div>
  </div>`;
}

function renderPayload(
  _id: number,
  p: { payload: string; data: Uint8Array; count: number },
  msgSigs: Signal[],
): string {
  const hexPretty = prettyHex(p.data);
  const countTag = p.count > 1 ? `<span class="pp-count">&times;${p.count}</span>` : "";

  if (!msgSigs.length) {
    return `<div class="paste-payload">
      <div class="pp-hex">${hexPretty}${countTag}</div>
      <div class="pp-empty">No definitions for this ID in the loaded database.</div>
    </div>`;
  }

  const decoded = decodeMessage(msgSigs, p.data);
  const selector = decoded.find((d) => d.isSelector);
  const nonMuxed = decoded.filter((d) => d.muxId === undefined && !d.isSelector);
  const muxed = decoded.filter((d) => d.muxId !== undefined);

  let rows = "";
  const rowFor = (d: typeof decoded[number], badge = ""): string => {
    const physStr = Number.isFinite(d.physical) ? fmt(d.physical) : "—";
    const vd = d.valueDescription ? ` <span class="pp-enum">${esc(d.valueDescription)}</span>` : "";
    const units = d.units ? ` <span class="pp-units">${esc(d.units)}</span>` : "";
    return `<tr data-sigkey="${esc(d.key)}">
      <td class="pp-name">${esc(d.name)}${badge}</td>
      <td class="pp-raw">${d.raw}</td>
      <td class="pp-phys">${physStr}${units}${vd}</td>
    </tr>`;
  };

  if (selector) rows += rowFor(selector, ` <span class="mux-badge">MUX=${selector.raw}</span>`);
  for (const d of nonMuxed) rows += rowFor(d);
  if (muxed.length) {
    const selVal = selector ? selector.raw : "?";
    rows += `<tr class="pp-mux-divider"><td colspan="3">When selector = ${selVal}</td></tr>`;
    for (const d of muxed) rows += rowFor(d);
  }

  return `<div class="paste-payload">
    <div class="pp-hex">${hexPretty}${countTag}</div>
    <table class="pp-table"><thead><tr><th>Signal</th><th>Raw</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>
  </div>`;
}

function prettyHex(data: Uint8Array): string {
  const parts: string[] = [];
  for (const b of data) parts.push(b.toString(16).toUpperCase().padStart(2, "0"));
  return parts.join(" ");
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
    if (!Number.isNaN(mid)) openMessage(mid);
    return;
  }
  const row = target.closest<HTMLElement>("tr[data-sigkey]");
  if (row) {
    const key = row.dataset.sigkey;
    if (!key) return;
    const idx = state.filtered.findIndex((x) => x.key === key);
    if (idx >= 0) openSignal(idx);
  }
}
