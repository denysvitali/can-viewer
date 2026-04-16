import type { Signal } from "./types.ts";
import { esc, signalColor } from "./helpers.ts";

// Return the ordered list of flat bit indices (byte*8 + bitInByte where bit 0
// is the byte LSB) that a signal covers, given its DBC endianness.
export function signalBitIndices(
  startBit: number,
  width: number,
  endianness: "LITTLE" | "BIG",
): number[] {
  const out: number[] = [];
  if (width <= 0) return out;
  if (endianness === "LITTLE") {
    for (let i = 0; i < width; i++) out.push(startBit + i);
  } else {
    let bitPos = startBit;
    for (let i = 0; i < width; i++) {
      out.push(bitPos);
      const bitIdx = bitPos & 7;
      if (bitIdx === 0) bitPos += 15;
      else bitPos -= 1;
    }
  }
  return out;
}

// Bit diagram for a single signal: highlights the bits it occupies.
export function renderBits(startBit: number, width: number): string {
  let h = '<div class="bit-diagram">';
  for (let byte = 0; byte < 8; byte++) {
    h += `<div class="bit-byte-label">B${byte}</div>`;
    for (let bit = 7; bit >= 0; bit--) {
      const abs = byte * 8 + bit;
      const inRange = abs >= startBit && abs < startBit + width;
      const label = inRange ? (abs - startBit) : abs;
      h += `<div class="bit-cell${inRange ? " hl" : ""}">${label}</div>`;
    }
  }
  h += "</div>";
  return h;
}

// 64-bit map showing every signal in a message plus a color-coded legend.
// Assumes little-endian for the ownership sweep (frame overview is
// informational — per-signal detail uses the precise helper).
export function renderFrameOverview(msgSigs: Signal[]): string {
  const bits: (string | null)[] = new Array(64).fill(null);
  for (const s of msgSigs) {
    const sig = s.Signal;
    if (!sig || sig.Width === undefined || sig.StartPosition === undefined) continue;
    const idxs = signalBitIndices(sig.StartPosition, sig.Width, sig.Endianness ?? "LITTLE");
    for (const b of idxs) if (b >= 0 && b < 64) bits[b] = s.key;
  }

  let h = '<div class="bit-diagram">';
  for (let byte = 0; byte < 8; byte++) {
    h += `<div class="bit-byte-label">B${byte}</div>`;
    for (let bit = 7; bit >= 0; bit--) {
      const abs = byte * 8 + bit;
      const owner = bits[abs];
      const cls = owner ? "hl" : "";
      const bg = owner ? `background:${signalColor(owner)}15;border-color:${signalColor(owner)}60;color:${signalColor(owner)}` : "";
      h += `<div class="bit-cell ${cls}" style="${bg}">${abs}</div>`;
    }
  }
  h += "</div>";

  const seen = new Set<string>();
  h += '<div class="legend">';
  for (const s of msgSigs) {
    if (seen.has(s.key) || !s.Signal?.Width) continue;
    seen.add(s.key);
    h += `<div class="legend-item">
      <div class="legend-swatch" style="background:${signalColor(s.key)}"></div>
      <span class="legend-label">${esc(s.Name || s.key)}</span></div>`;
  }
  h += '</div>';
  return h;
}

// Decoder-tab per-payload bit grid. Shows each of the 8 bytes as a row of
// 8 cells carrying the bit value (0/1). Cells owned by an active signal are
// tinted with that signal's color; muxed signals only paint for the currently
// active variant. The selector bits get an extra outline so the gating
// structure is visible at a glance.
export interface PayloadGridOptions {
  selectorKey?: string;
  selectorRaw?: number;
}

export function renderPayloadGrid(
  msgSigs: Signal[],
  data: Uint8Array,
  opts: PayloadGridOptions = {},
): string {
  const { selectorKey, selectorRaw } = opts;

  // Ownership map: flat bit index → signal key (only active signals paint).
  const owners: (string | null)[] = new Array(64).fill(null);
  for (const s of msgSigs) {
    const sig = s.Signal;
    if (!sig || !sig.Width || sig.StartPosition === undefined) continue;
    const isMuxed = typeof s.MuxID === "number" && s.MuxID >= 0 && !!s.Muxer;
    if (isMuxed && selectorRaw !== undefined && s.MuxID !== selectorRaw) continue;
    const idxs = signalBitIndices(sig.StartPosition, sig.Width, sig.Endianness ?? "LITTLE");
    for (const b of idxs) if (b >= 0 && b < 64) owners[b] = s.key;
  }

  let h = '<div class="pp-grid-head">';
  h += '<div></div>';
  for (let bit = 7; bit >= 0; bit--) h += `<div>${bit}</div>`;
  h += '<div>hex</div>';
  h += '</div>';

  h += '<div class="pp-grid">';
  for (let byte = 0; byte < 8; byte++) {
    h += `<div class="pp-grid-bytelabel">B${byte}</div>`;
    for (let bit = 7; bit >= 0; bit--) {
      const abs = byte * 8 + bit;
      const val = byte < data.length ? ((data[byte]! >> bit) & 1) : 0;
      const owner = owners[abs];
      const onCls = val ? " on" : "";
      if (owner) {
        const col = signalColor(owner);
        const isSelectorBit = selectorKey === owner;
        const selCls = isSelectorBit ? " is-selector" : "";
        const css = `--sig-bg:${col}26;--sig-bg-on:${col};--sig-border:${col}80;--sig-ink:${col}`;
        h += `<div class="pp-bit signal${onCls}${selCls}" data-sigkey="${esc(owner)}" style="${css}" title="${esc(owner)}">${val}</div>`;
      } else {
        const outCls = byte >= data.length ? " out" : "";
        h += `<div class="pp-bit${onCls}${outCls}">${val}</div>`;
      }
    }
    const byteHex = byte < data.length
      ? data[byte]!.toString(16).toUpperCase().padStart(2, "0")
      : "—";
    h += `<div class="pp-grid-bytehex">${byteHex}</div>`;
  }
  h += '</div>';
  return h;
}
