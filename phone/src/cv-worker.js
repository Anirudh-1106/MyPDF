// Web Worker for the document scanner (OpenCV.js). Classic worker.
/* global cv, Scanner */
importScripts("opencv.js", "scanner-core.js");

let cvReady = null;
function getCv() {
  if (!cvReady) cvReady = (async () => {
    let c = self.cv;
    if (c instanceof Promise) c = await c;
    else if (!c.Mat) await new Promise(r => { c.onRuntimeInitialized = r; });
    self.cv = c;
    return c;
  })();
  return cvReady;
}

const asks = new Map();
let seq = 0;
const ask = (op, payload) => new Promise((resolve, reject) => { const id = ++seq; asks.set(id, { resolve, reject }); postMessage({ type: "ask", id, op, payload }); });

const photos = new Map(); // scan id -> normalized JPEG Blob (max 3000 px)
const MAX = 3000;

async function bitmap(blob, name) {
  try { return await createImageBitmap(blob); }
  catch { return await createImageBitmap(new Blob([await ask("convertImage", { bytes: new Uint8Array(await blob.arrayBuffer()), name })])); }
}
function canvasFor(bmp, max) {
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
  const c = new OffscreenCanvas(w, h), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  return c;
}
const matOf = (c) => cv.matFromImageData(c.getContext("2d").getImageData(0, 0, c.width, c.height));
async function encode(mat, type, quality) {
  const r = Scanner.toRGBA(mat);
  const c = new OffscreenCanvas(r.width, r.height);
  c.getContext("2d").putImageData(new ImageData(r.data, r.width, r.height), 0, 0);
  return c.convertToBlob({ type, quality });
}
const newId = () => Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-6);

const API = {
  async detect(bytes, name) {
    await getCv();
    const bmp = await bitmap(new Blob([bytes]), name);
    const big = canvasFor(bmp, MAX);
    const stored = await big.convertToBlob({ type: "image/jpeg", quality: 0.92 });
    const id = newId();
    photos.set(id, stored);
    const small = canvasFor(bmp, 900);
    const m = matOf(small);
    let det;
    try { det = Scanner.detectCorners(m); } finally { m.delete(); }
    const preview = await canvasFor(bmp, 1000).convertToBlob({ type: "image/jpeg", quality: 0.8 });
    bmp.close?.();
    return { id, corners: det.corners, found: det.found, w: big.width, h: big.height, preview };
  },
  async render(id, corners, filter, rotate, crop) {
    await getCv();
    const blob = photos.get(id);
    if (!blob) throw new Error("Scan expired, please add the photo again.");
    const bmp = await createImageBitmap(blob);
    const m = matOf(canvasFor(bmp, 1600));
    bmp.close?.();
    let out = Scanner.process(m, crop === false ? null : corners, filter || "magic", rotate || 0, crop !== false, 0);
    m.delete();
    out = Scanner.resizeMax(out, 900);
    const b = await encode(out, "image/jpeg", 0.8);
    out.delete();
    return b;
  },
  async final(id, corners, filter, rotate, crop, quality = 82) {
    await getCv();
    const blob = photos.get(id);
    if (!blob) throw new Error("Scan expired, please add the photo again.");
    const bmp = await createImageBitmap(blob);
    const m = matOf(canvasFor(bmp, MAX));
    bmp.close?.();
    const out = Scanner.process(m, crop === false ? null : corners, filter || "magic", rotate || 0, crop !== false, 0);
    m.delete();
    const bw = filter === "bw";
    const b = await encode(out, bw ? "image/png" : "image/jpeg", quality / 100);
    out.delete();
    return { bytes: new Uint8Array(await b.arrayBuffer()), ext: bw ? ".png" : ".jpg" };
  },
  drop(id) { photos.delete(id); },
};

onmessage = async (e) => {
  const m = e.data;
  if (m.type === "answer") { const a = asks.get(m.id); asks.delete(m.id); if (a) m.ok ? a.resolve(m.result) : a.reject(new Error(m.error || "failed")); return; }
  if (m.type !== "call") return;
  try {
    const result = await API[m.fn](...(m.args || []));
    postMessage({ type: "result", id: m.id, result }, result?.bytes instanceof Uint8Array ? [result.bytes.buffer] : []);
  } catch (err) {
    postMessage({ type: "error", id: m.id, error: { message: err?.message || String(err), code: "error" } });
  }
};
