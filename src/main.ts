import { $fileInput, $loadFileBtn } from "./dom.ts";
import { initDropzone } from "./dropzone.ts";
import { initList } from "./list.ts";
import { initMessageView } from "./message.ts";
import { initSignalView } from "./signal.ts";
import { initPasteView } from "./paste.ts";
import { initViews } from "./views.ts";

initViews();
initDropzone();
initList();
initSignalView();
initMessageView();
initPasteView();

// Header "Load" button re-triggers the hidden file input.
$loadFileBtn.addEventListener("click", () => $fileInput.click());

// Keyboard: `/` focuses search, `Esc` from an input blurs.
window.addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement | null;
  const inInput = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
  if (e.key === "/" && !inInput) {
    const search = document.getElementById("search") as HTMLInputElement | null;
    if (search) {
      e.preventDefault();
      search.focus();
      search.select();
    }
  } else if (e.key === "Escape" && inInput) {
    (target as HTMLInputElement | HTMLTextAreaElement).blur();
  }
});
