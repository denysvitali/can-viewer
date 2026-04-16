import { $drop, $openPaste } from "./dom.ts";
import { initDropzone } from "./dropzone.ts";
import { initList } from "./list.ts";
import { initMessageView } from "./message.ts";
import { initSignalView } from "./signal.ts";
import { initPasteView, openPasteView } from "./paste.ts";
import { showView } from "./views.ts";

initDropzone();
initList();
initSignalView();
initMessageView();
initPasteView();

$openPaste.addEventListener("click", openPasteView);

showView($drop);
