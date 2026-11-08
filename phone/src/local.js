/* MyPDF on-device backend: answers the app's /api/... requests inside the phone (no computer needed).
   Loaded before app.js in the Android app; exposes window.MyPDFLocal. */
(function () {
  "use strict";
  const BASE = new URL(".", document.currentScript.src).href;
  const ANDROID = window.MyPDFAndroid || null;
  const calls = new Map(), progress = new Map();
  let seq = 0, engine = null, scanner = null;

  // ---------------------------------------------------------------- workers
  function spawn(file, type) {
    const w = new Worker(BASE + file, type ? { type } : undefined);
    w.onmessage = (e) => onMessage(w, e.data);
    w.onerror = (e) => { console.error("worker error", e.message); for (const [id, c] of calls) if (c.w === w) { c.reject(new Error("The engine stopped unexpectedly: " + (e.message || "error"))); calls.delete(id); } };
    return w;
  }
  const eng = () => engine || (engine = spawn("engine-worker.js", "module"));
  const cvw = () => scanner || (scanner = spawn("cv-worker.js"));

  // MuPDF's WebAssembly needs exception-handling support (Chrome / Android System WebView 95+).
  const OLD_WEBVIEW = "This phone's Android System WebView is too old for MyPDF. Update \"Android System WebView\" and \"Chrome\" in the Play Store, then open MyPDF again.";
  let fatal = null;
  try {
    if (!WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 13, 3, 1, 0, 0]))) fatal = OLD_WEBVIEW;
  } catch { fatal = OLD_WEBVIEW; }
  if (fatal) document.addEventListener("DOMContentLoaded", () => {
    const b = document.createElement("div");
    b.style.cssText = "background:#b42318;color:#fff;padding:12px 16px;font:15px/1.4 system-ui,sans-serif";
    b.textContent = fatal;
    document.body.prepend(b);
  });

  function onMessage(w, m) {
    if (m.type === "fatal") {
      fatal = /WebAssembly|wasm|Tag|exception/i.test(m.message) ? OLD_WEBVIEW : "The PDF engine could not start: " + m.message;
      for (const [id, c] of calls) if (c.w === w) { c.reject(new Error(fatal)); calls.delete(id); }
      return;
    }
    if (m.type === "result" || m.type === "error") {
      const c = calls.get(m.id);
      calls.delete(m.id); progress.delete(m.id);
      if (!c) return;
      if (m.type === "result") c.resolve(m.result);
      else c.reject(Object.assign(new Error(m.error.message), m.error));
    } else if (m.type === "progress") progress.get(m.id)?.(m.text);
    else if (m.type === "ask") answer(w, m);
  }
  function call(w, fn, args = [], transfer = [], onProgress = null) {
    if (fatal && w === engine) return Promise.reject(new Error(fatal));
    const id = ++seq;
    if (onProgress) progress.set(id, onProgress);
    return new Promise((resolve, reject) => { calls.set(id, { resolve, reject, w }); w.postMessage({ type: "call", id, fn, args }, transfer); });
  }

  // ---------------------------------------------------------------- native (Android) helpers
  const natives = new Map();
  let nseq = 0;
  const b64ToBytes = (s) => { const bin = atob(s || ""); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; };
  const bytesToB64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  function native(method, ...args) {
    if (!ANDROID || !ANDROID[method]) return Promise.reject(new Error("This needs the MyPDF app."));
    const id = "n" + ++nseq;
    return new Promise((resolve, reject) => { natives.set(id, { resolve, reject }); ANDROID[method](id, ...args); });
  }
  function nativeAnswer(id, ok, payload) {
    const n = natives.get(id);
    natives.delete(id);
    if (n) ok ? n.resolve(payload) : n.reject(new Error(payload || "failed"));
  }
  const fontCache = new Map();
  async function answer(w, m) {
    try {
      let result = null;
      if (m.op === "font") {
        if (!fontCache.has(m.payload)) fontCache.set(m.payload, ANDROID?.font ? b64ToBytes(ANDROID.font(m.payload)) : new Uint8Array(0));
        result = fontCache.get(m.payload).slice();
      } else if (m.op === "ocr") {
        if (!ANDROID?.ocr) throw new Error("Text recognition needs the MyPDF app.");
        result = JSON.parse(await native("ocr", bytesToB64(m.payload.bytes)));
      } else if (m.op === "convertImage") {
        if (!ANDROID?.convertImage) throw new Error(`Can't read the image '${m.payload.name}'.`);
        result = b64ToBytes(await native("convertImage", bytesToB64(m.payload.bytes)));
      }
      w.postMessage({ type: "answer", id: m.id, ok: true, result }, result instanceof Uint8Array ? [result.buffer] : []);
    } catch (e) {
      w.postMessage({ type: "answer", id: m.id, ok: false, error: e.message });
    }
  }

  // ---------------------------------------------------------------- outputs
  const OUT = new Map(); // blob url -> {blob, name}
  const MIME = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", tiff: "image/tiff", tif: "image/tiff", txt: "text/plain", md: "text/markdown",
    html: "text/html", zip: "application/zip", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", epub: "application/epub+zip" };
  const mimeOf = (name) => MIME[(name.split(".").pop() || "").toLowerCase()] || "application/octet-stream";
  function entry(f) {
    const blob = new Blob([f.data], { type: mimeOf(f.name) });
    const url = URL.createObjectURL(blob);
    OUT.set(url, { blob, name: f.name });
    return { name: f.name, size: blob.size, url };
  }
  const blobOf = (url) => OUT.get(url)?.blob || null;

  // ---------------------------------------------------------------- request emulation
  const fileObj = async (f) => ({ name: f.name || "file", bytes: new Uint8Array(await f.arrayBuffer()) });
  const isFile = (v) => v && typeof v === "object" && typeof v.arrayBuffer === "function";

  async function runTool(name, fd, onProgress) {
    const opts = JSON.parse(fd.get("options") || "{}");
    const files = [], assets = {};
    for (const [k, v] of fd.entries()) {
      if (!isFile(v)) continue;
      if (k === "files") files.push(await fileObj(v)); else assets[k] = await fileObj(v);
    }
    if (name === "scan") { // run the photo pipeline first, then build the PDF
      for (const [k, p] of (opts.pages || []).entries()) {
        onProgress?.(`Processing page ${k + 1} of ${opts.pages.length}…`);
        const r = await call(cvw(), "final", [p.id, p.corners, p.filter || opts.filter || "magic", p.rotate || 0, p.crop !== false]);
        files.push({ name: `scan_${k + 1}${r.ext}`, bytes: r.bytes });
      }
      delete opts.pages;
    }
    const transfer = [...files, ...Object.values(assets)].map(f => f.bytes.buffer);
    const t0 = Date.now();
    const r = await call(eng(), "runTool", [name, { files, opts, assets }], transfer, onProgress);
    if (r.info) return { info: r.info };
    const res = { job: "local", files: r.files.map(entry), message: r.message, seconds: Math.round((Date.now() - t0) / 100) / 10 };
    if (r.zip) res.zip = entry(r.zip);
    return res;
  }

  async function post(url, fd, onProgress) {
    onProgress?.(1);
    let m;
    if ((m = /^\/api\/run\/(\w+)/.exec(url))) return runTool(m[1], fd, onProgress);
    if (url === "/api/open") {
      const f = fd.get("file");
      const args = isFile(f) ? { file: await fileObj(f) } : { doc: fd.get("doc"), password: fd.get("password") };
      return call(eng(), "openDocument", [args], args.file ? [args.file.bytes.buffer] : []);
    }
    if (url === "/api/scan/detect") {
      const f = await fileObj(fd.get("file"));
      const r = await call(cvw(), "detect", [f.bytes, f.name], [f.bytes.buffer]);
      r.preview = URL.createObjectURL(r.preview);
      return r;
    }
    if (url === "/api/ocr/image") {
      const f = await fileObj(fd.get("file"));
      return { text: await call(eng(), "ocrImageText", [f.bytes, f.name], [f.bytes.buffer]) };
    }
    throw new Error("Not available on the phone: " + url);
  }
  async function get(url) {
    let m;
    if ((m = /^\/api\/doc\/(\w+)\/lines\/(\d+)/.exec(url))) return { lines: await call(eng(), "pageLines", [m[1], +m[2]]) };
    if ((m = /^\/api\/doc\/(\w+)\/fields/.exec(url))) return { fields: await call(eng(), "fields", [m[1]]) };
    if (url.startsWith("/api/status")) return { version: "2.0.0", local: true, phone: true };
    throw new Error("Not available on the phone: " + url);
  }
  async function postBlob(url, obj) {
    if (url === "/api/scan/render") return call(cvw(), "render", [obj.id, obj.corners, obj.filter, obj.rotate, obj.crop]);
    throw new Error("Not available on the phone: " + url);
  }

  // ---------------------------------------------------------------- page images (lazy)
  const pageCache = new Map();
  function pageURL(doc, p, w) {
    const k = `${doc}/${p}/${w}`;
    if (!pageCache.has(k)) pageCache.set(k, call(eng(), "pageImage", [doc, +p, +w]).then(r => URL.createObjectURL(new Blob([r.data], { type: r.type }))));
    return pageCache.get(k);
  }
  const io = "IntersectionObserver" in window ? new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) { io.unobserve(e.target); load(e.target); }
  }, { rootMargin: "600px" }) : null;
  function load(img) {
    const [doc, p, w] = (img.dataset.pg || "").split("/");
    if (!doc) return;
    pageURL(doc, p, w).then(u => { if (img.dataset.pg === `${doc}/${p}/${w}`) img.src = u; }).catch(() => {});
  }
  function hydrate(root) {
    const imgs = root.matches?.("img[data-pg]") ? [root] : [...(root.querySelectorAll?.("img[data-pg]") || [])];
    for (const img of imgs) {
      if (img._pgDone === img.dataset.pg) continue;
      img._pgDone = img.dataset.pg;
      if (img.loading === "lazy" && io) io.observe(img); else load(img);
    }
  }
  new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) hydrate(n); })
    .observe(document.documentElement, { childList: true, subtree: true });

  // ---------------------------------------------------------------- saving / sharing
  async function deliver(f, action) { // action: download | share | open
    const blob = blobOf(f.url);
    if (!blob) throw new Error("This file is no longer available. Run the tool again.");
    if (!ANDROID?.saveBegin) {
      if (action === "open") { window.open(f.url, "_blank"); return; }
      const a = document.createElement("a"); a.href = f.url; a.download = f.name; document.body.append(a); a.click(); a.remove();
      return;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const token = ANDROID.saveBegin(f.name);
    const CH = 768 * 1024;
    for (let i = 0; i < bytes.length; i += CH) ANDROID.saveChunk(token, bytesToB64(bytes.subarray(i, i + CH)));
    ANDROID.saveEnd(token, action);
  }

  window.MyPDFLocal = { post, get, postBlob, pageURL, hydrate, blobOf, deliver, _answer: nativeAnswer, warm: () => { eng(); } };
  setTimeout(() => window.MyPDFLocal.warm(), 300); // start loading the engine early
})();
