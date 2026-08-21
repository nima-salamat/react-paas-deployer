/** Keep the pre-edit source so re-opening the editor never stacks crops. */
export function attachMessengerOriginal(file, source) {
  if (!file) return file;
  const orig = source?.__messengerOriginal || source || file;
  try {
    Object.defineProperty(file, "__messengerOriginal", {
      value: orig,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  } catch {
    file.__messengerOriginal = orig;
  }
  return file;
}

export function messengerOriginalOf(file) {
  return file?.__messengerOriginal || file;
}

/** Pending image-edit metadata (crop applied only on send). */
export function attachMessengerImageEdits(file, edits) {
  if (!file || !edits) return file;
  try {
    Object.defineProperty(file, "__messengerImageEdits", {
      value: edits,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  } catch {
    file.__messengerImageEdits = edits;
  }
  // Always also set plain property as fallback
  try { file.__messengerImageEdits = edits; } catch { /* */ }
  return file;
}

export function messengerImageEditsOf(file) {
  return file?.__messengerImageEdits || null;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

function rotateImageToCanvas(image, rotation = 0) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const r = ((rotation % 360) + 360) % 360;
  if (r === 90 || r === 270) {
    canvas.width = image.naturalHeight || image.height;
    canvas.height = image.naturalWidth || image.width;
  } else {
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
  }
  const nw = image.naturalWidth || image.width;
  const nh = image.naturalHeight || image.height;
  // Reset transform after drawing so subsequent stroke paints use pixel coords
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((r * Math.PI) / 180);
  ctx.drawImage(image, -nw / 2, -nh / 2);
  ctx.restore();
  return canvas;
}

function paintStrokes(ctx, strokes) {
  for (const s of strokes || []) {
    if (!s?.points?.length) continue;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(2, Number(s.width) || 6);
    ctx.globalAlpha = s.alpha != null ? s.alpha : 1;
    if (s.eraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = s.color || "#e53935";
    }
    const pts = s.points;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = s.eraser ? "rgba(0,0,0,1)" : (s.color || "#e53935");
      ctx.fill();
    } else {
      ctx.beginPath();
      pts.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }
    ctx.restore();
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("export failed"))), type, quality);
  });
}

/**
 * Bake deferred crop + drawings into a real File (called on send).
 */
export async function finalizeMessengerImageFile(file, { outputSize = 1600, quality = 0.92 } = {}) {
  const edits = messengerImageEditsOf(file);
  if (!edits || !edits.pending) return file;

  const srcFile = messengerOriginalOf(file) || file;
  const url = URL.createObjectURL(srcFile);
  try {
    const img = await loadImage(url);
    const rotation = Number(edits.rotation) || 0;
    const rotated = rotateImageToCanvas(img, rotation);

    if (Array.isArray(edits.strokes) && edits.strokes.length) {
      paintStrokes(rotated.getContext("2d"), edits.strokes);
    }

    const crop = edits.crop;
    if (!crop || crop.w < 1 || crop.h < 1) {
      // no crop — export full painted frame
      const mime = edits.circular ? "image/png" : "image/jpeg";
      let c = rotated;
      const maxEdge = Math.max(c.width, c.height);
      if (maxEdge > outputSize) {
        const r = outputSize / maxEdge;
        const out = document.createElement("canvas");
        out.width = Math.max(1, Math.round(c.width * r));
        out.height = Math.max(1, Math.round(c.height * r));
        out.getContext("2d").drawImage(c, 0, 0, out.width, out.height);
        c = out;
      }
      const blob = await canvasToBlob(c, mime, quality);
      const base = (file?.name || srcFile?.name || "image").replace(/\.[^.]+$/, "");
      const finalFile = new File([blob], `${base}_edit.${edits.circular ? "png" : "jpg"}`, { type: mime });
      attachMessengerOriginal(finalFile, srcFile);
      return finalFile;
    }

    let sx = Math.max(0, Math.round(crop.x));
    let sy = Math.max(0, Math.round(crop.y));
    let sw = Math.min(rotated.width - sx, Math.round(crop.w));
    let sh = Math.min(rotated.height - sy, Math.round(crop.h));
    if (sw < 1 || sh < 1) return file;

    let outW = sw;
    let outH = sh;
    const maxEdge = Math.max(outW, outH);
    if (maxEdge > outputSize) {
      const r = outputSize / maxEdge;
      outW = Math.max(1, Math.round(outW * r));
      outH = Math.max(1, Math.round(outH * r));
    }

    const out = document.createElement("canvas");
    out.width = outW;
    out.height = outH;
    const octx = out.getContext("2d");
    if (edits.circular) {
      octx.beginPath();
      octx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2);
      octx.closePath();
      octx.clip();
    }
    octx.drawImage(rotated, sx, sy, sw, sh, 0, 0, outW, outH);

    const mime = edits.circular ? "image/png" : "image/jpeg";
    const blob = await canvasToBlob(out, mime, quality);
    const base = (file?.name || srcFile?.name || "image").replace(/\.[^.]+$/, "");
    const finalFile = new File([blob], `${base}_edit.${edits.circular ? "png" : "jpg"}`, { type: mime });
    attachMessengerOriginal(finalFile, srcFile);
    return finalFile;
  } finally {
    URL.revokeObjectURL(url);
  }
}



/* ── Video edit metadata (trim / crop / quality / gif) ─────────────── */

export function attachMessengerVideoEdits(file, edits) {
  if (!file || !edits) return file;
  try {
    Object.defineProperty(file, "__messengerVideoEdits", {
      value: edits,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  } catch { /* */ }
  try { file.__messengerVideoEdits = edits; } catch { /* */ }
  return file;
}

export function messengerVideoEditsOf(file) {
  return file?.__messengerVideoEdits || null;
}

function loadVideo(url) {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error("Could not load video"));
    v.src = url;
  });
}

function seekVideo(v, t) {
  return new Promise((resolve) => {
    const onSeeked = () => {
      v.removeEventListener("seeked", onSeeked);
      resolve();
    };
    v.addEventListener("seeked", onSeeked);
    try {
      v.currentTime = Math.max(0, Math.min(t, (v.duration || t) - 0.001));
    } catch {
      resolve();
    }
    setTimeout(resolve, 500);
  });
}

/** Very small GIF89a encoder (palette + LZW) for short clips. */
function encodeGif(frames, width, height, delayCs) {
  // frames: array of Uint8ClampedArray RGBA length width*height*4
  // Build global palette from first frame via simple quantize (median-cut lite)
  const palette = quantizePalette(frames[0], width, height, 256);
  const bytes = [];
  const w = (n, v) => { for (let i = 0; i < n; i++) bytes.push((v >> (8 * i)) & 255); };

  // Header
  bytes.push(...[0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
  w(2, width); w(2, height);
  bytes.push(0xF7, 0x00, 0x00); // GCT 256 colors, bg 0, aspect 0

  // Global color table
  for (let i = 0; i < 256; i++) {
    const c = palette[i] || [0, 0, 0];
    bytes.push(c[0], c[1], c[2]);
  }

  // Netscape loop
  bytes.push(0x21, 0xFF, 0x0B);
  bytes.push(...[0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2E, 0x30]);
  bytes.push(0x03, 0x01, 0x00, 0x00, 0x00);

  for (const frame of frames) {
    // Graphic control
    bytes.push(0x21, 0xF9, 0x04, 0x00);
    w(2, delayCs);
    bytes.push(0x00, 0x00);
    // Image descriptor
    bytes.push(0x2C);
    w(2, 0); w(2, 0); w(2, width); w(2, height);
    bytes.push(0x00); // no local CT
    // Index stream
    const indices = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < indices.length; i++, p += 4) {
      indices[i] = nearestColor(palette, frame[p], frame[p + 1], frame[p + 2]);
    }
    const compressed = lzwEncode(indices, 8);
    bytes.push(8); // min code size
    for (let i = 0; i < compressed.length; i += 255) {
      const chunk = compressed.subarray(i, Math.min(i + 255, compressed.length));
      bytes.push(chunk.length);
      for (let j = 0; j < chunk.length; j++) bytes.push(chunk[j]);
    }
    bytes.push(0x00);
  }
  bytes.push(0x3B); // trailer
  return new Blob([new Uint8Array(bytes)], { type: "image/gif" });
}

function quantizePalette(rgba, width, height, maxColors) {
  // Sample pixels and build a simple palette
  const samples = [];
  const step = Math.max(1, Math.floor((width * height) / 4000));
  for (let i = 0; i < width * height; i += step) {
    const p = i * 4;
    samples.push([rgba[p], rgba[p + 1], rgba[p + 2]]);
  }
  // Bucket by 4-bit channels
  const map = new Map();
  for (const [r, g, b] of samples) {
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    if (!map.has(key)) map.set(key, [r, g, b]);
  }
  const palette = Array.from(map.values()).slice(0, maxColors);
  while (palette.length < maxColors) palette.push([0, 0, 0]);
  return palette;
}

function nearestColor(palette, r, g, b) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const c = palette[i];
    const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function lzwEncode(indexStream, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  const dict = new Map();
  for (let i = 0; i < clearCode; i++) dict.set(String(i), i);

  const out = [];
  let buffer = 0;
  let bits = 0;
  const write = (code) => {
    buffer |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      out.push(buffer & 255);
      buffer >>= 8;
      bits -= 8;
    }
  };

  write(clearCode);
  let w = String(indexStream[0]);
  for (let i = 1; i < indexStream.length; i++) {
    const k = String(indexStream[i]);
    const wk = w + "," + k;
    if (dict.has(wk)) {
      w = wk;
    } else {
      write(dict.get(w));
      if (nextCode < 4096) {
        dict.set(wk, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        write(clearCode);
        dict.clear();
        for (let c = 0; c < clearCode; c++) dict.set(String(c), c);
        codeSize = minCodeSize + 1;
        nextCode = endCode + 1;
      }
      w = k;
    }
  }
  write(dict.get(w));
  write(endCode);
  if (bits > 0) out.push(buffer & 255);
  return new Uint8Array(out);
}

const VIDEO_QUALITY = {
  p360: { label: "360p", maxHeight: 360, bitrate: 600_000 },
  p480: { label: "480p", maxHeight: 480, bitrate: 1_200_000 },
  p720: { label: "720p", maxHeight: 720, bitrate: 2_500_000 },
  p1080: { label: "1080p", maxHeight: 1080, bitrate: 4_500_000 },
  original: { label: "Original", maxHeight: null, bitrate: 8_000_000 },
};

/**
 * Process video with trim / crop / quality / optional GIF.
 * Called on send when edits.pending is set.
 */
export async function finalizeMessengerVideoFile(file, { onProgress } = {}) {
  const edits = messengerVideoEditsOf(file);
  if (!edits || !edits.pending) return file;

  const srcFile = messengerOriginalOf(file) || file;
  const url = URL.createObjectURL(srcFile);
  try {
    const video = await loadVideo(url);
    await new Promise((r) => {
      if (video.readyState >= 2) r();
      else video.onloadeddata = () => r();
      setTimeout(r, 800);
    });

    const duration = video.duration || 0;
    const trimStart = clampNum(edits.trimStart, 0, duration);
    const trimEnd = clampNum(edits.trimEnd || duration, trimStart + 0.05, duration);
    const clipLen = Math.max(0.05, trimEnd - trimStart);
    const quality = VIDEO_QUALITY[edits.quality] || VIDEO_QUALITY.p720;
    const asGif = Boolean(edits.asGif) && clipLen <= 60;

    // Crop in source pixels (centered aspect or explicit rect)
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 360;
    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (edits.crop && edits.crop.w > 0 && edits.crop.h > 0) {
      sx = clampNum(edits.crop.x, 0, vw - 1);
      sy = clampNum(edits.crop.y, 0, vh - 1);
      sw = clampNum(edits.crop.w, 1, vw - sx);
      sh = clampNum(edits.crop.h, 1, vh - sy);
    } else if (edits.aspect && edits.aspect > 0) {
      const srcA = vw / vh;
      if (srcA > edits.aspect) {
        sh = vh;
        sw = vh * edits.aspect;
      } else {
        sw = vw;
        sh = vw / edits.aspect;
      }
      sx = (vw - sw) / 2;
      sy = (vh - sh) / 2;
    }

    let outW = Math.round(sw);
    let outH = Math.round(sh);
    if (quality.maxHeight && outH > quality.maxHeight) {
      const r = quality.maxHeight / outH;
      outW = Math.max(2, Math.round(outW * r));
      outH = Math.max(2, Math.round(outH * r));
    }
    // GIF: cap width for size
    if (asGif && outW > 480) {
      const r = 480 / outW;
      outW = 480;
      outH = Math.max(2, Math.round(outH * r));
    }
    outW -= outW % 2;
    outH -= outH % 2;

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (asGif) {
      // Sample frames ~8 fps, max ~90 frames
      const fps = Math.min(8, Number(edits.gifFps) || 8);
      const maxFrames = 90;
      const step = Math.max(1 / fps, clipLen / maxFrames);
      const frames = [];
      for (let t = trimStart; t < trimEnd - 0.001 && frames.length < maxFrames; t += step) {
        await seekVideo(video, t);
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
        frames.push(ctx.getImageData(0, 0, outW, outH).data.slice(0));
        onProgress?.(Math.min(95, (frames.length / Math.ceil(clipLen / step)) * 100));
      }
      if (!frames.length) {
        await seekVideo(video, trimStart);
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
        frames.push(ctx.getImageData(0, 0, outW, outH).data.slice(0));
      }
      const delayCs = Math.max(2, Math.round(step * 100)); // centiseconds
      const blob = encodeGif(frames, outW, outH, delayCs);
      const base = (file?.name || srcFile?.name || "video").replace(/\.[^.]+$/, "");
      const out = new File([blob], `${base}.gif`, { type: "image/gif" });
      attachMessengerOriginal(out, srcFile);
      onProgress?.(100);
      return out;
    }

    // WebM via MediaRecorder
    await seekVideo(video, trimStart);
    const stream = canvas.captureStream(30);
    try {
      const aStream = video.captureStream?.() || video.mozCaptureStream?.();
      if (aStream) aStream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch { /* */ }

    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    let mimeType = "";
    for (const ct of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(ct)) {
        mimeType = ct;
        break;
      }
    }
    if (!mimeType) throw new Error("Browser cannot export video");

    const chunks = [];
    const mr = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: quality.bitrate,
    });
    mr.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };

    const done = new Promise((resolve, reject) => {
      mr.onstop = () => resolve();
      mr.onerror = (e) => reject(e.error || new Error("Recording failed"));
    });

    mr.start(100);
    video.currentTime = trimStart;
    await seekVideo(video, trimStart);

    let stopped = false;
    const stopAll = () => {
      if (stopped) return;
      stopped = true;
      try { video.pause(); } catch { /* */ }
      if (mr.state !== "inactive") mr.stop();
    };

    const tick = () => {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
      const elapsed = Math.max(0, video.currentTime - trimStart);
      onProgress?.(Math.min(99, (elapsed / clipLen) * 100));
      if (video.currentTime >= trimEnd - 0.03 || video.ended || video.paused) {
        stopAll();
        return;
      }
      requestAnimationFrame(tick);
    };

    await video.play();
    requestAnimationFrame(tick);
    const safety = setTimeout(stopAll, (clipLen + 3) * 1000);
    await done;
    clearTimeout(safety);

    const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
    if (!blob.size) throw new Error("Empty video output");
    const base = (file?.name || srcFile?.name || "video").replace(/\.[^.]+$/, "");
    const out = new File([blob], `${base}_edit.webm`, { type: blob.type || "video/webm" });
    attachMessengerOriginal(out, srcFile);
    onProgress?.(100);
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function clampNum(n, a, b) {
  return Math.max(a, Math.min(b, Number(n) || 0));
}

/** Finalize both deferred images and videos in a file list. */
export async function finalizeMessengerFiles(files, opts = {}) {
  const list = Array.isArray(files) ? files : [];
  const out = [];
  for (const f of list) {
    if (!f) { out.push(f); continue; }
    const t = String(f.type || "");
    if (t.startsWith("image/") && messengerImageEditsOf(f)?.pending) {
      out.push(await finalizeMessengerImageFile(f, opts));
    } else if ((t.startsWith("video/") || messengerVideoEditsOf(f)?.pending) && messengerVideoEditsOf(f)?.pending) {
      out.push(await finalizeMessengerVideoFile(f, opts));
    } else {
      out.push(f);
    }
  }
  return out;
}

export function guessLangFromName(name = "") {
  const n = String(name).toLowerCase();
  const map = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
    kt: "kotlin", cs: "csharp", cpp: "cpp", c: "c", php: "php",
    swift: "swift", sql: "sql", html: "html", css: "css", scss: "scss",
    json: "json", yaml: "yaml", yml: "yaml", xml: "xml",
    sh: "bash", bash: "bash", md: "markdown",
  };
  const ext = n.includes(".") ? n.split(".").pop() : "";
  return map[ext] || "";
}
