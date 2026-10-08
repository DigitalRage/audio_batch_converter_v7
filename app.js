/* Audio Batch Converter - static GitHub Pages build */
(() => {
  "use strict";

  const CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
  const FFMPEG_UMD_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/umd";

  const $ = (id) => document.getElementById(id);
  const state = {
    files: [],
    ffmpeg: null,
    loaded: false,
    cancelled: false,
    busy: false
  };

  function log(message) {
    const el = $("log");
    el.textContent += (el.textContent ? "\n" : "") + message;
    el.scrollTop = el.scrollHeight;
  }

  function setStatus(message, kind = "") {
    const el = $("engineStatus");
    el.textContent = message;
    el.className = "status " + kind;
  }

  function formatBytes(bytes) {
    let value = Number(bytes) || 0;
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i++;
    }
    return value.toFixed(i ? 1 : 0) + " " + units[i];
  }

  function safeRelativePath(path) {
    return String(path || "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .split("/")
      .filter(part => part && part !== "." && part !== "..")
      .join("/");
  }

  function isAudio(file) {
    return /\.(mp3|wav|flac|m4a|mp4|aac|ogg|oga|opus|webm|wma|aiff|aif|alac|mka|caf|ac3|eac3|amr|ape|m4b)$/i.test(file.name || "");
  }

  function filePath(file) {
    return safeRelativePath(file.webkitRelativePath || file.name);
  }

  function getExtension() {
    const typed = $("extension").value.trim().replace(/^\./, "");
    if (typed && typed.toLowerCase() !== "auto") return typed;
    return ({
      ogg: "ogg", opus: "opus", mp3: "mp3", m4a: "m4a", aac: "aac",
      webm: "webm", flac: "flac", wav: "wav", "xhe-aac": "m4a"
    })[$("format").value] || "bin";
  }

  function updateStats() {
    $("fileCount").textContent = String(state.files.length);
    $("totalSize").textContent = formatBytes(state.files.reduce((sum, f) => sum + f.size, 0));
    $("outputBadge").textContent = getExtension();
    $("startBtn").disabled = state.files.length === 0 || state.busy;
    const list = $("fileList");
    if (!state.files.length) {
      list.textContent = "No files selected.";
      return;
    }
    list.textContent = state.files.map(filePath).join("\n");
  }

  function setFiles(files) {
    const audioFiles = Array.from(files || []).filter(isAudio);
    state.files = audioFiles;
    $("log").textContent = audioFiles.length
      ? `Loaded ${audioFiles.length} audio file(s).`
      : "No supported audio files found.";
    updateStats();
  }

  async function readDroppedItems(items) {
    const output = [];

    async function walk(entry, prefix) {
      if (entry.isFile) {
        await new Promise((resolve) => {
          entry.file((file) => {
            if (isAudio(file)) {
              try {
                Object.defineProperty(file, "webkitRelativePath", {
                  value: safeRelativePath(prefix + file.name),
                  configurable: true
                });
              } catch (_) {
                // Some browsers do not allow redefining the property.
              }
              output.push(file);
            }
            resolve();
          }, () => resolve());
        });
        return;
      }

      if (entry.isDirectory) {
        const reader = entry.createReader();
        const entries = [];
        while (true) {
          const batch = await new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));
          if (!batch.length) break;
          entries.push(...batch);
        }
        for (const child of entries) {
          await walk(child, prefix + entry.name + "/");
        }
      }
    }

    for (const item of Array.from(items || [])) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) await walk(entry, "");
    }
    return output;
  }

  function getBitrateK() {
    let value = Number($("bitrate").value);
    if (!Number.isFinite(value) || value <= 0) value = 128;
    const inMbps = $("bitrateUnit").value === "Mbps";
    return String(inMbps ? value * 1000 : value) + "k";
  }

  function buildCommonArgs(inputName, outputName) {
    const args = ["-i", inputName, "-map", "0:a:0"];
    const filters = [];
    const volume = Number($("volume").value);

    if (Number.isFinite(volume) && volume !== 0) {
      filters.push("volume=" + Math.pow(10, volume / 20).toFixed(7));
    }

    if ($("normalize").checked) {
      filters.push("loudnorm=I=-16:TP=-1.5:LRA=11");
    }

    if (filters.length) args.push("-af", filters.join(","));

    if ($("sampleMode").value === "fixed") {
      const rate = Math.max(1000, Math.min(384000, Math.round(Number($("sampleRate").value))));
      args.push("-ar", String(rate));
    }

    if ($("channels").value !== "keep") {
      args.push("-ac", $("channels").value);
    }

    if ($("metadata").value === "drop") {
      args.push("-map_metadata", "-1");
    }

    return args;
  }

  function codecArgs(inputName, outputName) {
    const format = $("format").value;
    const args = buildCommonArgs(inputName, outputName);
    const bitrate = getBitrateK();
    const mode = $("rateMode").value;
    const quality = Number($("quality").value);

    if (format === "ogg") {
      args.push("-c:a", "libvorbis");
      if (mode === "vbr") args.push("-q:a", String(Math.max(-1, Math.min(10, quality))));
      else args.push("-b:a", bitrate);
    } else if (format === "opus") {
      args.push("-c:a", "libopus", "-b:a", bitrate);
      if (mode === "vbr") args.push("-vbr", "on");
      else if (mode === "cvbr") args.push("-vbr", "constrained");
      else args.push("-vbr", "off");
      args.push("-compression_level", String(Math.max(0, Math.min(10, Number($("opusComplexity").value) || 10))));
      args.push("-application", $("opusApplication").value);
      const frame = $("opusFrame").value;
      if (frame) args.push("-frame_duration", frame);
    } else if (format === "mp3") {
      args.push("-c:a", "libmp3lame");
      if (mode === "vbr") args.push("-q:a", String(Math.max(0, Math.min(9, Math.round(quality)))));
      else args.push("-b:a", bitrate);
    } else if (format === "m4a") {
      args.push("-c:a", "aac", "-b:a", bitrate);
      if ($("faststart").checked) args.push("-movflags", "+faststart");
    } else if (format === "aac") {
      args.push("-c:a", "aac", "-b:a", bitrate, "-f", "adts");
    } else if (format === "webm") {
      args.push("-c:a", "libopus", "-b:a", bitrate);
    } else if (format === "flac") {
      args.push("-c:a", "flac", "-compression_level", String(Math.max(0, Math.min(12, Math.round(Number($("flacCompression").value) || 5)))));
    } else if (format === "wav") {
      args.push("-c:a", "pcm_s16le");
    } else {
      throw new Error("This format is not available in the standard browser FFmpeg build.");
    }

    args.push("-y", outputName);
    return args;
  }

  async function ensureFFmpeg() {
    if (state.loaded) return state.ffmpeg;

    if (!window.FFmpegWASM || !window.FFmpegUtil) {
      throw new Error("FFmpeg browser libraries did not load. Check your Internet connection and browser console.");
    }

    const { FFmpeg } = window.FFmpegWASM;
    const { toBlobURL } = window.FFmpegUtil;
    const ffmpeg = new FFmpeg();

    ffmpeg.on("log", ({ message }) => {
      if (message) log("[FFmpeg] " + message);
    });

    ffmpeg.on("progress", ({ progress }) => {
      if (!state.busy) return;
      const p = Math.max(0, Math.min(1, Number(progress) || 0));
      const currentIndex = Number(ffmpeg.__currentIndex || 0);
      const total = state.files.length || 1;
      $("bar").style.width = (((currentIndex + p) / total) * 100).toFixed(2) + "%";
    });

    setStatus("Loading FFmpeg…", "warn");
    log("Downloading browser FFmpeg core. First use can take a little while.");
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      classWorkerURL: await toBlobURL(`${FFMPEG_UMD_BASE}/814.ffmpeg.js`, "text/javascript")
    });

    state.ffmpeg = ffmpeg;
    state.loaded = true;
    setStatus("FFmpeg ready", "good");
    log("FFmpeg is ready.");
    return ffmpeg;
  }

  function makeOutputPath(sourcePath, root) {
    const pieces = safeRelativePath(sourcePath).split("/");
    pieces[pieces.length - 1] = pieces[pieces.length - 1].replace(/\.[^.]+$/i, "") + "." + getExtension();
    return safeRelativePath(root + "/" + pieces.join("/"));
  }

  async function convertOne(ffmpeg, file, index) {
    const inputName = `input_${index}_${Date.now()}`;
    const outputName = `output_${index}_${Date.now()}.${getExtension()}`;

    ffmpeg.__currentIndex = index;
    $("current").textContent = `${index + 1} / ${state.files.length}: ${filePath(file)}`;

    try {
      const { fetchFile } = window.FFmpegUtil;
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      await ffmpeg.exec(codecArgs(inputName, outputName));
      const data = await ffmpeg.readFile(outputName);
      const rel = makeOutputPath(filePath(file), $("prefix").value.trim() || "converted-audio");
      try { await ffmpeg.deleteFile(inputName); } catch (_) {}
      try { await ffmpeg.deleteFile(outputName); } catch (_) {}
      return { rel, data };
    } catch (error) {
      try { await ffmpeg.deleteFile(inputName); } catch (_) {}
      try { await ffmpeg.deleteFile(outputName); } catch (_) {}
      throw error;
    }
  }

  async function convertBatch() {
    if (!state.files.length || state.busy) return;

    state.busy = true;
    state.cancelled = false;
    $("startBtn").disabled = true;
    $("cancelBtn").disabled = false;
    $("bar").style.width = "0%";
    $("log").textContent = "";

    try {
      if ($("format").value === "xhe-aac") {
        throw new Error("xHE-AAC requires a separately compiled browser encoder such as exhale; it is not present in the standard FFmpeg WASM core.");
      }

      const ffmpeg = await ensureFFmpeg();
      const zip = new JSZip();
      const root = ($("prefix").value.trim() || "converted-audio").replace(/^\/+|\/+$/g, "");
      let successes = 0;
      let failures = 0;

      for (let i = 0; i < state.files.length; i++) {
        if (state.cancelled) break;

        try {
          const result = await convertOne(ffmpeg, state.files[i], i);
          zip.file(result.rel, result.data);
          successes++;
          log(`✓ ${filePath(state.files[i])} → ${result.rel}`);
        } catch (error) {
          failures++;
          const message = error?.message || String(error);
          log(`✗ ${filePath(state.files[i])} :: ${message}`);
        }
      }

      if (state.cancelled) {
        setStatus("Cancelled", "bad");
        $("current").textContent = "Batch cancelled.";
        return;
      }

      if (!successes) {
        throw new Error("No files converted successfully. See the conversion log for the actual FFmpeg error.");
      }

      setStatus(`Complete: ${successes} converted`, "good");
      $("current").textContent = `${successes} converted, ${failures} failed. Packaging ZIP…`;

      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = root + ".zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);

      $("bar").style.width = "100%";
      $("current").textContent = `Finished. Downloaded ${root}.zip`;
    } catch (error) {
      setStatus("Error", "bad");
      log("ERROR: " + (error?.message || String(error)));
      $("current").textContent = "Conversion stopped.";
    } finally {
      state.busy = false;
      $("startBtn").disabled = state.files.length === 0;
      $("cancelBtn").disabled = true;
    }
  }

  $("folderBtn").addEventListener("click", (event) => {
    event.stopPropagation();
    $("folderInput").click();
  });

  $("filesBtn").addEventListener("click", (event) => {
    event.stopPropagation();
    $("filesInput").click();
  });

  $("folderInput").addEventListener("change", (event) => setFiles(event.target.files));
  $("filesInput").addEventListener("change", (event) => setFiles(event.target.files));

  $("drop").addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    $("folderInput").click();
  });

  for (const eventName of ["dragenter", "dragover"]) {
    $("drop").addEventListener(eventName, (event) => {
      event.preventDefault();
      $("drop").classList.add("drag");
    });
  }

  for (const eventName of ["dragleave", "drop"]) {
    $("drop").addEventListener(eventName, (event) => {
      event.preventDefault();
      $("drop").classList.remove("drag");
    });
  }

  $("drop").addEventListener("drop", async (event) => {
    const items = event.dataTransfer?.items;
    if (items && Array.from(items).some(item => item.webkitGetAsEntry?.())) {
      const files = await readDroppedItems(items);
      setFiles(files);
    } else {
      setFiles(event.dataTransfer?.files || []);
    }
  });

  $("format").addEventListener("change", updateStats);
  $("extension").addEventListener("input", updateStats);

  $("cancelBtn").addEventListener("click", () => {
    state.cancelled = true;
    $("current").textContent = "Finishing the current FFmpeg operation before stopping…";
  });

  $("clearBtn").addEventListener("click", () => {
    state.files = [];
    $("folderInput").value = "";
    $("filesInput").value = "";
    $("bar").style.width = "0%";
    $("current").textContent = "Select audio files to begin.";
    $("log").textContent = "Ready.";
    updateStats();
  });

  $("startBtn").addEventListener("click", convertBatch);

  updateStats();
})();
