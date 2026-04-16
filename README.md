# can-viewer

Browser-based viewer for CAN signal database JSON files.

Loads a `*_can_generated.json` file locally in the browser — no data ever leaves
your machine — and lets you search, filter by bus, and inspect every signal and
message it defines, including bit layout, scale/offset formulas, value
enumerations, and a color-coded frame overview.

## Using the live app

<https://denysvitali.github.io/can-viewer/>

Click **Select File** (or drag-and-drop) and point it at your own
`*_can_generated.json` file. You must provide the file yourself; none are
bundled with the app.

## Local development

Requires Node 20+ and [pnpm](https://pnpm.io/).

```sh
pnpm install
pnpm dev        # start Vite dev server
pnpm build      # typecheck + production build into dist/
pnpm preview    # serve the production build locally
```

## Project layout

```
index.html
styles/main.css
src/
  main.ts         # entry point, wires up views
  state.ts        # shared mutable app state
  dom.ts          # DOM element refs
  types.ts        # signal/message type definitions
  helpers.ts      # formatting + color helpers
  views.ts        # view transitions
  dropzone.ts     # file loading + JSON ingest
  list.ts         # signal list, search, infinite scroll
  signal.ts       # signal detail view
  message.ts      # message detail view + copy
  bits.ts         # bit diagrams and frame overview
.github/workflows/pages.yml   # deploys to GitHub Pages on push to main
```

## License

MIT — see [LICENSE](./LICENSE).
