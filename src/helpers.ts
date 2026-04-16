import type { SignalDefinition } from "./types.ts";

export function esc(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

export function fmt(n: unknown): string {
  if (typeof n !== "number") return "—";
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatHexId(id: number | undefined): string {
  return "0x" + (id ?? 0).toString(16).toUpperCase().padStart(3, "0");
}

export function prop(label: string, value: unknown): string {
  return `<div class="prop"><div class="pl">${label}</div><div class="pv">${esc(String(value ?? "—"))}</div></div>`;
}

export function calcPhysMin(sig: SignalDefinition): number {
  const scale = sig.Scale ?? 0;
  const offset = sig.Offset ?? 0;
  if (sig.Signedness === "SIGNED" && sig.Width) {
    return -scale * (1 << (sig.Width - 1)) + offset;
  }
  return offset;
}

export function calcPhysMax(sig: SignalDefinition): number {
  if (!sig.Width) return 0;
  const scale = sig.Scale ?? 0;
  const offset = sig.Offset ?? 0;
  const rawMax = sig.Signedness === "SIGNED"
    ? (1 << (sig.Width - 1)) - 1
    : (1 << sig.Width) - 1;
  return scale * rawMax + offset;
}

// Deterministic color per signal key, cached for consistency across renders.
const _colorCache: Record<string, string> = {};
export function signalColor(key: string): string {
  const cached = _colorCache[key];
  if (cached) return cached;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  const hue = ((hash & 0xFFFF) % 300) + 30;
  const color = `hsl(${hue},65%,55%)`;
  _colorCache[key] = color;
  return color;
}
