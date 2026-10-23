import { state } from "./state.ts";
import {
  $detailBack, $detailScroll, $detailTitle,
} from "./dom.ts";
import {
  calcPhysMax, calcPhysMin, esc, fmt, formatHexId, prop,
} from "./helpers.ts";
import { renderBits } from "./bits.ts";
import { showPane } from "./views.ts";
import { openMessage } from "./message.ts";
import { markActiveSignal } from "./list.ts";
import { t, fmtOtherSignals, fmtMore, fmtSelectorBits } from "./i18n.ts";

let openIdx: number | null = null;

export function initSignalView(): void {
  $detailBack.addEventListener("click", () => {
    openIdx = null;
    markActiveSignal(null);
    showPane("empty");
  });
}

// Re-render the currently-open signal (if any) — used after a language
// switch so the detail pane reflects the new language without a reload.
export function reRenderSignal(): void {
  if (openIdx !== null) openSignal(openIdx);
}

export function openSignal(idx: number): void {
  const s = state.filtered[idx];
  if (!s) return;
  const sig = s.Signal ?? {};

  openIdx = idx;
  markActiveSignal(s.key);
  $detailTitle.textContent = s.Name || s.key;

  let h = "";

  // Message link card
  h += `<div class="section">
    <div class="msg-link-card" data-mid="${s.ID}">
      <div class="mlc-main">
        <div class="mlc-title">${esc(s.MessageName ?? "")}</div>
        <div class="mlc-sub">${formatHexId(s.ID)} · ${esc(s.BusName ?? "")} ${t("common.bus")}${s.CycleTime ? " · " + s.CycleTime + "ms" : ""}</div>
      </div>
      <div class="mlc-chev">›</div>
    </div>
  </div>`;

  // Properties
  h += `<div class="section"><div class="section-label">${t("signal.definition")}</div><div class="props">`;
  h += prop(t("signal.startBit"), sig.StartPosition);
  h += prop(t("signal.bitWidth"), sig.Width);
  h += prop(
    t("signal.byteOrder"),
    sig.Endianness === "LITTLE" ? t("signal.littleEndian")
      : sig.Endianness === "BIG" ? t("signal.bigEndian")
      : "—",
  );
  h += prop(t("common.signed"), sig.Signedness ?? "—");
  h += prop(t("signal.scale"), sig.Scale);
  h += prop(t("signal.offset"), sig.Offset);
  h += prop(t("signal.clearMask"), sig.ClearMask !== undefined ? "0x" + sig.ClearMask.toString(16).toUpperCase() : "—");
  h += prop(t("signal.units"), s.Units ?? "—");
  h += `</div></div>`;

  // Multiplexor context
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
    h += `<div class="section"><div class="section-label">${t("signal.multiplexor")}</div><div class="props">`;
    if (isMuxed) {
      const mux = s.MuxSignal;
      const selector = sameMsgSigs.find((o) => o.Name === s.Muxer);
      const muxerHtml = selector
        ? `<span class="rel-chip" data-relkey="${esc(selector.key)}">${esc(s.Muxer!)}</span>`
        : esc(s.Muxer!);
      h += prop(t("signal.role"), t("signal.muxedSignalRole"));
      h += `<div class="prop"><div class="pl">${t("signal.presentWhen")}</div><div class="pv">${muxerHtml} = ${esc(String(s.MuxID))}</div></div>`;
      if (mux && mux.Width) {
        h += prop(t("signal.selectorBits"), fmtSelectorBits(mux.StartPosition, mux.Width));
      }
    } else {
      h += prop(t("signal.role"), t("signal.muxSelectorRole"));
      const ids = gatedChildren
        .map((c) => c.MuxID as number)
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort((a, b) => a - b);
      h += prop(t("signal.gatesVariants"), ids.join(", "));
      h += prop(t("signal.gatedSignals"), gatedChildren.length);
    }
    h += `</div></div>`;
  }

  // Formula
  if (sig.Scale !== undefined && sig.Scale !== 0 && sig.Width) {
    const physMin = calcPhysMin(sig);
    const physMax = calcPhysMax(sig);
    const offsetStr = sig.Offset
      ? (sig.Offset > 0 ? " + " : " − ") + Math.abs(sig.Offset)
      : "";
    h += `<div class="section"><div class="section-label">${t("signal.physicalValue")}</div>
      <div class="formula-card">
        <div class="formula-text">raw × ${sig.Scale}${offsetStr}</div>
        <div class="formula-range"><span>${fmt(physMin)}</span><span>${fmt(physMax)}</span></div>
      </div>
    </div>`;
  }

  // Bit layout
  if (sig.StartPosition !== undefined && sig.Width) {
    h += `<div class="section"><div class="section-label">${t("signal.bitLayout")}</div>`;
    h += renderBits(sig.StartPosition, sig.Width);
    h += `</div>`;
  }

  // Enums
  if (s.ValueDescription && typeof s.ValueDescription === "object") {
    const entries = Object.entries(s.ValueDescription)
      .sort((a, b) => Number(a[0]) - Number(b[0]));
    if (entries.length) {
      h += `<div class="section"><div class="section-label">${t("signal.values")}</div><div class="enum-list">`;
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
    h += `<div class="section"><div class="section-label">${fmtOtherSignals(others.length)}</div><div class="related-grid">`;
    for (const ok of others.slice(0, 40)) {
      const os = state.sigByKey[ok];
      h += `<span class="rel-chip" data-relkey="${esc(ok)}">${esc(os ? (os.Name ?? os.key) : ok)}</span>`;
    }
    if (others.length > 40) {
      h += `<span class="rel-chip" style="color:var(--text-4)">${fmtMore(others.length - 40)}</span>`;
    }
    h += `</div></div>`;
  }

  $detailScroll.innerHTML = h;
  $detailScroll.scrollTop = 0;
  showPane("detail");

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
