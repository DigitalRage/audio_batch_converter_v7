# Audio Batch Converter with browser xHE-AAC

This project is designed for VSCode web preview / Live Server and GitHub Pages. There is no Node server. Audio conversion runs locally in the browser.

## xHE-AAC architecture

For xHE-AAC, FFmpeg.wasm converts the selected input to 16-bit PCM WAV at a valid 32-48 kHz rate. A separate Emscripten-built WebAssembly version of the open-source exhale encoder then receives that WAV and writes MPEG-4/USAC/xHE-AAC M4A. The encoder runs in a Web Worker so the UI remains responsive.

The included `.github/workflows/pages.yml` downloads exhale, compiles it with Emscripten, smoke-tests the resulting WebAssembly module, stages the static site, and deploys it to GitHub Pages. GitHub documents custom Pages workflows using `configure-pages`, `upload-pages-artifact`, and `deploy-pages`.

## Local browser use

Serve the folder over `http://`, not `file://`. VSCode Live Server or its web preview is appropriate. For local xHE-AAC development, run `scripts/build-exhale-wasm.ps1` from an Emscripten-enabled PowerShell terminal.

## GitHub Pages

Set the repository's Pages source to GitHub Actions, then push to `main`. The workflow builds the xHE-AAC WebAssembly encoder before publishing the site.

## xHE-AAC presets

exhale uses fixed presets rather than an arbitrary bitrate control. The UI therefore exposes the documented numeric modes 0-9 and SBR modes a-g, with Auto selecting the nearest approximate stereo target to the typed bitrate. exhale's own documentation warns that its lowest-rate modes do not contain every lower-rate USAC tool, so very low settings have different quality expectations.

## Sources

- exhale: https://github.com/dtseto/exhale
- FFmpeg.wasm: https://github.com/ffmpegwasm/ffmpeg.wasm
- Emscripten: https://emscripten.org/
- JSZip: https://stuk.github.io/jszip/

Preserve third-party license notices. exhale's project also notes that encoded MPEG streams can be subject to third-party patent rights; the software license does not grant patent rights.
