# Audio Batch Converter - GitHub Pages Edition

This version does **not** use Node.js or a local server.

`index.html` is the UI and `app.js` contains the browser-side conversion logic. FFmpeg.wasm runs inside the browser and the final output is assembled into a ZIP.

## Run it in VSCode

The easiest local test is:

1. Open the folder in VSCode.
2. Open `index.html` in the browser preview or Live Server.
3. Select a folder.
4. Click `Convert Batch → ZIP`.

The page also contains diagnostics in the conversion log. If FFmpeg cannot load, the page reports that directly.

## GitHub Pages

GitHub Pages is a static host, so this version is intended for it.

Put these files in the repository root:

- `index.html`
- `app.js`
- `.nojekyll`

Then enable GitHub Pages from the repository's Pages settings.

## Important limitations

The standard `@ffmpeg/core` browser build used here is the **single-thread** core. The multi-thread FFmpeg core relies on `SharedArrayBuffer` and cross-origin isolation requirements; using the single-thread core keeps this static GitHub Pages version much simpler.

The first FFmpeg load downloads the core files from jsDelivr. The FFmpeg wrapper and core are not compiled into this repository.

xHE-AAC is intentionally marked unavailable in this pure-browser build. FFmpeg.wasm's standard core does not contain a browser-ready exhale xHE-AAC encoder. Adding a real xHE-AAC mode would require shipping a compatible browser/WebAssembly build of that encoder and integrating its API.

## Output behavior

- Folder selection preserves `webkitRelativePath`.
- Dropped folders are recursively traversed in Chromium/Edge where `webkitGetAsEntry()` is available.
- Output paths preserve the original folder tree under the configured output root.
- The final ZIP is generated locally and downloaded.
- Audio is not uploaded to a server by this application.

## Formats included

- OGG Vorbis
- Opus
- MP3
- AAC / M4A
- AAC ADTS
- Opus / WebM
- FLAC
- WAV PCM

## Credits / external libraries

FFmpeg.wasm:
https://github.com/ffmpegwasm/ffmpeg.wasm

FFmpeg browser core:
https://www.jsdelivr.com/package/npm/@ffmpeg/core

JSZip:
https://stuk.github.io/jszip/
