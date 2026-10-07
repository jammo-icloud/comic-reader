# Third-party notices

Bindery is licensed under the GNU AGPL-3.0-or-later (see `LICENSE`). It is built
with the open-source software below. Each package keeps its own licence; the
full texts are in the corresponding `node_modules/<package>` directory of a
built checkout, or at the project links.

## Server (shipped in the container image)

| Package | Licence | Role |
|---|---|---|
| [MuPDF](https://mupdf.com) (`mupdf`) | AGPL-3.0-or-later | PDF rendering and page extraction |
| [sharp](https://sharp.pixelplumbing.com) | Apache-2.0 | Image processing |
| [libvips](https://www.libvips.org) (bundled by sharp) | LGPL-3.0-or-later | Image processing library |
| [pdf-lib](https://pdf-lib.js.org) | MIT | PDF assembly |
| [Express](https://expressjs.com) | MIT | HTTP server |
| [multer](https://github.com/expressjs/multer) | MIT | Uploads |
| [cookie-parser](https://github.com/expressjs/cookie-parser) | MIT | Sessions |
| [archiver](https://www.archiverjs.com) | MIT | `.crz` export |
| [unzipper](https://github.com/ZJONSSON/node-unzipper) | MIT | CBZ import |
| [JSZip](https://stuk.github.io/jszip) | MIT (dual MIT / GPL-3.0-or-later) | Archive handling |
| [Node.js](https://nodejs.org) | MIT | Runtime |
| [libarchive](https://www.libarchive.org) (`bsdtar`, system package) | BSD-2-Clause | CBR extraction |

## Client (bundled into the web app)

| Package | Licence | Role |
|---|---|---|
| [React](https://react.dev), React DOM, React Router | MIT | UI |
| [PDF.js](https://mozilla.github.io/pdf.js) (`pdfjs-dist`) | Apache-2.0 | In-browser PDF rendering |
| [Lucide](https://lucide.dev) (`lucide-react`) | ISC | Icons |
| [Workbox](https://developer.chrome.com/docs/workbox) (`vite-plugin-pwa`, `workbox-window`) | MIT | Offline / service worker |
| [Tailwind CSS](https://tailwindcss.com) | MIT | Styling (build time) |
| [Vite](https://vite.dev) | MIT | Build tool (build time) |

## Assets

The login artwork and splash images were created by the Bindery contributors
and are not part of this repository.
