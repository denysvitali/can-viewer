// Minimal hand-rolled i18n layer (en/zh). No external dependency on purpose —
// keeps the project's "no framework, no extra deps" footprint intact.
//
// NOTE: this module is imported by list.ts / signal.ts / message.ts / paste.ts
// (for t()/fmt* helpers) and in turn imports their re-render entry points so
// a language switch can refresh whatever is currently on screen. This forms
// an intentional ES module import cycle; it is safe because none of the
// cross-imported bindings are *called* at module-evaluation time — only
// inside functions that run later, after all modules have finished loading.
import { $langToggle } from "./dom.ts";
import { applyFilter } from "./list.ts";
import { reRenderSignal } from "./signal.ts";
import { reRenderMessage } from "./message.ts";
import { reRenderPaste } from "./paste.ts";

export type Lang = "en" | "zh";

type Dict = Record<string, string>;

const STORAGE_KEY = "can-viewer-lang";

const en: Dict = {
  "common.copy": "Copy",
  "common.copied": "Copied",
  "common.copyAll": "Copy all",
  "common.open": "Open",
  "common.back": "Back",
  "common.clear": "Clear",
  "common.decode": "Decode",
  "common.signed": "Signed",
  "common.identical": "identical",
  "common.added": "added",
  "common.removed": "removed",
  "common.bus": "bus",

  "header.noDatabase": "No database loaded",
  "header.load": "Load",
  "header.loadTitle": "Load another database",

  "tab.signals": "Signals",
  "tab.decoder": "Decoder",

  "lang.switchTitle": "Switch language",

  "drop.title": "Load a CAN signal database",
  "drop.descPre": "Drop a ",
  "drop.descPost": " file here, or tap to browse.",
  "drop.selectFile": "Select file",
  "drop.formatLabel": "Format",
  "drop.formatValue": "JSON (flat signal map)",
  "drop.idBasisLabel": "ID basis",
  "drop.idBasisPost": " field · 11-bit",
  "drop.privacyLabel": "Privacy",
  "drop.privacyValue": "Parsed locally, nothing uploaded",

  "list.searchPlaceholder": "Search signal, message, ID",
  "list.scrollForMore": "scroll for more",

  "filter.all": "All",

  "empty.title": "Pick a signal to inspect",
  "empty.sub": "Browse the list on the left or search by signal name, message, or hex ID.",

  "message.copyTableTitle": "Copy signal table",
  "message.canId": "CAN ID",
  "message.bus": "Bus",
  "message.signals": "Signals",
  "message.cycleTime": "Cycle Time",
  "message.frameLayout": "Frame Layout",
  "message.muxGroupWhen": "When {muxer} = {id}",

  "decoder.frameTrace": "Frame trace",
  "decoder.pasteInputPlaceholder": "7FFs:06A03400032010C0\n3FDs:0000003C20010280\n399s:000ADFE0B0C82704\n...",

  "signal.definition": "Signal Definition",
  "signal.startBit": "Start Bit",
  "signal.bitWidth": "Bit Width",
  "signal.byteOrder": "Byte Order",
  "signal.littleEndian": "Little-Endian",
  "signal.bigEndian": "Big-Endian",
  "signal.scale": "Scale",
  "signal.offset": "Offset",
  "signal.clearMask": "Clear Mask",
  "signal.units": "Units",
  "signal.multiplexor": "Multiplexor",
  "signal.role": "Role",
  "signal.muxedSignalRole": "Muxed signal",
  "signal.muxSelectorRole": "Mux selector",
  "signal.presentWhen": "Present When",
  "signal.selectorBits": "Selector Bits",
  "signal.gatesVariants": "Gates Variants",
  "signal.gatedSignals": "Gated Signals",
  "signal.physicalValue": "Physical Value",
  "signal.bitLayout": "Bit Layout",
  "signal.values": "Values",

  "decode.reasonUnrecognisedFormat": "unrecognised format",
  "decode.reasonOddHexLength": "data has odd hex length",

  "paste.hint": `Paste frames one per line in the form <code>ID:DATA</code> or <code>IDs:DATA</code>,
    then hit <strong>Decode</strong>.<br>Bit values are rendered against the loaded
    database and <strong>muxed signals are gated by the selector</strong> bits you
    can see painted in the grid.<br>Prefix a line with <code>*</code> (e.g.
    <code>*7FFs:…</code>) to mark it as a rewritten frame — it will be diffed
    against the previous same-ID frame.<br>Prefix with <code>></code> (e.g.
    <code>>*7FFs:…</code>) to mark it as a transmitted (tx) frame.`,
  "paste.copyAllTitle": "Copy all decoded blocks",
  "paste.frames": "frames",
  "paste.ids": "IDs",
  "paste.shown": "shown",
  "paste.rewrites": "rewrites",
  "paste.skipped": "skipped",
  "paste.unknownMessage": "Unknown message",
  "paste.notInDatabase": "not in loaded database",
  "paste.txTag": "TX",
  "paste.rwTag": "RW",
  "paste.txTitle": "Transmitted frame",
  "paste.rwTitle": "Rewritten frame",
  "paste.openMessageTitle": "Open message detail",
  "paste.onlyForSelectorTitle": "Only present for this selector value",
  "paste.muxBadge": "MUX",
  "paste.rewriteDiff": "Rewrite diff",
  "paste.prev": "prev",
  "paste.new": "new *",
  "paste.deltaBits": "Δ bits",
  "paste.muxChangedNotice": "Mux selector {name} changed {prev} {arrow} {next} — muxed signals belong to different variants and are not compared.",
  "paste.noSignalChanges": "No decoded signal values changed.",
  "paste.pasteFramesEmpty": "paste frames",
  "paste.signalsSuffix": "signals",
  "paste.cyclePrefix": "cycle",
  "paste.colSignal": "Signal",
  "paste.colRaw": "Raw",
  "paste.colValue": "Value",
  "paste.selectorFallback": "selector",
  "paste.changedBitsAria": "Changed bits (XOR)",
  "paste.colBefore": "Before",
  "paste.colAfter": "After",

  "error.jsonParsePrefix": "Failed to parse JSON: ",
};

const zh: Dict = {
  "common.copy": "复制",
  "common.copied": "已复制",
  "common.copyAll": "全部复制",
  "common.open": "打开",
  "common.back": "返回",
  "common.clear": "清除",
  "common.decode": "解码",
  "common.signed": "有符号",
  "common.identical": "完全相同",
  "common.added": "新增",
  "common.removed": "移除",
  "common.bus": "总线",

  "header.noDatabase": "未加载数据库",
  "header.load": "加载",
  "header.loadTitle": "加载另一个数据库",

  "tab.signals": "信号",
  "tab.decoder": "解码器",

  "lang.switchTitle": "切换语言",

  "drop.title": "加载 CAN 信号数据库",
  "drop.descPre": "将 ",
  "drop.descPost": " 文件拖到此处,或点击浏览。",
  "drop.selectFile": "选择文件",
  "drop.formatLabel": "格式",
  "drop.formatValue": "JSON(扁平信号映射)",
  "drop.idBasisLabel": "ID 来源",
  "drop.idBasisPost": " 字段 · 11 位",
  "drop.privacyLabel": "隐私",
  "drop.privacyValue": "本地解析,不上传任何内容",

  "list.searchPlaceholder": "搜索信号、报文、ID",
  "list.scrollForMore": "滚动加载更多",

  "filter.all": "全部",

  "empty.title": "选择一个信号查看详情",
  "empty.sub": "浏览左侧列表,或按信号名称、报文、十六进制 ID 搜索。",

  "message.copyTableTitle": "复制信号表格",
  "message.canId": "CAN ID",
  "message.bus": "总线",
  "message.signals": "信号",
  "message.cycleTime": "周期时间",
  "message.frameLayout": "帧布局",
  "message.muxGroupWhen": "当 {muxer} = {id} 时",

  "decoder.frameTrace": "帧轨迹",
  "decoder.pasteInputPlaceholder": "7FFs:06A03400032010C0\n3FDs:0000003C20010280\n399s:000ADFE0B0C82704\n...",

  "signal.definition": "信号定义",
  "signal.startBit": "起始位",
  "signal.bitWidth": "位宽",
  "signal.byteOrder": "字节序",
  "signal.littleEndian": "小端序",
  "signal.bigEndian": "大端序",
  "signal.scale": "比例系数",
  "signal.offset": "偏移量",
  "signal.clearMask": "清除掩码",
  "signal.units": "单位",
  "signal.multiplexor": "复用器",
  "signal.role": "角色",
  "signal.muxedSignalRole": "复用信号",
  "signal.muxSelectorRole": "复用选择器",
  "signal.presentWhen": "出现条件",
  "signal.selectorBits": "选择位",
  "signal.gatesVariants": "控制的变体",
  "signal.gatedSignals": "受控信号数",
  "signal.physicalValue": "物理值",
  "signal.bitLayout": "比特布局",
  "signal.values": "取值说明",

  "decode.reasonUnrecognisedFormat": "无法识别的格式",
  "decode.reasonOddHexLength": "数据的十六进制长度为奇数",

  "paste.hint": `每行粘贴一帧,格式为 <code>ID:DATA</code> 或 <code>IDs:DATA</code>,
    然后点击<strong>解码</strong>。<br>比特值会依据已加载的数据库渲染,且
    <strong>复用信号会按选择器位进行门控</strong>,你可以在网格里看到对应的着色。<br>
    在行首加 <code>*</code>(例如 <code>*7FFs:…</code>)可将该行标记为重写帧 ——
    它会与上一条相同 ID 的帧进行差异对比。<br>加 <code>></code>(例如
    <code>>*7FFs:…</code>)可将该行标记为已发送(tx)帧。`,
  "paste.copyAllTitle": "复制全部解码结果",
  "paste.frames": "帧",
  "paste.ids": "ID 数",
  "paste.shown": "已显示",
  "paste.rewrites": "重写",
  "paste.skipped": "已跳过",
  "paste.unknownMessage": "未知报文",
  "paste.notInDatabase": "不在已加载的数据库中",
  "paste.txTag": "TX",
  "paste.rwTag": "RW",
  "paste.txTitle": "已发送帧",
  "paste.rwTitle": "已重写帧",
  "paste.openMessageTitle": "打开报文详情",
  "paste.onlyForSelectorTitle": "仅在该选择值下存在",
  "paste.muxBadge": "复用",
  "paste.rewriteDiff": "重写差异",
  "paste.prev": "之前",
  "paste.new": "之后 *",
  "paste.deltaBits": "Δ 位",
  "paste.muxChangedNotice": "复用选择器 {name} 发生变化:{prev} {arrow} {next} —— 复用信号分属不同变体,不参与比较。",
  "paste.noSignalChanges": "没有解码信号的值发生变化。",
  "paste.pasteFramesEmpty": "粘贴帧数据",
  "paste.signalsSuffix": "个信号",
  "paste.cyclePrefix": "周期",
  "paste.colSignal": "信号",
  "paste.colRaw": "原始值",
  "paste.colValue": "物理值",
  "paste.selectorFallback": "选择器",
  "paste.changedBitsAria": "发生变化的比特(XOR)",
  "paste.colBefore": "之前",
  "paste.colAfter": "之后",

  "error.jsonParsePrefix": "JSON 解析失败:",
};

const dicts: Record<Lang, Dict> = { en, zh };

let currentLang: Lang = "en";

function detectInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch {
    /* localStorage unavailable (private mode, etc) — fall through */
  }
  if (typeof navigator !== "undefined" && navigator.language && navigator.language.toLowerCase().startsWith("zh")) {
    return "zh";
  }
  return "en";
}

export function getLang(): Lang {
  return currentLang;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = dicts[currentLang];
  let s = dict[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

/* ---------------- Compound / counted strings ----------------
 * Chinese doesn't do English-style singular/plural — these branch on the
 * active language directly rather than trying to force word-for-word
 * interpolation through the plain dictionary. */

export function fmtStats(sigCount: number, msgCount: number): string {
  const sig = sigCount.toLocaleString();
  const msg = msgCount.toLocaleString();
  return currentLang === "zh"
    ? `${sig} 个信号 · ${msg} 条报文`
    : `${sig} signal${sigCount === 1 ? "" : "s"} · ${msg} message${msgCount === 1 ? "" : "s"}`;
}

export function fmtLines(n: number): string {
  return currentLang === "zh" ? `${n} 行` : `${n} line${n === 1 ? "" : "s"}`;
}

export function fmtPasteMeta(lines: number): string {
  return lines ? fmtLines(lines) : t("paste.pasteFramesEmpty");
}

export function fmtSkipped(n: number): string {
  return currentLang === "zh" ? `跳过了 ${n} 行` : `Skipped ${n} line${n === 1 ? "" : "s"}`;
}

export function fmtAndMore(n: number): string {
  return currentLang === "zh" ? `……还有 ${n} 条` : `…and ${n} more`;
}

export function fmtBitsAcrossBytes(bits: number, bytes: number): string {
  return currentLang === "zh"
    ? `${bits} 位,跨 ${bytes} 字节`
    : `${bits} bit${bits === 1 ? "" : "s"} across ${bytes} byte${bytes === 1 ? "" : "s"}`;
}

export function fmtOtherSignals(n: number): string {
  return currentLang === "zh" ? `其他信号(${n} 个)` : `Other Signals (${n})`;
}

export function fmtMore(n: number): string {
  return currentLang === "zh" ? `还有 ${n} 个` : `+${n} more`;
}

export function fmtMuxIdBadge(n: number): string {
  return currentLang === "zh" ? `编号 ${n}` : `ID ${n}`;
}

export function fmtSelectorBits(start: number | undefined, width: number): string {
  const s = start ?? "?";
  return currentLang === "zh" ? `第 ${s} 位,宽度 ${width}` : `bit ${s}, width ${width}`;
}

/* ---------------- Static DOM scan ---------------- */

export function applyStaticI18n(): void {
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-ph]").forEach((el) => {
    const key = el.dataset.i18nPh;
    if (!key) return;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.placeholder = t(key);
    }
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    const key = el.dataset.i18nTitle;
    if (key) el.title = t(key);
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((el) => {
    const key = el.dataset.i18nAria;
    if (key) el.setAttribute("aria-label", t(key));
  });
}

function updateLangToggleUI(): void {
  const label = $langToggle.querySelector<HTMLElement>("span");
  if (label) label.textContent = currentLang === "en" ? "中文" : "EN";
  const title = t("lang.switchTitle");
  $langToggle.title = title;
  $langToggle.setAttribute("aria-label", title);
}

function bindLangToggle(): void {
  $langToggle.addEventListener("click", () => {
    setLang(currentLang === "en" ? "zh" : "en");
  });
}

export function setLang(lang: Lang): void {
  if (lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore — nothing we can do without storage */
  }
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  applyStaticI18n();
  updateLangToggleUI();
  // Refresh whatever is already rendered so the switch is immediate.
  applyFilter();
  reRenderSignal();
  reRenderMessage();
  reRenderPaste();
}

export function initI18n(): void {
  currentLang = detectInitialLang();
  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
  applyStaticI18n();
  bindLangToggle();
  updateLangToggleUI();
}
