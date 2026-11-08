// Web Worker running the MuPDF engine (module worker). Talks to local.js on the page.
// Load the engine dynamically so a failure (e.g. a WebView too old for MuPDF's WebAssembly) is reported, not silent.
let E, makeZip;
try {
  E = await import("./engine/index.js");
  ({ makeZip } = await import("./engine/zip.js"));
} catch (err) {
  postMessage({ type: "fatal", message: String(err?.message || err) });
  throw err;
}

const asks = new Map();
let seq = 0;
const ask = (op, payload, transfer = []) => new Promise((resolve, reject) => {
  const id = ++seq;
  asks.set(id, { resolve, reject });
  postMessage({ type: "ask", id, op, payload }, transfer);
});

// ---------------------------------------------------------------- image helpers (OffscreenCanvas)
async function decode(bytes, name) {
  try { return await createImageBitmap(new Blob([bytes])); }
  catch {
    const conv = await ask("convertImage", { bytes, name }); // HEIC etc. via the Android app
    return await createImageBitmap(new Blob([conv]));
  }
}
const blobBytes = async (b) => new Uint8Array(await b.arrayBuffer());
function hasAlpha(bmp) {
  const c = new OffscreenCanvas(64, 64), ctx = c.getContext("2d");
  ctx.drawImage(bmp, 0, 0, 64, 64);
  const d = ctx.getImageData(0, 0, 64, 64).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}
function draw(bmp, w, h, { bg = null, gray = false } = {}) {
  const c = new OffscreenCanvas(w, h), ctx = c.getContext("2d");
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  if (gray) ctx.filter = "grayscale(1)";
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  return c;
}

E.setHost({
  font: async (key) => { const b = await ask("font", key); return b && b.length ? b : null; },
  ocr: (bytes, w, h, name) => ask("ocr", { bytes, name: name || "page.png" }),
  async normalizeImage(bytes, name) { // -> JPEG/PNG bytes MuPDF can read, with EXIF rotation applied
    const bmp = await decode(bytes, name);
    const alpha = hasAlpha(bmp);
    const c = draw(bmp, bmp.width, bmp.height);
    return blobBytes(await c.convertToBlob(alpha ? { type: "image/png" } : { type: "image/jpeg", quality: 0.92 }));
  },
  async encodeImage({ w, h, rgb }, mime, quality) {
    const c = new OffscreenCanvas(w, h), ctx = c.getContext("2d");
    const img = ctx.createImageData(w, h);
    for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) { img.data[j] = rgb[i]; img.data[j + 1] = rgb[i + 1]; img.data[j + 2] = rgb[i + 2]; img.data[j + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return blobBytes(await c.convertToBlob({ type: mime, quality }));
  },
  async transcode(bytes, name, { format, quality, maxW, maxH, gray, targetKB }) {
    const bmp = await decode(bytes, name);
    let w = bmp.width, h = bmp.height;
    const s = Math.min(1, maxW ? maxW / w : 1, maxH ? maxH / h : 1);
    w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s));
    const mime = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }[format] || "image/jpeg";
    const bg = mime === "image/jpeg" ? "#ffffff" : null;
    const enc = async (cw, ch, q) => blobBytes(await draw(bmp, cw, ch, { bg, gray }).convertToBlob({ type: mime, quality: q }));
    let data = await enc(w, h, quality / 100);
    if (targetKB > 0 && mime !== "image/png") {
      let cw = w, ch = h;
      for (let round = 0; round < 12; round++) {
        let lo = 10, hi = 95, best = null;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const d = await enc(cw, ch, mid / 100);
          if (d.length <= targetKB * 1024) { best = d; lo = mid + 1; } else hi = mid - 1;
        }
        if (best) { data = best; break; }
        cw = Math.max(1, Math.round(cw * 0.8)); ch = Math.max(1, Math.round(ch * 0.8));
        data = await enc(cw, ch, 0.1);
      }
    }
    return data;
  },
});

// ---------------------------------------------------------------- calls from the page
const API = {
  async runTool(name, payload, progress) {
    const r = await E.runTool(name, payload, progress);
    if (r.files && r.files.length > 1) r.zip = { name: `${name}_results.zip`, data: await makeZip(r.files.map(f => ({ name: f.name, data: f.data, store: /\.(jpe?g|png|webp|zip|docx|xlsx|pptx|epub)$/i.test(f.name) })), { compress: true }) };
    return r;
  },
  openDocument: (a) => E.openDocument(a),
  pageImage: (id, p, w) => E.pageImage(id, p, w),
  pageLines: (id, p) => E.pageLinesFor(id, p),
  fields: (id) => E.fieldsFor(id),
  ocrImageText: (bytes, name) => E.ocrImageText(bytes, name),
  forget: (id) => E.forget(id),
  ping: () => "ok",
};

function transfers(v, out = []) {
  if (!v || typeof v !== "object") return out;
  if (v instanceof Uint8Array) { if (!out.includes(v.buffer)) out.push(v.buffer); return out; }
  if (Array.isArray(v)) { v.forEach(x => transfers(x, out)); return out; }
  for (const k of Object.keys(v)) transfers(v[k], out);
  return out;
}

onmessage = async (e) => {
  const m = e.data;
  if (m.type === "answer") {
    const a = asks.get(m.id);
    asks.delete(m.id);
    if (a) m.ok ? a.resolve(m.result) : a.reject(new Error(m.error || "failed"));
    return;
  }
  if (m.type !== "call") return;
  try {
    const progress = (text) => postMessage({ type: "progress", id: m.id, text });
    const result = await API[m.fn](...(m.args || []), progress);
    postMessage({ type: "result", id: m.id, result }, transfers(result));
  } catch (err) {
    postMessage({ type: "error", id: m.id, error: { message: err?.message || String(err), code: err?.code || "error", doc: err?.doc } });
  }
};
postMessage({ type: "ready" });
