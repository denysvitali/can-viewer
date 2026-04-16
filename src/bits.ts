import type { Signal } from "./types.ts";
import { esc, signalColor } from "./helpers.ts";

// Bit diagram for a single signal: highlights the bits it occupies.
export function renderBits(startBit: number, width: number): string {
  let h = '<div class="bit-diagram">';
  for (let byte = 0; byte < 8; byte++) {
    h += `<div class="bit-byte-label">Byte ${byte}</div><div class="bit-row">`;
    for (let bit = 7; bit >= 0; bit--) {
      const abs = byte * 8 + bit;
      const inRange = abs >= startBit && abs < startBit + width;
      const label = inRange ? (abs - startBit) : abs;
      h += `<div class="bit-cell${inRange ? " hl" : ""}">${label}</div>`;
    }
    h += "</div>";
  }
  h += "</div>";
  return h;
}

// 64-bit map showing every signal in a message plus a color-coded legend.
export function renderFrameOverview(msgSigs: Signal[]): string {
  const bits: (string | null)[] = new Array(64).fill(null);
  for (const s of msgSigs) {
    const sig = s.Signal;
    if (!sig || sig.Width === undefined || sig.StartPosition === undefined) continue;
    const start = sig.StartPosition;
    for (let b = start; b < start + sig.Width && b < 64; b++) {
      if (b >= 0) bits[b] = s.key;
    }
  }

  let h = '<div class="bit-diagram">';
  for (let byte = 0; byte < 8; byte++) {
    h += `<div class="bit-byte-label">Byte ${byte}</div><div class="bit-row">`;
    for (let bit = 7; bit >= 0; bit--) {
      const abs = byte * 8 + bit;
      const owner = bits[abs];
      const cls = owner ? "hl" : "";
      const bg = owner ? `background:${signalColor(owner)}` : "";
      h += `<div class="bit-cell ${cls}" style="${bg}">${abs}</div>`;
    }
    h += "</div>";
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
