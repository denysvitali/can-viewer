import { state } from "./state.ts";
import {
  $detail, $detailBack, $detailScroll, $detailTitle, $list,
} from "./dom.ts";
import {
  calcPhysMax, calcPhysMin, esc, fmt, formatHexId, prop,
} from "./helpers.ts";
import { renderBits } from "./bits.ts";
import { showView } from "./views.ts";
import { openMessage } from "./message.ts";

export function initSignalView(): void {
  $detailBack.addEventListener("click", () => showView($list));
}

export function openSignal(idx: number): void {
  const s = state.filtered[idx];
  if (!s) return;
  const sig = s.Signal ?? {};

  $detailTitle.textContent = s.Name || s.key;

  let h = "";

  // Message link card
  h += `<div class="section" style="padding-bottom:8px">
    <div class="msg-link-card" data-mid="${s.ID}">
      <div class="mlc-main">
        <div class="mlc-title">${esc(s.MessageName ?? "")}</div>
        <div class="mlc-sub">${formatHexId(s.ID)} &middot; ${esc(s.BusName ?? "")} bus${s.CycleTime ? " &middot; " + s.CycleTime + "ms" : ""}</div>
      </div>
      <div class="mlc-chev">&rsaquo;</div>
    </div>
  </div>`;

  // Properties
  h += `<div class="section"><div class="section-label">Signal Definition</div><div class="props">`;
  h += prop("Start Bit", sig.StartPosition);
  h += prop("Bit Width", sig.Width);
  h += prop(
    "Byte Order",
    sig.Endianness === "LITTLE" ? "Little-Endian"
      : sig.Endianness === "BIG" ? "Big-Endian"
      : "—",
  );
  h += prop("Signed", sig.Signedness ?? "—");
  h += prop("Scale", sig.Scale);
  h += prop("Offset", sig.Offset);
  h += prop("Clear Mask", sig.ClearMask !== undefined ? "0x" + sig.ClearMask.toString(16).toUpperCase() : "—");
  h += prop("Units", s.Units ?? "—");
  h += `</div></div>`;

  // Multiplexor context: either this signal is gated by a selector, or it *is*
  // a selector that gates other signals in the same message.
  const msgForMux = state.messages[s.ID];
  const sameMsgSigs = msgForMux
    ? msgForMux.signals.map((k) => state.sigByKey[k]).filter((x): x is typeof s => Boolean(x))
    : [];
  const isMuxed = typeof s.MuxID === "number" && s.MuxID >= 0 && !!s.Muxer;
  const gatedChildren = s.Name
    ? sameMsgSigs.filter((o) => o.Muxer === s.Name && typeof o.MuxID === "number" && o.MuxID >= 0)
    : [];
  const isSelector = gatedChildren.length > 0;

  if (isMuxed || isSelector) {
    h += `<div class="section"><div class="section-label">Multiplexor</div><div class="props">`;
    if (isMuxed) {
      const mux = s.MuxSignal;
      const selector = sameMsgSigs.find((o) => o.Name === s.Muxer);
      const muxerHtml = selector
        ? `<span class="rel-chip" data-relkey="${esc(selector.key)}">${esc(s.Muxer!)}</span>`
        : esc(s.Muxer!);
      h += prop("Role", "Muxed signal");
      h += `<div class="prop"><div class="pl">Present When</div><div class="pv">${muxerHtml} = ${esc(String(s.MuxID))}</div></div>`;
      if (mux && mux.Width) {
        h += prop("Selector Bits", `bit ${mux.StartPosition ?? "?"}, width ${mux.Width}`);
      }
    } else {
      h += prop("Role", "Mux selector");
      const ids = gatedChildren
        .map((c) => c.MuxID as number)
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort((a, b) => a - b);
      h += prop("Gates Variants", ids.join(", "));
      h += prop("Gated Signals", gatedChildren.length);
    }
    h += `</div></div>`;
  }

  // Formula
  if (sig.Scale !== undefined && sig.Scale !== 0 && sig.Width) {
    const physMin = calcPhysMin(sig);
    const physMax = calcPhysMax(sig);
    const offsetStr = sig.Offset
      ? (sig.Offset > 0 ? " + " : " \u2212 ") + Math.abs(sig.Offset)
      : "";
    h += `<div class="section"><div class="section-label">Physical Value</div>
      <div class="formula-card">
        <div class="formula-text">raw \u00D7 ${sig.Scale}${offsetStr}</div>
        <div class="formula-range"><span>${fmt(physMin)}</span><span>${fmt(physMax)}</span></div>
      </div>
    </div>`;
  }

  // Bit layout
  if (sig.StartPosition !== undefined && sig.Width) {
    h += `<div class="section"><div class="section-label">Bit Layout</div>`;
    h += renderBits(sig.StartPosition, sig.Width);
    h += `</div>`;
  }

  // Enums
  if (s.ValueDescription && typeof s.ValueDescription === "object") {
    const entries = Object.entries(s.ValueDescription)
      .sort((a, b) => Number(a[0]) - Number(b[0]));
    if (entries.length) {
      h += `<div class="section"><div class="section-label">Values</div><div class="enum-list">`;
      for (const [val, desc] of entries) {
        h += `<div class="enum-row"><span class="enum-val">${esc(val)}</span><span class="enum-desc">${esc(String(desc))}</span></div>`;
      }
      h += `</div></div>`;
    }
  }

  // Related signals on same message
  const msg = state.messages[s.ID];
  if (msg && msg.signals.length > 1) {
    const others = msg.signals.filter((k) => k !== s.key);
    h += `<div class="section"><div class="section-label">Other Signals (${others.length})</div><div class="related-grid">`;
    for (const ok of others.slice(0, 30)) {
      const os = state.sigByKey[ok];
      h += `<span class="rel-chip" data-relkey="${esc(ok)}">${esc(os ? (os.Name ?? os.key) : ok)}</span>`;
    }
    if (others.length > 30) {
      h += `<span class="rel-chip" style="color:var(--text3)">+${others.length - 30} more</span>`;
    }
    h += `</div></div>`;
  }

  $detailScroll.innerHTML = h;
  $detailScroll.scrollTop = 0;
  showView($detail);

  // Bind message link
  $detailScroll.querySelector<HTMLElement>(".msg-link-card")?.addEventListener("click", () => {
    openMessage(s.ID);
  });

  // Bind related chips
  $detailScroll.querySelectorAll<HTMLElement>(".rel-chip[data-relkey]").forEach((el) => {
    el.addEventListener("click", () => {
      const relKey = el.dataset.relkey;
      if (!relKey) return;
      const ridx = state.filtered.findIndex((x) => x.key === relKey);
      if (ridx >= 0) openSignal(ridx);
    });
  });
}
