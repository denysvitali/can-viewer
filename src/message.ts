import type { Signal } from "./types.ts";
import { state } from "./state.ts";
import {
  $list, $msg, $msgBack, $msgCopy, $msgScroll, $msgTitle,
} from "./dom.ts";
import { esc, formatHexId, prop, signalColor } from "./helpers.ts";
import { renderFrameOverview } from "./bits.ts";
import { showView } from "./views.ts";
import { openSignal } from "./signal.ts";

export function initMessageView(): void {
  $msgBack.addEventListener("click", () => showView($list));
  $msgCopy.addEventListener("click", onCopy);
}

export function openMessage(mid: number): void {
  const msg = state.messages[mid];
  if (!msg) return;
  const msgSigs = msg.signals
    .map((k) => state.sigByKey[k])
    .filter((s): s is Signal => Boolean(s));

  $msgTitle.textContent = `${msg.name}  ${formatHexId(msg.id)}`;

  let h = "";

  h += `<div class="section"><div class="props">`;
  h += prop("CAN ID", `${formatHexId(msg.id)} (${msg.id})`);
  h += prop("Bus", `${msg.bus} (bus ${msg.busNum ?? "?"})`);
  h += prop("Signals", msgSigs.length);
  h += prop("Cycle Time", msg.cycleTime ? msg.cycleTime + " ms" : "—");
  h += `</div></div>`;

  if (msgSigs.some((s) => s.Signal?.Width)) {
    h += `<div class="section"><div class="section-label">Frame Overview</div>
      <div class="frame-overview"><div class="frame-canvas">${renderFrameOverview(msgSigs)}</div></div>
    </div>`;
  }

  h += `<div class="section"><div class="section-label">Signals</div></div>`;
  for (const s of msgSigs) {
    const sig = s.Signal ?? {};
    const color = signalColor(s.key);
    const scaleStr = sig.Scale && sig.Scale !== 1 ? ` &middot; \u00D7${sig.Scale}` : "";
    const offsetStr = sig.Offset ? ` &middot; ${sig.Offset > 0 ? "+" : ""}${sig.Offset}` : "";
    const signedStr = sig.Signedness === "SIGNED" ? " &middot; signed" : "";
    const unitsStr = s.Units ? ` &middot; ${esc(s.Units)}` : "";
    const bitStr = sig.StartPosition !== undefined
      ? `bit ${sig.StartPosition}:${sig.Width ?? "?"}`
      : "";

    h += `<div class="msg-signal-item" data-sigkey="${esc(s.key)}">
      <div class="msg-sig-color" style="background:${color}"></div>
      <div class="msg-sig-info">
        <div class="msg-sig-name">${esc(s.Name || s.key)}</div>
        <div class="msg-sig-detail">${bitStr}${scaleStr}${offsetStr}${signedStr}${unitsStr}</div>
      </div>
    </div>`;
  }

  $msgScroll.innerHTML = h;
  $msgScroll.scrollTop = 0;
  showView($msg);

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
  const title = $msgTitle.textContent?.trim() ?? "";
  const hexMatch = title.match(/0x([0-9A-F]+)/);
  if (!hexMatch) return;
  const mid = parseInt(hexMatch[1]!, 16);
  const msg = state.messages[mid];
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

  const text = `${title}\n\n${header}\n${rows.join("\n")}`;
  const markCopied = () => {
    $msgCopy.classList.add("copied");
    $msgCopy.textContent = "\u2713";
    setTimeout(() => {
      $msgCopy.classList.remove("copied");
      $msgCopy.textContent = "\u{1F4CB}";
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
