import type { Signal } from "./types.ts";
import { state } from "./state.ts";
import {
  $msgBack, $msgCopy, $msgScroll, $msgTitle,
} from "./dom.ts";
import { esc, formatHexId, prop, signalColor } from "./helpers.ts";
import { renderFrameOverview } from "./bits.ts";
import { showPane } from "./views.ts";
import { openSignal } from "./signal.ts";

let currentMid: number | null = null;

export function initMessageView(): void {
  $msgBack.addEventListener("click", () => {
    currentMid = null;
    showPane("empty");
  });
  $msgCopy.addEventListener("click", onCopy);
}

export function openMessage(mid: number): void {
  const msg = state.messages[mid];
  if (!msg) return;
  currentMid = mid;
  const msgSigs = msg.signals
    .map((k) => state.sigByKey[k])
    .filter((s): s is Signal => Boolean(s));

  $msgTitle.innerHTML = `${esc(msg.name)}<span class="pane-title-hex">${formatHexId(msg.id)}</span>`;

  let h = "";

  h += `<div class="section"><div class="props">`;
  h += prop("CAN ID", `${formatHexId(msg.id)} (${msg.id})`);
  h += prop("Bus", `${msg.bus} · ${msg.busNum ?? "?"}`);
  h += prop("Signals", msgSigs.length);
  h += prop("Cycle Time", msg.cycleTime ? msg.cycleTime + " ms" : "—");
  h += `</div></div>`;

  if (msgSigs.some((s) => s.Signal?.Width)) {
    h += `<div class="section"><div class="section-label">Frame Layout</div>
      <div class="frame-overview"><div class="frame-canvas">${renderFrameOverview(msgSigs)}</div></div>
    </div>`;
  }

  // Group signals by mux variant.
  const muxedKey = (s: Signal) =>
    typeof s.MuxID === "number" && s.MuxID >= 0 && s.Muxer ? `${s.Muxer}=${s.MuxID}` : "";
  const selectorNames = new Set(msgSigs.map(muxedKey).filter(Boolean).map((k) => k.split("=")[0]));
  const plain: Signal[] = [];
  const muxGroups = new Map<string, Signal[]>();
  for (const s of msgSigs) {
    const mk = muxedKey(s);
    if (mk) {
      const arr = muxGroups.get(mk) ?? [];
      arr.push(s);
      muxGroups.set(mk, arr);
    } else {
      plain.push(s);
    }
  }

  const renderSig = (s: Signal): string => {
    const sig = s.Signal ?? {};
    const color = signalColor(s.key);
    const scaleStr = sig.Scale && sig.Scale !== 1 ? ` · ×${sig.Scale}` : "";
    const offsetStr = sig.Offset ? ` · ${sig.Offset > 0 ? "+" : ""}${sig.Offset}` : "";
    const signedStr = sig.Signedness === "SIGNED" ? " · signed" : "";
    const unitsStr = s.Units ? ` · ${esc(s.Units)}` : "";
    const bitStr = sig.StartPosition !== undefined
      ? `bit ${sig.StartPosition}:${sig.Width ?? "?"}`
      : "";
    const isSelector = s.Name && selectorNames.has(s.Name);
    const badge = isSelector ? `<span class="mux-badge">MUX</span>` : "";
    return `<div class="msg-signal-item" data-sigkey="${esc(s.key)}">
      <div class="msg-sig-color" style="background:${color}"></div>
      <div class="msg-sig-info">
        <div class="msg-sig-name">${esc(s.Name || s.key)}${badge}</div>
        <div class="msg-sig-detail">${bitStr}${scaleStr}${offsetStr}${signedStr}${unitsStr}</div>
      </div>
    </div>`;
  };

  h += `<div class="msg-signals-heading">Signals</div>`;
  for (const s of plain) h += renderSig(s);

  const sortedMuxKeys = [...muxGroups.keys()].sort((a, b) => {
    const [ma, va] = a.split("="); const [mb, vb] = b.split("=");
    return ma!.localeCompare(mb!) || Number(va) - Number(vb);
  });
  for (const mk of sortedMuxKeys) {
    const [muxer, mid2] = mk.split("=");
    h += `<div class="mux-group-label">When <code>${esc(muxer!)}</code> = ${esc(mid2!)}</div>`;
    for (const s of muxGroups.get(mk)!) h += renderSig(s);
  }

  $msgScroll.innerHTML = h;
  $msgScroll.scrollTop = 0;
  showPane("msg");

  $msgScroll.querySelectorAll<HTMLElement>(".msg-signal-item").forEach((el) => {
    el.addEventListener("click", () => {
      const sigKey = el.dataset.sigkey;
      if (!sigKey) return;
      const ridx = state.filtered.findIndex((x) => x.key === sigKey);
      if (ridx >= 0) openSignal(ridx);
    });
  });
}

function onCopy(): void {
  if (currentMid == null) return;
  const msg = state.messages[currentMid];
  if (!msg) return;

  const msgSigs = msg.signals
    .map((k) => state.sigByKey[k])
    .filter((s): s is Signal => Boolean(s));

  const header = [
    "Signal", "Start Bit", "Width", "Byte Order", "Signed",
    "Scale", "Offset", "Units", "Mux ID", "Values",
  ].join("\t");

  const rows = msgSigs.map((s) => {
    const sig = s.Signal ?? {};
    const vals = s.ValueDescription && typeof s.ValueDescription === "object"
      ? Object.entries(s.ValueDescription).map(([v, d]) => `${v}=${d}`).join(", ")
      : "";
    return [
      s.Name || s.key,
      sig.StartPosition ?? "",
      sig.Width ?? "",
      sig.Endianness ?? "",
      sig.Signedness ?? "",
      sig.Scale ?? "",
      sig.Offset ?? "",
      s.Units ?? "",
      typeof s.MuxID === "number" && s.MuxID >= 0 ? s.MuxID : "",
      vals,
    ].join("\t");
  });

  const title = `${msg.name}  ${formatHexId(msg.id)}`;
  const text = `${title}\n\n${header}\n${rows.join("\n")}`;

  const markCopied = () => {
    $msgCopy.classList.add("copied");
    const span = $msgCopy.querySelector("span");
    const prev = span?.textContent ?? "Copy";
    if (span) span.textContent = "Copied";
    setTimeout(() => {
      $msgCopy.classList.remove("copied");
      if (span) span.textContent = prev;
    }, 1500);
  };

  navigator.clipboard?.writeText(text).then(markCopied).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    markCopied();
  });
}
