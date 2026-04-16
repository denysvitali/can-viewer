import { $drop } from "./dom.ts";
import { initDropzone } from "./dropzone.ts";
import { initList } from "./list.ts";
import { initMessageView } from "./message.ts";
import { initSignalView } from "./signal.ts";
import { showView } from "./views.ts";

initDropzone();
initList();
initSignalView();
initMessageView();

showView($drop);
