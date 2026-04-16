import type { SignalDatabase, Signal, Message } from "./types.ts";
import { state } from "./state.ts";
import { $dropBox, $dropBtn, $fileInput, $fileLabel, $filters, $list } from "./dom.ts";
import { showView } from "./views.ts";
import { applyFilter } from "./list.ts";

export function initDropzone(): void {
  $dropBox.addEventListener("click", () => $fileInput.click());
  $dropBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    $fileInput.click();
  });
  $fileInput.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) loadFile(file);
    input.value = "";
  });

  $dropBox.addEventListener("dragover", (e) => {
    e.preventDefault();
    $dropBox.classList.add("dragover");
  });
  $dropBox.addEventListener("dragleave", () => {
    $dropBox.classList.remove("dragover");
  });
  $dropBox.addEventListener("drop", (e) => {
    e.preventDefault();
    $dropBox.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  });
}

function loadFile(file: File): void {
  state.fileName = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target!.result as string) as SignalDatabase;
      ingest(json);
    } catch (err) {
      alert("Failed to parse JSON: " + (err as Error).message);
    }
  };
  reader.readAsText(file);
}

function ingest(data: SignalDatabase): void {
  state.allSignals = [];
  state.messages = {};
  state.sigByKey = {};

  for (const [key, raw] of Object.entries(data)) {
    // The JSON generator OR's a bus-specific prefix into `ID` (e.g. 0x1000 for
    // CH bus). The true 11-bit CAN ID lives in `Message`; prefer it when present.
    const canonicalId = typeof raw.Message === "number" ? raw.Message : raw.ID;
    const sig: Signal = { key, ...raw, ID: canonicalId };
    state.allSignals.push(sig);
    state.sigByKey[key] = sig;

    const mid = canonicalId;
    let msg = state.messages[mid];
    if (!msg) {
      msg = {
        id: mid,
        name: raw.MessageName,
        bus: raw.BusName,
        busNum: raw.Bus,
        cycleTime: raw.CycleTime,
        signals: [],
      } satisfies Message;
      state.messages[mid] = msg;
    }
    msg.signals.push(key);
  }

  for (const msg of Object.values(state.messages)) {
    msg.signals.sort((a, b) => {
      const pa = state.sigByKey[a]?.Signal?.StartPosition ?? 0;
      const pb = state.sigByKey[b]?.Signal?.StartPosition ?? 0;
      return pa - pb;
    });
  }

  state.allSignals.sort((a, b) => a.ID - b.ID || a.key.localeCompare(b.key));

  rebuildBusFilters();
  applyFilter();
  $fileLabel.textContent = state.fileName;
  showView($list);
}

// Rebuild bus filter chips from the loaded data so the UI reflects whatever
// buses are actually present in the file.
function rebuildBusFilters(): void {
  const buses = new Set<string>();
  for (const s of state.allSignals) {
    if (s.BusName) buses.add(s.BusName);
  }

  let html = '<button class="fchip on" data-bus="all">All</button>';
  for (const bus of [...buses].sort()) {
    html += `<button class="fchip" data-bus="${bus}">${bus}</button>`;
  }
  $filters.innerHTML = html;
  state.currentBus = "all";
}
