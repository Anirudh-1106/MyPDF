// Shared helpers for the on-device engine (port of mypdf/core.py + PDF drawing helpers on MuPDF.js).
import * as mupdf from "./mupdf.js";

export { mupdf };
export const MM = 72 / 25.4;
export const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tif", ".tiff", ".webp", ".heic", ".heif", ".jfif", ".avif"]);
export const OFFICE_EXT = new Set([".doc", ".docx", ".odt", ".rtf", ".xls", ".xlsx", ".ods", ".csv", ".ppt", ".pptx", ".odp"]);
export const TEXT_EXT = new Set([".txt", ".md", ".markdown", ".html", ".htm", ".log", ".json", ".xml", ".css", ".js", ".py"]);
export const PAPER = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008], a3: [841.89, 1190.55], a5: [419.53, 595.28] };

mupdf.setLog?.(null);

// ---------------------------------------------------------------- host (worker / test environment)
// font(key) -> Uint8Array|null, normalizeImage(bytes, name) -> {bytes, name}, ocr(png, w, h) -> [{text, box}],
// encodeImage(rgba, w, h, mime, quality) -> Uint8Array
export const host = {};
export function setHost(h) { Object.assign(host, h); }

// ---------------------------------------------------------------- tool registry & errors
export class ToolError extends Error {
  constructor(message, code = "error") { super(message); this.code = code; }
}
export const TOOLS = {};
export const tool = (name, fn) => { TOOLS[name] = fn; };

export const ext = (name) => { const m = /\.[^./\\]+$/.exec(name || ""); return m ? m[0].toLowerCase() : ""; };
export const stem = (name) => (name || "file").replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "");
export const toBool = (v) => v === true || v === 1 || v === "1" || v === "true" || v === "on" || v === "yes";
export const toFloat = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
export const toInt = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.trunc(n) : d; };
export function humanSize(n) {
  for (const u of ["B", "KB", "MB", "GB"]) {
    if (n < 1024 || u === "GB") return u === "B" ? `${n.toFixed(0)} B` : `${n.toFixed(1)} ${u}`;
    n /= 1024;
  }
}
export function hexColor(v, d = [0, 0, 0]) {
  if (!v) return d;
  let s = String(v).replace("#", "");
  if (s.length === 3) s = [...s].map(c => c + c).join("");
  const r = [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
  return r.some(Number.isNaN) ? d : r;
}
export const copyBytes = (u8) => new Uint8Array(u8); // detach from WASM memory
export const bufBytes = (buf) => { const b = copyBytes(buf.asUint8Array()); buf.destroy?.(); return b; };

// ---------------------------------------------------------------- page ranges
export function parsePages(spec, count, defaultAll = true) {
  spec = String(spec ?? "").trim().toLowerCase();
  if (!spec || spec === "all") {
    if (defaultAll) return [...Array(count).keys()];
    throw new ToolError("Please enter which pages to use (e.g. 1,3-5).");
  }
  const out = [];
  for (let part of spec.split(/[,\s;]+/)) {
    if (!part) continue;
    if (part === "odd") { for (let i = 0; i < count; i += 2) out.push(i); continue; }
    if (part === "even") { for (let i = 1; i < count; i += 2) out.push(i); continue; }
    part = part.replaceAll("last", String(count)).replaceAll("end", String(count));
    const m = /^(\d*)\s*-\s*(\d*)$/.exec(part);
    if (m) {
      const a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : count, step = b >= a ? 1 : -1;
      for (let i = a; step > 0 ? i <= b : i >= b; i += step) out.push(i - 1);
    } else if (/^\d+$/.test(part)) out.push(+part - 1);
    else throw new ToolError(`Invalid page range: '${part}'`);
  }
  const bad = out.find(i => i < 0 || i >= count);
  if (bad !== undefined) throw new ToolError(`Page ${bad + 1} does not exist (document has ${count} pages).`);
  if (!out.length) throw new ToolError("No pages selected.");
  return out;
}

// ---------------------------------------------------------------- job
export class Job {
  constructor({ files = [], opts = {}, assets = {}, store = null }) {
    this.files = files; this.opts = opts; this.assets = assets; this.store = store;
    this.outputs = []; this.message = ""; this._names = new Set();
  }
  get password() { return this.opts.password || null; }
  out(name, data, type) {
    name = String(name).replace(/[<>:"/\\|?*]/g, "").trim() || "output";
    let n = name, i = 2;
    while (this._names.has(n)) n = `${stem(name)} (${i++})${ext(name)}`;
    this._names.add(n);
    this.outputs.push({ name: n, data: typeof data === "string" ? new TextEncoder().encode(data) : data, type });
    return n;
  }
  require(n = 1, max = null) {
    if (this.files.length < n) throw new ToolError(`Please add ${max !== n ? "at least " : ""}${n} file${n > 1 ? "s" : ""}.`);
    if (max && this.files.length > max) throw new ToolError(`Please add at most ${max} file${max > 1 ? "s" : ""}.`);
    return this.files;
  }
  first() { return this.require(1)[0]; }
  docBytes(id) {
    const d = this.store?.get(id);
    if (!d) throw new ToolError("The opened document has expired. Please open it again.");
    return d;
  }
}

// ---------------------------------------------------------------- open / save
export function openAny(bytes, name) {
  try { return mupdf.Document.openDocument(bytes, name || "file.pdf"); }
  catch (e) { throw new ToolError(`Could not open '${name}': ${e.message || e}`); }
}

/** Convert any MuPDF document (XPS, EPUB, DOCX, HTML…) to a PDFDocument. */
export function convertToPdf(doc) {
  const buf = new mupdf.Buffer();
  const w = new mupdf.DocumentWriter(buf, "pdf", "");
  const n = doc.countPages();
  for (let i = 0; i < n; i++) {
    const page = doc.loadPage(i);
    const dev = w.beginPage(page.getBounds());
    page.run(dev, mupdf.Matrix.identity);
    w.endPage();
    page.destroy?.();
  }
  w.close();
  return new mupdf.PDFDocument(buf);
}

export function openPdf(file, password = null) {
  const doc = openAny(file.bytes, file.name);
  if (doc.needsPassword()) {
    if (!password || !doc.authenticatePassword(password)) {
      throw new ToolError(`'${stem(file.name)}' is password protected. Enter the password to continue.`, "needs_password");
    }
  }
  if (doc.isPDF()) return doc.asPDF();
  try { doc.layout?.(595, 842, 11); } catch { /* fixed-layout document */ }
  return convertToPdf(doc);
}

export function savePdf(doc, { subset = false, garbage = 3, extra = "" } = {}) {
  if (subset) { try { doc.subsetFonts(); } catch { /* keep full fonts */ } }
  const enc = /encrypt=/.test(extra) ? "" : "encrypt=none";
  const opts = [`garbage=${garbage}`, "compress", enc, extra].filter(Boolean).join(",");
  if (garbage >= 3) {
    // MuPDF's de-duplication (garbage>=3) breaks streams added in this session: write once, re-open, then optimise.
    const tmp = doc.saveToBuffer("compress,encrypt=none");
    const again = new mupdf.PDFDocument(tmp);
    const out = bufBytes(again.saveToBuffer(opts));
    again.destroy?.(); tmp.destroy?.();
    return out;
  }
  return bufBytes(doc.saveToBuffer(opts));
}

// ---------------------------------------------------------------- geometry
export const pageBox = (page) => { const b = page.getBounds(); return { x0: b[0], y0: b[1], W: b[2] - b[0], H: b[3] - b[1] }; };
export const invert = (m) => mupdf.Matrix.invert(m);
export const concat = (a, b) => mupdf.Matrix.concat(a, b);
export const applyM = ([a, b, c, d, e, f], [x, y]) => [x * a + y * c + e, x * b + y * d + f];
/** visual (as displayed) rect -> PDF user-space rect */
export function pdfRect(page, [x0, y0, x1, y1]) {
  const m = invert(page.getTransform());
  const pts = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(p => applyM(m, p));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
export function newBlankPage(doc, W, H, at = -1) {
  const obj = doc.addPage([0, 0, W, H], 0, {}, "");
  doc.insertPage(at, obj);
  return obj;
}

// ---------------------------------------------------------------- content streams
const wrapped = new WeakMap(); // doc -> Set(page object numbers already wrapped in q/Q)

function directDict(doc, parent, key) {
  let d = parent.get(key);
  if (d.isNull()) { d = doc.newDictionary(); parent.put(key, d); return parent.get(key); }
  // copy shared / indirect dictionaries so we only change this page
  const copy = doc.newDictionary();
  d.forEach((v, k) => copy.put(k, v));
  parent.put(key, copy);
  return parent.get(key);
}

function pageResources(doc, pageObj) {
  let r = pageObj.get("Resources");
  if (r.isNull()) {
    const inh = pageObj.getInheritable("Resources");
    const copy = doc.newDictionary();
    if (!inh.isNull()) inh.forEach((v, k) => copy.put(k, v));
    pageObj.put("Resources", copy);
    return pageObj.get("Resources");
  }
  if (r.isIndirect()) { // may be shared between pages
    const copy = doc.newDictionary();
    r.forEach((v, k) => copy.put(k, v));
    pageObj.put("Resources", copy);
    return pageObj.get("Resources");
  }
  return r;
}

export function addResource(doc, pageObj, kind, prefix, value) {
  const res = pageResources(doc, pageObj);
  const dict = directDict(doc, res, kind);
  let i = 0, name;
  do name = `${prefix}${i++}`; while (!dict.get(name).isNull());
  dict.put(name, value);
  return name;
}

export function addContent(doc, pageObj, bytes, under = false) {
  const stream = doc.addStream(bytes, {});
  const old = pageObj.get("Contents");
  const arr = doc.newArray();
  const items = [];
  if (old.isArray()) old.forEach(v => items.push(v));
  else if (!old.isNull()) items.push(old);
  let set = wrapped.get(doc);
  if (!set) wrapped.set(doc, set = new Set());
  const num = pageObj.isIndirect() ? pageObj.asIndirect() : -1;
  if (!under && items.length && !set.has(num)) {
    items.unshift(doc.addStream("q\n", {}));
    items.push(doc.addStream("\nQ\n", {}));
    set.add(num);
  }
  if (under) items.unshift(stream); else items.push(stream);
  for (const it of items) arr.push(it);
  pageObj.put("Contents", arr);
}

const fmt = (n) => (Math.abs(n) < 1e-6 ? 0 : +n.toFixed(4));
export const mstr = (m) => m.map(fmt).join(" ");

/** Read a page's (decoded) content streams as bytes. */
export function pageContentBytes(pageObj) {
  const c = pageObj.get("Contents");
  const chunks = [];
  const add = (s) => { if (s.isStream()) { chunks.push(bufBytes(s.readStream())); chunks.push(new Uint8Array([10])); } };
  if (c.isArray()) c.forEach(add); else if (!c.isNull()) add(c);
  const out = new Uint8Array(chunks.reduce((n, b) => n + b.length, 0));
  let o = 0;
  for (const b of chunks) { out.set(b, o); o += b.length; }
  return out;
}

/** Make a Form XObject in `dst` from page `pno` of `src` (like PyMuPDF show_pdf_page). Returns {ref, bbox, ctm}. */
export function pageXObject(dst, src, pno, graft) {
  const page = src.loadPage(pno);
  const pobj = page.getObject();
  const map = graft || dst.newGraftMap();
  const resIn = pobj.getInheritable("Resources");
  const res = resIn.isNull() ? dst.newDictionary() : map.graftObject(resIn);
  const box = pobj.getInheritable("CropBox").isNull() ? pobj.getInheritable("MediaBox") : pobj.getInheritable("CropBox");
  const bbox = box.isNull() ? [0, 0, 612, 792] : [0, 1, 2, 3].map(i => box.get(i).asNumber());
  const ref = dst.addStream(pageContentBytes(pobj), { Type: "XObject", Subtype: "Form", BBox: bbox, Resources: res });
  return { ref, ctm: page.getTransform(), bounds: page.getBounds() };
}

/** Draw a Form XObject (from pageXObject) onto a page so its visual bounds fill `rect` (visual coords of target). */
export function placeXObject(doc, page, xo, [x0, y0, x1, y1], { keep = true, under = false } = {}) {
  const [bx0, by0, bx1, by1] = xo.bounds;
  const bw = bx1 - bx0, bh = by1 - by0;
  let sx = (x1 - x0) / bw, sy = (y1 - y0) / bh, ox = x0, oy = y0;
  if (keep) { const s = Math.min(sx, sy); ox += ((x1 - x0) - bw * s) / 2; oy += ((y1 - y0) - bh * s) / 2; sx = sy = s; }
  const toVis = [sx, 0, 0, sy, ox - bx0 * sx, oy - by0 * sy];
  const m = concat(concat(xo.ctm, toVis), invert(page.getTransform()));
  const pobj = page.getObject();
  const name = addResource(doc, pobj, "XObject", "MyP", xo.ref);
  addContent(doc, pobj, `q ${mstr(m)} cm /${name} Do Q\n`, under);
}

/** Draw on top of (or under) a page with a MuPDF Device, using visual (displayed) coordinates, y down. */
export function overlay(doc, page, draw, { under = false } = {}) {
  const { x0, y0, W, H } = pageBox(page);
  const buf = new mupdf.Buffer();
  const w = new mupdf.DocumentWriter(buf, "pdf", "");
  const dev = w.beginPage([0, 0, W, H]);
  draw(dev, W, H);
  w.endPage(); w.close();
  const od = new mupdf.PDFDocument(buf);
  const op = od.loadPage(0);
  const xo = pageXObject(doc, od, 0);
  xo.bounds = [0, 0, W, H];
  placeXObject(doc, page, xo, [x0, y0, x0 + W, y0 + H], { keep: false, under });
  op.destroy?.(); od.destroy?.();
}

// ---------------------------------------------------------------- drawing primitives (visual coords)
export const RGB = () => mupdf.ColorSpace.DeviceRGB;
export function rectPath([x0, y0, x1, y1]) { const p = new mupdf.Path(); p.rect(x0, y0, x1, y1); return p; }
export function ellipsePath([x0, y0, x1, y1]) {
  const p = new mupdf.Path(), k = 0.5523;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
  p.moveTo(cx + rx, cy);
  p.curveTo(cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry);
  p.curveTo(cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy);
  p.curveTo(cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry);
  p.curveTo(cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy);
  p.closePath();
  return p;
}
export function polyPath(pts) { const p = new mupdf.Path(); pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); return p; }
export const stroke = (width, round = true) => new mupdf.StrokeState({ lineWidth: width, lineCap: round ? "Round" : "Butt", lineJoin: round ? "Round" : "Miter", miterLimit: 10 });

// ---------------------------------------------------------------- fonts
const BASE14 = { helv: ["Helvetica", "Helvetica-Bold"], tiro: ["Times-Roman", "Times-Bold"], cour: ["Courier", "Courier-Bold"] };
// host font keys; the Android app maps these to /system/fonts files
const FONT_HOST = { arial: "sans", verdana: "sans", georgia: "serif", script: "script", handwriting: "hand", indic: "devanagari", symbol: "symbols" };
const SCRIPTS = [[0x0900, 0x097f, "devanagari"], [0x0980, 0x09ff, "bengali"], [0x0a00, 0x0a7f, "gurmukhi"], [0x0a80, 0x0aff, "gujarati"],
  [0x0b00, 0x0b7f, "oriya"], [0x0b80, 0x0bff, "tamil"], [0x0c00, 0x0c7f, "telugu"], [0x0c80, 0x0cff, "kannada"], [0x0d00, 0x0d7f, "malayalam"],
  [0x0600, 0x06ff, "arabic"], [0x0590, 0x05ff, "hebrew"], [0x0e00, 0x0e7f, "thai"], [0x2190, 0x2bff, "symbols"], [0x1f300, 0x1faff, "emoji"],
  [0x3000, 0x9fff, "cjk"], [0xac00, 0xd7af, "cjk"], [0xff00, 0xffef, "cjk"]];
const fontCache = new Map();

async function hostFont(key, bold) {
  const k = key + (bold ? "-bold" : "");
  if (fontCache.has(k)) return fontCache.get(k);
  let f = null;
  try {
    const bytes = (await host.font?.(k)) || (bold ? await host.font?.(key) : null);
    if (bytes) f = new mupdf.Font(k, bytes);
  } catch { f = null; }
  fontCache.set(k, f);
  return f;
}
function base14(name) {
  if (!fontCache.has(name)) fontCache.set(name, new mupdf.Font(name));
  return fontCache.get(name);
}
const scriptOf = (cp) => { for (const [a, b, s] of SCRIPTS) if (cp >= a && cp <= b) return s; return "sans"; };

/** Resolve a font family + bold for a given text; returns a picker usable synchronously. */
export async function resolveFont(name, bold, text = "") {
  name = (name || "helv").toLowerCase();
  let primary;
  if (BASE14[name]) primary = base14(BASE14[name][bold ? 1 : 0]);
  else if (name === "zapf") primary = base14("ZapfDingbats");
  else primary = (await hostFont(FONT_HOST[name] || name, bold)) || base14(bold ? "Helvetica-Bold" : "Helvetica");
  const fallbacks = new Map();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp < 32 || primary.encodeCharacter(cp) > 0) continue;
    const s = scriptOf(cp);
    if (!fallbacks.has(s)) fallbacks.set(s, (await hostFont(s, bold)) || (s !== "sans" ? await hostFont("sans", bold) : null));
  }
  const pick = (cp) => {
    if (primary.encodeCharacter(cp) > 0) return primary;
    const f = fallbacks.get(scriptOf(cp));
    return f && f.encodeCharacter(cp) > 0 ? f : primary;
  };
  return { primary, pick };
}

function runs(rf, text) {
  const out = [];
  for (const ch of text) {
    const f = rf.pick(ch.codePointAt(0));
    if (out.length && out[out.length - 1].f === f) out[out.length - 1].s += ch; else out.push({ f, s: ch });
  }
  return out;
}
export function textWidth(rf, text, size) {
  let w = 0;
  for (const { f, s } of runs(rf, text)) for (const ch of s) w += f.advanceGlyph(f.encodeCharacter(ch.codePointAt(0))) * size;
  return w;
}
/** Build a Text object: baseline start (x, y) in visual coords; `m` = extra transform around the start point. */
export function makeText(rf, text, x, y, size, m = null) {
  const t = new mupdf.Text();
  let trm = [size, 0, 0, -size, 0, 0];
  if (m) trm = concat(trm, m);
  trm = concat(trm, [1, 0, 0, 1, x, y]);
  for (const { f, s } of runs(rf, text)) trm = t.showString(f, trm, s);
  return t;
}

// ---------------------------------------------------------------- images
export function exifOrientation(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return 1;
  let i = 2;
  while (i + 4 < b.length) {
    if (b[i] !== 0xff) return 1;
    const marker = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
    if (marker === 0xe1 && b[i + 4] === 0x45 && b[i + 5] === 0x78) { // "Exif"
      const t = i + 10, le = b[t] === 0x49;
      const u16 = (o) => le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1];
      const u32 = (o) => le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
      const ifd = t + u32(t + 4), n = u16(ifd);
      for (let k = 0; k < n; k++) { const e = ifd + 2 + k * 12; if (u16(e) === 0x0112) return u16(e + 8) || 1; }
      return 1;
    }
    if (marker === 0xda) return 1;
    i += 2 + len;
  }
  return 1;
}
const NATIVE_IMG = new Set([".jpg", ".jpeg", ".jfif", ".png", ".bmp", ".gif", ".tif", ".tiff"]);

/** Load image bytes as a MuPDF Image (EXIF rotation, WEBP/HEIC via the host's decoder). */
export async function loadImage(bytes, name) {
  const e = ext(name);
  let data = bytes;
  const needsHost = !NATIVE_IMG.has(e) || exifOrientation(bytes) > 1;
  if (needsHost && host.normalizeImage) data = await host.normalizeImage(bytes, name);
  try { return new mupdf.Image(data); }
  catch {
    if (!needsHost && host.normalizeImage) { try { return new mupdf.Image(await host.normalizeImage(bytes, name)); } catch { /* fall through */ } }
    throw new ToolError(`Could not read image '${name}'.`);
  }
}

/** Put an image on a page (visual rect), keeping proportions by default. */
export function drawImage(doc, page, image, [x0, y0, x1, y1], { keep = true, under = false, alpha = 1 } = {}) {
  const iw = image.getWidth(), ih = image.getHeight();
  let w = x1 - x0, h = y1 - y0, x = x0, y = y0;
  if (keep) { const s = Math.min(w / iw, h / ih); x += (w - iw * s) / 2; y += (h - ih * s) / 2; w = iw * s; h = ih * s; }
  if (alpha < 1) return overlay(doc, page, (dev) => dev.fillImage(image, [w, 0, 0, h, x, y], alpha), { under });
  const pobj = page.getObject();
  const ref = doc.addImage(image);
  const name = addResource(doc, pobj, "XObject", "MyI", ref);
  // image space -> visual: unit square, (0,0) at top-left
  const m = concat([w, 0, 0, -h, x, y + h], invert(page.getTransform()));
  addContent(doc, pobj, `q ${mstr(m)} cm /${name} Do Q\n`, under);
}

/** New page of size W x H with an image in rect (visual coords). */
export function imagePage(doc, image, W, H, rect, keep = true) {
  newBlankPage(doc, W, H);
  const page = doc.loadPage(doc.countPages() - 1);
  drawImage(doc, page, image, rect || [0, 0, W, H], { keep });
  return page;
}

// ---------------------------------------------------------------- rendering
export function renderPage(page, scale, { gray = false, alpha = false } = {}) {
  return page.toPixmap([scale, 0, 0, scale, 0, 0], gray ? mupdf.ColorSpace.DeviceGray : mupdf.ColorSpace.DeviceRGB, alpha, true);
}
export const jpeg = (pix, q = 85) => copyBytes(pix.asJPEG(q, false));
export const png = (pix) => copyBytes(pix.asPNG());
export function pixelsOf(pix) { return { w: pix.getWidth(), h: pix.getHeight(), n: pix.getNumberOfComponents() + (pix.getAlpha() ? 1 : 0), stride: pix.getStride(), data: new Uint8ClampedArray(pix.getPixels()) }; }

// ---------------------------------------------------------------- structured text
/** Lines with spans: [{bbox, dir, spans:[{text, size, font, bold, italic, color, bbox, chars}]}] in visual coords. */
export function pageLines(page) {
  const st = page.toStructuredText("preserve-whitespace");
  const lines = [];
  let line = null, span = null;
  st.walk({
    beginLine(bbox, wmode, dir) { line = { bbox, dir, spans: [] }; span = null; },
    onChar(c, origin, font, size, quad, color) {
      const name = font.getName();
      const key = name + "|" + size.toFixed(1) + "|" + (color || []).join(",");
      const x0 = Math.min(quad[0], quad[4]), y0 = Math.min(quad[1], quad[3]), x1 = Math.max(quad[2], quad[6]), y1 = Math.max(quad[5], quad[7]);
      if (!span || span.key !== key) {
        span = { key, text: "", size, font: name, bold: font.isBold() || /bold|black|heavy|semibold/i.test(name), italic: font.isItalic() || /italic|oblique/i.test(name),
          mono: font.isMono(), serif: font.isSerif(), color: color || [0], bbox: [x0, y0, x1, y1], origin, chars: [] };
        line.spans.push(span);
      }
      span.text += c;
      span.chars.push({ c, x0, y0, x1, y1 });
      span.bbox = [Math.min(span.bbox[0], x0), Math.min(span.bbox[1], y0), Math.max(span.bbox[2], x1), Math.max(span.bbox[3], y1)];
    },
    endLine() { if (line && line.spans.length) lines.push(line); line = null; },
  });
  st.destroy?.();
  return lines;
}
export const lineText = (l) => l.spans.map(s => s.text).join("");
export const colorHex = (c) => {
  const rgb = c.length === 1 ? [c[0], c[0], c[0]] : c.length === 4 ? [1 - Math.min(1, c[0] + c[3]), 1 - Math.min(1, c[1] + c[3]), 1 - Math.min(1, c[2] + c[3])] : c;
  return "#" + rgb.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");
};
export function pageText(page) {
  const st = page.toStructuredText("preserve-whitespace");
  const t = st.asText();
  st.destroy?.();
  return t;
}
export const escHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
