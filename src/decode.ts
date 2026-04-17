import type { Signal, SignalDefinition } from "./types.ts";

export interface ParsedFrame {
  id: number;
  data: Uint8Array;
  raw: string;
  rewritten: boolean;
}

export interface ParseResult {
  frames: ParsedFrame[];
  errors: { line: number; text: string; reason: string }[];
}

// Accepts lines like `7FFs:06A03400032010C0` or `7FFx:...` (ID:data).
// The char between ID and ':' is tolerated but ignored — typically 's' for
// standard or 'x' for extended. An optional leading `*` marks the frame as
// a rewritten/edited variant so callers can diff it against the prior frame
// of the same ID.
const LINE_RE = /^\s*(\*)?\s*([0-9A-Fa-f]+)[sxSX]?\s*:\s*([0-9A-Fa-f]+)\s*$/;

export function parseFrames(input: string): ParseResult {
  const frames: ParsedFrame[] = [];
  const errors: ParseResult["errors"] = [];
  const lines = input.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]!;
    if (!text.trim()) continue;
    const m = LINE_RE.exec(text);
    if (!m) {
      errors.push({ line: i + 1, text, reason: "unrecognised format" });
      continue;
    }
    const rewritten = !!m[1];
    const id = parseInt(m[2]!, 16);
    const hex = m[3]!;
    if (hex.length % 2 !== 0) {
      errors.push({ line: i + 1, text, reason: "data has odd hex length" });
      continue;
    }
    const data = new Uint8Array(hex.length / 2);
    for (let b = 0; b < data.length; b++) {
      data[b] = parseInt(hex.slice(b * 2, b * 2 + 2), 16);
    }
    frames.push({ id, data, raw: text.trim(), rewritten });
  }
  return { frames, errors };
}

// Extract a signal's raw integer value from `data` using DBC bit layout rules.
// Little-endian (Intel): StartPosition is the LSB, bits grow linearly through
// the flat bit index N = byte*8 + bitInByte (bitInByte=0 is LSB of that byte).
// Big-endian (Motorola): StartPosition is the MSB in DBC sawtooth numbering —
// within a byte bits run 7..0; at byte boundaries we jump to the next byte's
// MSB. Both widths up to 53 bits stay safe in a JS number.
export function extractRaw(
  data: Uint8Array,
  startBit: number,
  width: number,
  endianness: "LITTLE" | "BIG",
): number {
  if (width <= 0) return 0;
  let raw = 0;

  if (endianness === "LITTLE") {
    for (let i = 0; i < width; i++) {
      const bitPos = startBit + i;
      const byteIdx = bitPos >> 3;
      const bitIdx = bitPos & 7;
      if (byteIdx < data.length) {
        const bit = (data[byteIdx]! >> bitIdx) & 1;
        if (bit) raw += Math.pow(2, i);
      }
    }
  } else {
    let bitPos = startBit;
    for (let i = 0; i < width; i++) {
      const byteIdx = bitPos >> 3;
      const bitIdx = bitPos & 7;
      if (byteIdx < data.length) {
        const bit = (data[byteIdx]! >> bitIdx) & 1;
        if (bit) raw += Math.pow(2, width - 1 - i);
      }
      if (bitIdx === 0) bitPos += 15;
      else bitPos -= 1;
    }
  }

  return raw;
}

export function applySign(raw: number, width: number, signed: boolean): number {
  if (!signed) return raw;
  const signBit = Math.pow(2, width - 1);
  if (raw >= signBit) return raw - Math.pow(2, width);
  return raw;
}

export interface DecodedSignal {
  key: string;
  name: string;
  raw: number;
  physical: number;
  units: string;
  valueDescription?: string;
  muxId?: number;
  isSelector: boolean;
}

// Decode every signal attached to a message, honouring multiplexing:
// if a signal has `MuxID >= 0` it is emitted only when the selector's raw
// value matches. The selector itself is always emitted and flagged.
export function decodeMessage(msgSigs: Signal[], data: Uint8Array): DecodedSignal[] {
  const selectorName = msgSigs.find((s) => s.Muxer)?.Muxer ?? "";
  const selector = selectorName
    ? msgSigs.find((s) => s.Name === selectorName)
    : undefined;
  const selectorRaw = selector?.Signal
    ? extractRaw(
        data,
        selector.Signal.StartPosition ?? 0,
        selector.Signal.Width ?? 0,
        selector.Signal.Endianness ?? "LITTLE",
      )
    : undefined;

  const out: DecodedSignal[] = [];
  for (const s of msgSigs) {
    const sig = s.Signal;
    if (!sig || !sig.Width) continue;
    const isMuxed = typeof s.MuxID === "number" && s.MuxID >= 0 && !!s.Muxer;
    if (isMuxed && selectorRaw !== undefined && s.MuxID !== selectorRaw) continue;

    const raw = applySign(
      extractRaw(data, sig.StartPosition ?? 0, sig.Width, sig.Endianness ?? "LITTLE"),
      sig.Width,
      sig.Signedness === "SIGNED",
    );
    const scale = sig.Scale ?? 1;
    const offset = sig.Offset ?? 0;
    const physical = raw * scale + offset;

    const vd = s.ValueDescription?.[String(raw)];
    out.push({
      key: s.key,
      name: s.Name ?? s.key,
      raw,
      physical,
      units: signalUnits(s, sig),
      valueDescription: vd,
      muxId: isMuxed ? s.MuxID : undefined,
      isSelector: selector === s,
    });
  }
  return out;
}

function signalUnits(s: Signal, sig: SignalDefinition): string {
  return (sig.Units ?? s.Units ?? "").trim();
}
