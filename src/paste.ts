import type { Signal } from "./types.ts";
import type { DecodedSignal } from "./decode.ts";
import type { Message } from "./types.ts";
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

interface DecodedPayload {
  data: Uint8Array;
  count: number;
  decoded: DecodedSignal[];
  selectorKey?: string;
  selectorName?: string;
  selectorRaw?: number;
}
interface DecodedBlock {
  id: number;
  msg?: Message;
  msgSigs: Signal[];
  frameCount: number;
  payloads: DecodedPayload[];
}
// Cache decoded output by CAN id so the copy handler can reformat the
// block without re-parsing the textarea.
const lastBlocks = new Map<number, DecodedBlock>();

export function initPasteView(): void {
  $pasteDecode.addEventListener("click", renderDecoded);
  $pasteClear.addEventListener("click", () => {
    $pasteInput.value = "";
    lastBlocks.clear();
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
  lastBlocks.clear();

  if (!frames.length && !errors.length) {
    $pasteOutput.innerHTML = hint();
    return;
  }

  // Group by ID, dedup identical payloads (byte-wise).
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

  // Build + cache blocks.
  for (const id of ids) {
    const payloads = byId.get(id)!;
    payloads.sort((a, b) => a.order - b.order);
    const msg = state.messages[id];
    const msgSigs: Signal[] = msg
      ? msg.signals.map((k) => state.sigByKey[k]).filter((s): s is Signal => Boolean(s))
      : [];
    const block: DecodedBlock = {
      id,
      msg,
      msgSigs,
      frameCount: payloads.reduce((n, p) => n + p.count, 0),
      payloads: payloads.map((p) => {
        const decoded = msgSigs.length ? decodeMessage(msgSigs, p.data) : [];
        const selector = decoded.find((d) => d.isSelector);
        return {
          data: p.data,
          count: p.count,
          decoded,
          selectorKey: selector?.key,
          selectorName: selector?.name,
          selectorRaw: selector?.raw,
        };
      }),
    };
    lastBlocks.set(id, block);
  }

  // Render.
  const totalPayloads = [...lastBlocks.values()].reduce((n, b) => n + b.payloads.length, 0);
  let h = "";
  h += `<div class="paste-summary-bar">
    <span class="summary-stat"><strong>${frames.length}</strong><span class="stat-label">frames</span></span>
    <span class="summary-sep"></span>
    <span class="summary-stat"><strong>${ids.length}</strong><span class="stat-label">IDs</span></span>
    <span class="summary-sep"></span>
    <span class="summary-stat"><strong>${totalPayloads}</strong><span class="stat-label">unique payloads</span></span>
    ${errors.length ? `<span class="summary-sep"></span><span class="summary-stat"><strong style="color:var(--warn)">${errors.length}</strong><span class="stat-label">skipped</span></span>` : ""}
    <button class="ghost-btn pb-copy-all" title="Copy all decoded blocks">
      ${copyIconSvg()}
      <span>Copy all</span>
    </button>
  </div>`;

  if (errors.length) {
    h += `<details class="paste-errors"><summary>Skipped ${errors.length} line${errors.length === 1 ? "" : "s"}</summary><ul>`;
    for (const e of errors.slice(0, 50)) {
      h += `<li><span class="err-line">line ${e.line}</span> <code>${esc(e.text)}</code> — ${esc(e.reason)}</li>`;
    }
    if (errors.length > 50) h += `<li>…and ${errors.length - 50} more</li>`;
    h += `</ul></details>`;
  }

  for (const id of ids) h += renderIdBlock(lastBlocks.get(id)!);

  $pasteOutput.innerHTML = h;
}

function renderIdBlock(block: DecodedBlock): string {
  const { id, msg, msgSigs, frameCount, payloads } = block;
  const known = !!msg;
  const header = known
    ? `<div>
        <div class="pb-title-row">
          <span class="pb-name">${esc(msg!.name)}</span>
          <span class="pb-id">${formatHexId(id)}</span>
        </div>
        <div class="pb-meta">
          <span><b>${msgSigs.length}</b> signals</span>
          <span><b>${frameCount}</b> frames</span>
          <span><b>${payloads.length}</b> unique</span>
          ${msg!.cycleTime ? `<span>cycle <b>${msg!.cycleTime}ms</b></span>` : ""}
          ${msg!.bus ? `<span>bus <b>${esc(msg!.bus)}</b></span>` : ""}
        </div>
      </div>`
    : `<div>
        <div class="pb-title-row">
          <span class="pb-name unknown">Unknown message</span>
          <span class="pb-id">${formatHexId(id)}</span>
        </div>
        <div class="pb-meta">
          <span><b>${frameCount}</b> frames</span>
          <span><b>${payloads.length}</b> unique</span>
          <span>not in loaded database</span>
        </div>
      </div>`;

  const headerActions = `<div class="pb-actions">
    <button class="pb-icon-btn pb-copy" data-mid="${id}" title="Copy decoded block" aria-label="Copy">
      ${copyIconSvg()}
    </button>
    ${known ? `<button class="pb-open" data-mid="${id}" title="Open message detail">
      Open
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 2 6 5 3 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
    </button>` : ""}
  </div>`;

  let body = "";
  for (let i = 0; i < payloads.length; i++) {
    body += renderPayload(id, i, payloads[i]!, msgSigs);
  }

  return `<div class="paste-block${known ? "" : " unknown"}" data-mid="${id}">
    <div class="pb-header">${header}${headerActions}</div>
    <div class="pb-body">${body}</div>
  </div>`;
}

function renderPayload(
  mid: number,
  idx: number,
  p: DecodedPayload,
  msgSigs: Signal[],
): string {
  const hexRow = prettyHexRow(p.data);
  const countTag = p.count > 1 ? `<span class="pp-count">×${p.count}</span>` : "";

  if (!msgSigs.length) {
    return `<div class="paste-payload" data-pidx="${idx}">
      <div class="pp-head">${hexRow}${countTag}</div>
      <div class="pp-empty">No definitions for this ID in the loaded database.</div>
    </div>`;
  }

  const grid = renderPayloadGrid(msgSigs, p.data, {
    selectorKey: p.selectorKey,
    selectorRaw: p.selectorRaw,
  });

  const selector = p.decoded.find((d) => d.isSelector);
  const nonMuxed = p.decoded.filter((d) => d.muxId === undefined && !d.isSelector);
  const muxed = p.decoded.filter((d) => d.muxId !== undefined);

  const rowFor = (d: DecodedSignal, inMuxGroup = false): string => {
    const physStr = Number.isFinite(d.physical) ? fmt(d.physical) : "—";
    const vd = d.valueDescription ? ` <span class="pp-enum">${esc(d.valueDescription)}</span>` : "";
    const units = d.units ? `<span class="pp-units">${esc(d.units)}</span>` : "";
    const color = signalColor(d.key);
    const dot = `<span class="pp-dot" style="background:${color}"></span>`;
    const badge = d.isSelector
      ? ` <span class="mux-badge">MUX</span>`
      : inMuxGroup
        ? ` <span class="mux-badge" title="Only present for this selector value">ID ${d.muxId}</span>`
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

  const copyBtn = `<button class="pp-copy" data-mid="${mid}" data-pidx="${idx}" title="Copy this payload" aria-label="Copy payload">
    ${copyIconSvg()}
  </button>`;

  return `<div class="paste-payload" data-pidx="${idx}">
    <div class="pp-head">${hexRow}${countTag}${selectorChip}${copyBtn}</div>
    <div class="pp-grid-wrap">${grid}</div>
    <table class="pp-table">
      <thead><tr><th>Signal</th><th style="text-align:right">Raw</th><th style="text-align:right">Value</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function copyIconSvg(): string {
  return `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
    <rect x="3.5" y="3.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.2"/>
    <path d="M2 9V2.5A.5.5 0 0 1 2.5 2H9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`;
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

/* ---------------- Clipboard formatting ---------------- */

function formatBlock(block: DecodedBlock): string {
  const { id, msg, payloads } = block;
  const header = msg
    ? `${msg.name}\t${formatHexId(id)}\t${msg.bus}\t${msg.cycleTime ? msg.cycleTime + "ms" : ""}`
    : `(unknown)\t${formatHexId(id)}`;
  const out: string[] = [header];
  for (let i = 0; i < payloads.length; i++) {
    out.push("", formatPayload(payloads[i]!, i + 1));
  }
  return out.join("\n");
}

function formatPayload(p: DecodedPayload, label?: number): string {
  const hex = [...p.data].map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
  const head = label !== undefined ? `Payload ${label}: ${hex}` : `Payload: ${hex}`;
  const sub = p.count > 1 ? ` (×${p.count})` : "";
  const lines = [head + sub];
  if (p.selectorName !== undefined && p.selectorRaw !== undefined) {
    lines.push(`Selector: ${p.selectorName} = ${p.selectorRaw}`);
  }
  if (!p.decoded.length) {
    lines.push("(no definitions in database)");
    return lines.join("\n");
  }
  lines.push(["Signal", "Bits", "Raw", "Physical", "Units", "Value"].join("\t"));
  for (const d of p.decoded) {
    const physStr = Number.isFinite(d.physical) ? String(d.physical) : "";
    const muxTag = d.isSelector ? " [MUX]"
      : d.muxId !== undefined ? ` [ID=${d.muxId}]`
      : "";
    lines.push([
      d.name + muxTag,
      bitsLabel(d),
      String(d.raw),
      physStr,
      d.units ?? "",
      d.valueDescription ?? "",
    ].join("\t"));
  }
  return lines.join("\n");
}

function bitsLabel(d: DecodedSignal): string {
  // DecodedSignal doesn't carry the bit range directly; look it up from state.
  const s = state.sigByKey[d.key]?.Signal;
  return s && s.Width ? `${s.StartPosition}:${s.Width}` : "";
}

async function copyText(text: string, indicator?: HTMLElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } finally { document.body.removeChild(ta); }
  }
  if (indicator) flashCopied(indicator);
}

function flashCopied(el: HTMLElement): void {
  el.classList.add("copied");
  const label = el.querySelector("span");
  const prev = label?.textContent ?? null;
  if (label) label.textContent = "Copied";
  setTimeout(() => {
    el.classList.remove("copied");
    if (label && prev !== null) label.textContent = prev;
  }, 1200);
}

/* ---------------- Event handling ---------------- */

function onOutputClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;

  // Copy-all
  const copyAll = target.closest<HTMLElement>(".pb-copy-all");
  if (copyAll) {
    e.stopPropagation();
    const parts = [...lastBlocks.values()].map(formatBlock);
    copyText(parts.join("\n\n───\n\n"), copyAll);
    return;
  }

  // Copy block
  const copyBlock = target.closest<HTMLElement>(".pb-copy");
  if (copyBlock) {
    e.stopPropagation();
    const mid = Number(copyBlock.dataset.mid);
    const block = lastBlocks.get(mid);
    if (block) copyText(formatBlock(block), copyBlock);
    return;
  }

  // Copy payload
  const copyPay = target.closest<HTMLElement>(".pp-copy");
  if (copyPay) {
    e.stopPropagation();
    const mid = Number(copyPay.dataset.mid);
    const idx = Number(copyPay.dataset.pidx);
    const block = lastBlocks.get(mid);
    const p = block?.payloads[idx];
    if (block && p) {
      const header = block.msg
        ? `${block.msg.name}\t${formatHexId(mid)}`
        : `(unknown)\t${formatHexId(mid)}`;
      copyText(`${header}\n\n${formatPayload(p)}`, copyPay);
    }
    return;
  }

  // Open-message
  const openBtn = target.closest<HTMLElement>(".pb-open");
  if (openBtn) {
    const mid = Number(openBtn.dataset.mid);
    if (!Number.isNaN(mid)) {
      switchTab("signals");
      openMessage(mid);
    }
    return;
  }

  // Row click → open signal
  const row = target.closest<HTMLElement>("tr[data-sigkey]");
  if (row) {
    const key = row.dataset.sigkey;
    if (!key) return;
    const i = state.filtered.findIndex((x) => x.key === key);
    if (i >= 0) {
      switchTab("signals");
      openSignal(i);
    }
  }
}
