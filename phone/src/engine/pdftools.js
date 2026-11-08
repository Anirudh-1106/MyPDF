// Edit / security / optimize / info / compare tools (port of mypdf/pdf_tools.py).
import {
  MM, ToolError, colorHex, concat, copyBytes, drawImage, ellipsePath, ext, hexColor, humanSize, imagePage, jpeg, lineText, loadImage, makeText,
  mupdf, openAny, openPdf, overlay, pageBox, pageLines, pageText, parsePages, png, polyPath, rectPath, renderPage, resolveFont, savePdf, stem,
  stroke, textWidth, toBool, toFloat, toInt, tool, RGB, bufBytes, escHtml,
} from "./core.js";
import { setToc } from "./organize.js";

const I = mupdf.Matrix.identity;

// ================================================================ redaction helper
function applyRedact(page, rects, { pixels = false } = {}) {
  if (!rects.length) return;
  for (const r of rects) {
    const a = page.createAnnotation("Redact");
    a.setRect(r);
    a.update?.();
  }
  page.applyRedactions(false, pixels ? 2 : 0, pixels ? 1 : 0, 0);
}
const quadRect = (q) => [Math.min(q[0], q[4]), Math.min(q[1], q[3]), Math.max(q[2], q[6]), Math.max(q[5], q[7])];

// ================================================================ text placement
async function textLines(font, bold, text) { return resolveFont(font, bold, text); }

function drawLines(dev, rf, text, x0, y, size, color, alpha, align = "left", width = 0, lineHeight = 1.2) {
  for (const line of String(text).split("\n")) {
    y += size;
    let x = x0;
    if (align !== "left" && width) { const lw = textWidth(rf, line, size); x = x0 + (width - lw) / (align === "center" ? 2 : 1); }
    if (line.trim()) dev.fillText(makeText(rf, line, x, y, size), I, RGB(), color, alpha);
    y += size * (lineHeight - 1);
  }
}

// ================================================================ edit (visual editor)
tool("edit", async (job) => {
  const doc = new mupdf.PDFDocument(job.docBytes(job.opts.doc));
  const ops = job.opts.ops || [];
  const byPage = new Map();
  for (const op of ops) { const p = toInt(op.page, 0); if (!byPage.has(p)) byPage.set(p, []); byPage.get(p).push(op); }
  for (const [pno, items] of byPage) {
    const page = doc.loadPage(pno);
    const { x0: bx, y0: by, W, H } = pageBox(page);
    const R = (o) => [bx + o.x * W, by + o.y * H, bx + (o.x + o.w) * W, by + (o.y + o.h) * H];
    // 1) remove replaced text; 2) real redactions (also wipe image pixels underneath)
    applyRedact(page, items.filter(o => o.replace).map(o => R(o.replace)));
    const red = items.filter(o => o.type === "redact").map(R);
    applyRedact(page, red, { pixels: true });
    // resolve fonts and images first (async), then draw everything in order
    const fonts = new Map(), images = new Map();
    for (const op of items) {
      if (op.type === "text" && String(op.text || "").trim()) fonts.set(op, await textLines(op.font || "helv", toBool(op.bold), op.text));
      if (op.type === "check") fonts.set(op, await resolveFont("zapf", false, "✔"));
      if (op.type === "image" && job.assets[op.asset]) images.set(op, await loadImage(job.assets[op.asset].bytes, job.assets[op.asset].name || "a.png"));
    }
    overlay(doc, page, (dev) => {
      const T = (r) => [r[0] - bx, r[1] - by, r[2] - bx, r[3] - by]; // overlay coords start at 0,0
      for (const op of items) {
        const r = T(R(op)), color = hexColor(op.color, [0, 0, 0]), alpha = toFloat(op.opacity, 1);
        const t = op.type;
        if (t === "text" && fonts.has(op)) drawLines(dev, fonts.get(op), op.text, r[0], r[1], toFloat(op.size, 14), color, alpha, op.align || "left", r[2] - r[0]);
        else if (t === "whiteout") dev.fillPath(rectPath(r), false, I, RGB(), hexColor(op.color, [1, 1, 1]), 1);
        else if (t === "highlight") dev.fillPath(rectPath(r), false, I, RGB(), hexColor(op.color, [1, 0.92, 0.2]), 0.4);
        else if (t === "redact") dev.fillPath(rectPath(r), false, I, RGB(), [0, 0, 0], 1);
        else if (t === "rect" || t === "ellipse") {
          const p = t === "ellipse" ? ellipsePath(r) : rectPath(r);
          if (op.fill) dev.fillPath(p, false, I, RGB(), hexColor(op.fill), alpha);
          dev.strokePath(p, stroke(toFloat(op.stroke, 2), false), I, RGB(), color, alpha);
        } else if (t === "line") {
          const p = polyPath([[op.x1 * W, op.y1 * H], [op.x2 * W, op.y2 * H]]);
          dev.strokePath(p, stroke(toFloat(op.stroke, 2)), I, RGB(), color, alpha);
        } else if (t === "ink") {
          for (const s of op.paths || []) if (s.length > 1) dev.strokePath(polyPath(s.map(([u, v]) => [u * W, v * H])), stroke(toFloat(op.stroke, 2)), I, RGB(), color, alpha);
        } else if (t === "image" && images.has(op)) {
          dev.fillImage(images.get(op), [r[2] - r[0], 0, 0, r[3] - r[1], r[0], r[1]], alpha);
        } else if (t === "check") {
          const hgt = r[3] - r[1];
          dev.fillText(makeText(fonts.get(op), op.mark === "x" ? "✘" : "✔", r[0], r[1] - hgt * 0.1 + hgt * 0.85, hgt), I, RGB(), color, 1);
        }
      }
    });
    for (const op of items) {
      if (op.type === "link" && op.url) page.createLink(R(op), op.url);
      if (op.type === "note") { const a = page.createAnnotation("Text"); const r = R(op); a.setRect([r[0], r[1], r[0] + 20, r[1] + 20]); a.setContents(op.text || ""); a.update?.(); }
    }
  }
  job.out(job.opts.filename || "edited.pdf", savePdf(doc, { subset: true }));
});

// ================================================================ watermark / numbers / header & footer
function anchor(pos, W, H, w, h, m = 36) {
  if (pos === "center" || pos === "tile") return [W / 2, H / 2];
  const [v, hz] = pos.split("-");
  const xs = { left: m + w / 2, center: W / 2, right: W - m - w / 2 }, ys = { top: m + h / 2, center: H / 2, bottom: H - m - h / 2 };
  return [xs[hz || "center"] ?? W / 2, ys[v] ?? H / 2];
}

tool("watermark", async (job) => {
  const o = job.opts;
  const text = o.text ?? "CONFIDENTIAL", size = toFloat(o.size, 60), opacity = toFloat(o.opacity, 0.25), angle = toFloat(o.angle, 45);
  const color = hexColor(o.color, [0.8, 0.1, 0.1]), pos = o.position || "center", scale = toFloat(o.scale, 40) / 100;
  const img = job.assets.image && o.kind === "image" ? await loadImage(job.assets.image.bytes, job.assets.image.name) : null;
  const rf = img ? null : await resolveFont(o.font || "helv", toBool(o.bold ?? true), text);
  const rad = angle * Math.PI / 180, R = [Math.cos(rad), -Math.sin(rad), Math.sin(rad), Math.cos(rad), 0, 0];
  for (const f of job.require(1)) {
    const doc = openPdf(f, job.password);
    for (const i of parsePages(o.pages, doc.countPages())) {
      const page = doc.loadPage(i);
      const { W, H } = pageBox(page);
      if (img) {
        const w = W * scale, h = w * img.getHeight() / img.getWidth();
        const [cx, cy] = anchor(pos, W, H, w, h);
        overlay(doc, page, (dev) => {
          const centers = pos === "tile" ? tile(W, H, w + 40, h + 60) : [[cx, cy]];
          for (const [x, y] of centers) dev.fillImage(img, [w, 0, 0, h, x - w / 2, y - h / 2], opacity);
        });
        continue;
      }
      const tl = textWidth(rf, text, size);
      const centers = pos === "tile" ? tile(W, H, tl * 0.9 + 80, size * 4) : [anchor(pos, W, H, tl, size)];
      overlay(doc, page, (dev) => {
        for (const [cx, cy] of centers) dev.fillText(makeText(rf, text, cx, cy, size, concat([1, 0, 0, 1, -tl / 2, 0.35 * size], R)), I, RGB(), color, opacity);
      }, { under: !toBool(o.on_top ?? true) });
    }
    job.out(`${stem(f.name)}_watermarked.pdf`, savePdf(doc, { subset: true }));
  }
});
function tile(W, H, sx, sy) {
  const out = [];
  for (let y = sy / 2, row = 0; y < H + sy; y += sy, row++) for (let x = row % 2 ? sx : sx / 2; x < W + sx; x += sx) out.push([x, y]);
  return out;
}

const roman = (n) => { let s = ""; for (const [v, r] of [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]]) while (n >= v) { s += r; n -= v; } return s; };
const today = () => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const fill = (t, n, total, name) => String(t).replaceAll("{n}", n).replaceAll("{total}", total).replaceAll("{date}", today()).replaceAll("{file}", name).replaceAll("{roman}", roman(n));

async function stampLine(doc, page, text, pos, size, color, font, margin) {
  const rf = await resolveFont(font, false, text);
  const { W, H } = pageBox(page);
  const tl = textWidth(rf, text, size);
  const [v, hz] = pos.split("-");
  const x = { left: margin, center: (W - tl) / 2, right: W - margin - tl }[hz || "center"];
  const y = v === "top" ? margin * 0.75 + size : H - margin * 0.75;
  overlay(doc, page, (dev) => dev.fillText(makeText(rf, text, x, y, size), I, RGB(), color, 1));
}

tool("page_numbers", async (job) => {
  const o = job.opts;
  for (const f of job.require(1)) {
    const doc = openPdf(f, job.password);
    const pages = parsePages(o.pages, doc.countPages());
    const start = toInt(o.start, 1), total = pages.length + start - 1;
    for (let k = 0; k < pages.length; k++) {
      const n = start + k;
      let pos = o.position || "bottom-center";
      if (toBool(o.mirror) && /left|right/.test(pos) && n % 2 === 0) pos = pos.replace("left", "@").replace("right", "left").replace("@", "right");
      await stampLine(doc, doc.loadPage(pages[k]), fill(o.format || "{n}", n, total, stem(f.name)), pos, toFloat(o.size, 11), hexColor(o.color), o.font || "helv", toFloat(o.margin, 10) * MM * 2);
    }
    job.out(`${stem(f.name)}_numbered.pdf`, savePdf(doc, { subset: true }));
  }
});

tool("header_footer", async (job) => {
  const o = job.opts;
  for (const f of job.require(1)) {
    const doc = openPdf(f, job.password);
    const total = doc.countPages();
    for (const i of parsePages(o.pages, total)) {
      for (const [key, v] of [["header", "top"], ["footer", "bottom"]]) {
        const t = String(o[key] || "");
        if (t.trim()) await stampLine(doc, doc.loadPage(i), fill(t, i + 1, total, stem(f.name)), `${v}-${o[key + "_align"] || "center"}`, toFloat(o.size, 10), hexColor(o.color, [0.3, 0.3, 0.3]), o.font || "helv", 36);
      }
    }
    job.out(`${stem(f.name)}_stamped.pdf`, savePdf(doc, { subset: true }));
  }
});

// ================================================================ redact / metadata / bookmarks / forms
const PRESETS = {
  email: /[\w.+-]+@[\w-]+\.[\w.-]+/g,
  phone: /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,5}/g,
  card: /\b(?:\d[ -]?){13,19}\b/g,
  aadhaar: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
  pan: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
  date: /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g,
  url: /https?:\/\/\S+|www\.\S+/g,
};
function stripMetadata(doc) {
  const tr = doc.getTrailer();
  tr.delete("Info");
  const root = tr.get("Root");
  if (!root.isNull()) root.delete("Metadata");
}

tool("redact", async (job) => {
  const o = job.opts;
  const terms = String(o.terms || "").split(/[\n,]/).map(t => t.trim()).filter(Boolean);
  const presets = Object.keys(PRESETS).filter(p => toBool(o["p_" + p]));
  if (!terms.length && !presets.length) throw new ToolError("Enter words to redact or tick at least one preset.");
  const color = hexColor(o.color, [0, 0, 0]);
  let total = 0;
  for (const f of job.require(1)) {
    const doc = openPdf(f, job.password);
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i);
      const needles = [...terms];
      if (presets.length) {
        const text = pageText(page);
        for (const p of presets) for (const m of text.matchAll(PRESETS[p])) { const s = m[0].trim(); if (s.length >= 4) needles.push(s); }
      }
      const rects = [];
      for (const n of new Set(needles)) for (const hit of page.search(n)) for (const q of hit) rects.push(quadRect(q));
      if (!rects.length) continue;
      total += rects.length;
      applyRedact(page, rects, { pixels: true });
      const { x0, y0 } = pageBox(page);
      overlay(doc, page, (dev) => { for (const r of rects) dev.fillPath(rectPath([r[0] - x0, r[1] - y0, r[2] - x0, r[3] - y0]), false, I, RGB(), color, 1); });
    }
    if (toBool(o.metadata ?? true)) stripMetadata(doc);
    job.out(`${stem(f.name)}_redacted.pdf`, savePdf(doc, { garbage: 4 }));
  }
  job.message = `Permanently removed ${total} match(es).`;
});

const META = { title: "info:Title", author: "info:Author", subject: "info:Subject", keywords: "info:Keywords", creator: "info:Creator", producer: "info:Producer" };
tool("metadata", async (job) => {
  const f = job.first();
  const doc = openPdf(f, job.password);
  if (toBool(job.opts.strip)) stripMetadata(doc);
  else for (const [k, key] of Object.entries(META)) if (job.opts[k] !== undefined && job.opts[k] !== "") doc.setMetaData(key, String(job.opts[k]));
  job.out(`${stem(f.name)}.pdf`, savePdf(doc));
});

tool("bookmarks", async (job) => {
  const f = job.first();
  const doc = openPdf(f, job.password);
  const n = doc.countPages();
  const toc = [];
  for (const line of String(job.opts.toc || "").split("\n")) {
    const k = line.lastIndexOf("|");
    if (k < 0) continue;
    const title = line.slice(0, k), pg = parseInt(line.slice(k + 1));
    if (!Number.isFinite(pg)) continue;
    const lvl = 1 + (title.length - title.replace(/^-+/, "").length);
    toc.push([Math.min(lvl, toc.length ? toc[toc.length - 1][0] + 1 : 1), title.replace(/^[-\s]+|\s+$/g, ""), Math.max(1, Math.min(pg, n))]);
  }
  if (toBool(job.opts.auto) && !toc.length) {
    for (let i = 0; i < n; i++) {
      let big = null;
      for (const l of pageLines(doc.loadPage(i))) for (const s of l.spans) if (s.text.trim() && (!big || s.size > big.size)) big = s;
      if (big) toc.push([1, big.text.trim().slice(0, 80), i + 1]);
    }
  }
  if (!toc.length) throw new ToolError("Add lines like:  Introduction | 1");
  setToc(doc, toc);
  job.out(`${stem(f.name)}_bookmarked.pdf`, savePdf(doc));
});

const widgetKey = (w) => `${w.getName()}#${w.getObject().isIndirect() ? w.getObject().asIndirect() : 0}`;
export function formFields(bytes) {
  const doc = new mupdf.PDFDocument(bytes);
  const out = [];
  for (let i = 0; i < doc.countPages(); i++) {
    for (const w of doc.loadPage(i).getWidgets()) {
      const type = w.getFieldType();
      if (type === "button" || type === "signature") continue;
      out.push({ key: widgetKey(w), name: w.getLabel() || w.getName(), type, value: w.getValue(), options: w.isChoice() ? w.getOptions() : [], page: i + 1 });
    }
  }
  return out;
}

tool("form_fill", async (job) => {
  const doc = new mupdf.PDFDocument(job.docBytes(job.opts.doc));
  const values = job.opts.values || {};
  for (let i = 0; i < doc.countPages(); i++) {
    for (const w of doc.loadPage(i).getWidgets()) {
      const key = widgetKey(w);
      if (!(key in values)) continue;
      const v = values[key];
      if (w.isCheckbox() || w.isRadioButton()) { const on = w.getValue() !== "Off" && w.getValue() !== ""; if (on !== toBool(v)) w.toggle(); }
      else if (w.isChoice()) w.setChoiceValue(String(v ?? ""));
      else if (w.isText()) w.setTextValue(String(v ?? ""));
      w.update();
    }
  }
  if (toBool(job.opts.flatten)) doc.bake(true, true);
  job.out(job.opts.filename || "filled.pdf", savePdf(doc));
});

// ================================================================ security
tool("protect", async (job) => {
  const o = job.opts, user = o.user_password || "";
  if (!user) throw new ToolError("Enter a password.");
  if (o.confirm !== undefined && o.confirm !== user) throw new ToolError("Passwords do not match.");
  const owner = o.owner_password || user + "#owner";
  if (/,/.test(user + owner)) throw new ToolError("Passwords can't contain a comma (,) here.");
  let perm = 0xFFFFF0C0 | 512; // required bits + accessibility
  if (toBool(o.allow_print ?? true)) perm |= 4 | 2048;
  if (toBool(o.allow_copy ?? true)) perm |= 16;
  if (toBool(o.allow_modify)) perm |= 8 | 32 | 256 | 1024;
  perm = perm | 0; // signed 32-bit
  for (const f of job.require(1)) {
    const doc = openPdf(f, o.password);
    job.out(`${stem(f.name)}_protected.pdf`, savePdf(doc, { extra: `encrypt=aes-256,user-password=${user},owner-password=${owner},permissions=${perm}` }));
  }
});

tool("unlock", async (job) => {
  for (const f of job.require(1)) {
    const doc = openAny(f.bytes, f.name);
    if (doc.needsPassword()) {
      const pw = job.opts.password || "";
      if (!pw || !doc.authenticatePassword(pw)) throw new ToolError(`Wrong password for '${stem(f.name)}'.`, "needs_password");
    }
    job.out(`${stem(f.name)}_unlocked.pdf`, savePdf(doc.asPDF()));
  }
});

tool("sanitize", async (job) => {
  for (const f of job.require(1)) {
    const doc = openPdf(f, job.password);
    stripMetadata(doc);
    const root = doc.getTrailer().get("Root");
    root.delete("OpenAction"); root.delete("AA");
    const names = root.get("Names");
    if (!names.isNull()) { names.delete("JavaScript"); names.delete("EmbeddedFiles"); }
    const af = root.get("AcroForm");
    if (!af.isNull()) af.delete("XFA");
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i), pobj = page.getObject();
      pobj.delete("AA"); pobj.delete("Thumb"); pobj.delete("PieceInfo");
      for (const a of page.getAnnotations()) {
        const t = a.getType();
        if (["FileAttachment", "Sound", "Movie", "Screen", "RichMedia", "3D"].includes(t)) page.deleteAnnotation(a);
        else { const ao = a.getObject(); ao.delete("AA"); const act = ao.get("A"); if (!act.isNull() && act.get("S").isName() && /JavaScript|Launch/.test(act.get("S").asName())) ao.delete("A"); }
      }
      if (toBool(job.opts.links)) for (const l of page.getLinks()) page.deleteLink(l);
    }
    job.out(`${stem(f.name)}_clean.pdf`, savePdf(doc, { garbage: 4, extra: "sanitize" }));
  }
});

// ================================================================ optimize
const LEVELS = { low: [150, 85], medium: [110, 70], high: [80, 55], extreme: [60, 40] };

function rewriteImages(doc, dpi, quality, gray) {
  const done = new Set();
  for (let i = 0; i < doc.countPages(); i++) {
    const page = doc.loadPage(i);
    const { W, H } = pageBox(page);
    const maxW = W / 72 * dpi, maxH = H / 72 * dpi;
    const res = page.getObject().getInheritable("Resources");
    const stack = [res];
    while (stack.length) {
      const r = stack.pop();
      if (!r || r.isNull()) continue;
      const xo = r.get("XObject");
      if (xo.isNull()) continue;
      const list = [];
      xo.forEach(v => list.push(v));
      for (const ref of list) {
        const st = ref.get("Subtype");
        if (!st.isName()) continue;
        if (st.asName() === "Form") { stack.push(ref.get("Resources")); continue; }
        if (st.asName() !== "Image" || !ref.isIndirect()) continue;
        const num = ref.asIndirect();
        if (done.has(num)) continue;
        done.add(num);
        try { shrinkImage(doc, ref, maxW, maxH, quality, gray); } catch { /* leave odd images alone */ }
      }
    }
  }
}

function shrinkImage(doc, ref, maxW, maxH, quality, gray) {
  if (ref.get("ImageMask").isBoolean() && ref.get("ImageMask").asBoolean()) return;
  const w = ref.get("Width").asNumber(), h = ref.get("Height").asNumber();
  if (w * h < 64 * 64) return;
  const filter = ref.get("Filter");
  const fname = filter.isName() ? filter.asName() : filter.isArray() ? "multi" : "";
  if (["JBIG2Decode", "CCITTFaxDecode"].includes(fname)) return;
  if (ref.get("BitsPerComponent").isNumber() && ref.get("BitsPerComponent").asNumber() === 1) return;
  const s = Math.min(1, maxW / w, maxH / h);
  const rawLen = ref.readRawStream().getLength();
  if (s > 0.87 && fname === "DCTDecode" && !gray) return; // already a JPEG at a sensible resolution
  const tw = Math.max(1, Math.round(w * Math.min(1, s))), th = Math.max(1, Math.round(h * Math.min(1, s)));
  const img = doc.loadImage(ref);
  let base = img.toPixmap();
  const cs = base.getColorSpace();
  const toGray = gray || (cs && cs.isGray());
  const target = toGray ? mupdf.ColorSpace.DeviceGray : RGB();
  const plain = new mupdf.Image(base.getAlpha() ? base.convertToColorSpace(target, false) : base);
  const pix = new mupdf.Pixmap(target, [0, 0, tw, th], false);
  pix.clear(255);
  const dev = new mupdf.DrawDevice(I, pix);
  dev.fillImage(plain, [tw, 0, 0, th, 0, 0], 1);
  dev.close();
  const data = jpeg(pix, quality);
  if (data.length >= rawLen * 0.95 && !gray) return;
  ref.writeRawStream(data);
  ref.put("Filter", "DCTDecode");
  ref.put("Width", tw); ref.put("Height", th);
  ref.put("BitsPerComponent", 8);
  ref.put("ColorSpace", toGray ? "DeviceGray" : "DeviceRGB");
  ref.delete("DecodeParms"); ref.delete("Decode");
  if (ref.get("Mask").isArray()) ref.delete("Mask");
}

function compressBytes(file, level, password, gray) {
  const doc = openPdf(file, password);
  const [dpi, q] = LEVELS[level] || LEVELS.medium;
  rewriteImages(doc, dpi, q, gray);
  try { doc.subsetFonts(); } catch { /* ignore */ }
  const root = doc.getTrailer().get("Root");
  if (!root.isNull()) root.delete("Metadata");
  for (let i = 0; i < doc.countPages(); i++) doc.loadPage(i).getObject().delete("Thumb");
  return savePdf(doc, { garbage: 4, extra: "compress-fonts,compress-images,clean,objstms" });
}

function rasterCompress(file, targetKB, password, gray) {
  const src = openPdf(file, password);
  let data = null;
  for (const [dpi, q] of [[120, 60], [100, 50], [85, 40], [72, 30], [60, 25]]) {
    const out = new mupdf.PDFDocument();
    for (let i = 0; i < src.countPages(); i++) {
      const page = src.loadPage(i), { W, H } = pageBox(page);
      const pix = renderPage(page, dpi / 72, { gray });
      imagePage(out, new mupdf.Image(jpegImage(pix, q)), W, H, [0, 0, W, H], false);
    }
    data = savePdf(out, { garbage: 4 });
    if (data.length <= targetKB * 1024) break;
  }
  return data;
}
const jpegImage = (pix, q) => jpeg(pix, q);

tool("compress", async (job) => {
  const msgs = [];
  const targetKB = toFloat(job.opts.target_kb, 0), gray = toBool(job.opts.grayscale);
  for (const f of job.require(1)) {
    const before = f.bytes.length;
    let data;
    if (targetKB > 0) {
      for (const lvl of ["low", "medium", "high", "extreme"]) { data = compressBytes(f, lvl, job.password, gray); if (data.length <= targetKB * 1024) break; }
      if (data.length > targetKB * 1024) { const r = rasterCompress(f, targetKB, job.password, gray); if (r && r.length < data.length) data = r; }
    } else data = compressBytes(f, job.opts.level || "medium", job.password, gray);
    if (data.length >= before && !gray && !openAny(f.bytes, f.name).needsPassword()) data = f.bytes;
    job.out(`${stem(f.name)}_compressed.pdf`, data);
    msgs.push(`${stem(f.name)}: ${humanSize(before)} → ${humanSize(data.length)} (${(100 - data.length * 100 / Math.max(before, 1)).toFixed(0)}% smaller)`);
    if (targetKB && data.length > targetKB * 1024) msgs.push(`Could not reach ${targetKB.toFixed(0)} KB - this is the smallest readable version.`);
  }
  job.message = msgs.join("\n");
});

function rasterize(file, password, dpi, { gray = false, q = 80 } = {}) {
  const src = openPdf(file, password);
  const out = new mupdf.PDFDocument();
  for (let i = 0; i < src.countPages(); i++) {
    const page = src.loadPage(i), { W, H } = pageBox(page);
    const pix = renderPage(page, dpi / 72, { gray });
    imagePage(out, new mupdf.Image(jpeg(pix, q)), W, H, [0, 0, W, H], false);
    pix.destroy?.();
  }
  return out;
}

tool("grayscale", async (job) => {
  for (const f of job.require(1)) job.out(`${stem(f.name)}_grayscale.pdf`, savePdf(rasterize(f, job.password, toInt(job.opts.dpi, 150), { gray: true })));
});

tool("repair", async (job) => {
  for (const f of job.require(1)) job.out(`${stem(f.name)}_repaired.pdf`, savePdf(openPdf(f, job.password), { garbage: 4, extra: "clean" }));
  job.message = "Rebuilt the file structure. If the original opened with errors, try the repaired copy.";
});

tool("flatten", async (job) => {
  for (const f of job.require(1)) {
    let doc;
    if (toBool(job.opts.raster)) doc = rasterize(f, job.password, toInt(job.opts.dpi, 150), { q: 85 });
    else { doc = openPdf(f, job.password); doc.bake(true, true); }
    job.out(`${stem(f.name)}_flat.pdf`, savePdf(doc));
  }
});

// ================================================================ info / compare
tool("info", async (job) => {
  const f = job.first();
  const raw = openAny(f.bytes, f.name);
  const encrypted = raw.needsPassword() || !!raw.getMetaData?.("encryption") && raw.getMetaData("encryption") !== "None";
  const doc = openPdf(f, job.password);
  const sizes = new Map(), imgs = new Set(), fonts = new Set();
  let words = 0, scanned = 0, fields = 0;
  for (let i = 0; i < doc.countPages(); i++) {
    const page = doc.loadPage(i), { W, H } = pageBox(page);
    const key = `${(W / MM).toFixed(0)} × ${(H / MM).toFixed(0)} mm`;
    sizes.set(key, (sizes.get(key) || 0) + 1);
    const res = page.getObject().getInheritable("Resources");
    let hasImg = false;
    if (!res.isNull()) {
      const xo = res.get("XObject");
      if (!xo.isNull()) xo.forEach(v => { const st = v.get("Subtype"); if (st.isName() && st.asName() === "Image") { hasImg = true; imgs.add(v.isIndirect() ? v.asIndirect() : Math.random()); } });
      const fo = res.get("Font");
      if (!fo.isNull()) fo.forEach(v => { const b = v.get("BaseFont"); if (b.isName()) fonts.add(b.asName().split("+").pop()); });
    }
    const t = pageText(page);
    words += t.split(/\s+/).filter(Boolean).length;
    if (!t.trim() && hasImg) scanned++;
    fields += page.getWidgets().length;
  }
  const outline = doc.loadOutline() || [];
  const countToc = (items) => items.reduce((n, it) => n + 1 + countToc(it.down || []), 0);
  const md = {};
  for (const [k, key] of Object.entries({ Title: "info:Title", Author: "info:Author", Subject: "info:Subject", Keywords: "info:Keywords", Creator: "info:Creator", Producer: "info:Producer", Creationdate: "info:CreationDate", Moddate: "info:ModDate" })) {
    const v = doc.getMetaData(key);
    if (v) md[k] = v;
  }
  job.info = {
    File: f.name, "File size": humanSize(f.bytes.length), Pages: doc.countPages(),
    "Page sizes": [...sizes].map(([k, v]) => `${k} (${v})`).join(", "), Words: words, Images: imgs.size,
    Fonts: [...fonts].sort().slice(0, 15).join(", ") || "none", Encrypted: encrypted ? "yes" : "no", "Form fields": fields,
    Bookmarks: countToc(outline), "Looks scanned": scanned ? `${scanned} page(s) have no text - use OCR to make them searchable` : "no",
    "PDF version": doc.getMetaData("format") || "", ...md,
  };
});

/** Line diff (LCS on lines) -> [[op, a, b]] where op is "=", "-", "+" */
function diffLines(a, b) {
  const n = a.length, m = b.length;
  if (n * m > 4e7) return [...a.map(x => ["-", x, ""]), ...b.map(x => ["+", "", x])];
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push(["=", a[i++], b[j++]]); }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(["-", a[i++], ""]);
    else out.push(["+", "", b[j++]]);
  }
  while (i < n) out.push(["-", a[i++], ""]);
  while (j < m) out.push(["+", "", b[j++]]);
  return out;
}

tool("compare", async (job) => {
  const [fa, fb] = job.require(2, 2);
  const da = openPdf(fa, job.password), db = openPdf(fb, job.password);
  const lines = (d) => { const out = []; for (let i = 0; i < d.countPages(); i++) out.push(...pageText(d.loadPage(i)).split("\n").map(s => s.trimEnd()).filter(s => s.trim())); return out; };
  const ta = lines(da), tb = lines(db);
  const diff = diffLines(ta, tb);
  const same = diff.filter(d => d[0] === "=").length;
  const ratio = (ta.length + tb.length) ? 2 * same / (ta.length + tb.length) : 1;
  // pair adjacent -/+ runs as "changed"; keep 2 lines of context
  const rows = [];
  diff.forEach((d, k) => {
    const near = diff.slice(Math.max(0, k - 2), k + 3).some(x => x[0] !== "=");
    if (d[0] === "=" && !near) { if (rows.length && rows[rows.length - 1] !== "gap") rows.push("gap"); return; }
    rows.push(d);
  });
  const cls = { "=": "", "-": "diff_sub", "+": "diff_add" };
  const body = rows.map(r => r === "gap" ? `<tr><td colspan="2" class="gap">⋯</td></tr>`
    : `<tr><td class="${r[0] === "-" ? cls["-"] : ""}">${escHtml(r[1])}</td><td class="${r[0] === "+" ? cls["+"] : ""}">${escHtml(r[2])}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comparison</title>
<style>body{font-family:system-ui,Segoe UI,Arial;margin:16px}table{font-size:13px;border-collapse:collapse;width:100%;table-layout:fixed}td{padding:2px 6px;vertical-align:top;border-bottom:1px solid #eee;word-wrap:break-word}
th{text-align:left;padding:4px 6px;background:#f2f2f2}.diff_add{background:#c8f7c5}.diff_sub{background:#ffc9c9}.gap{color:#999;text-align:center}</style></head>
<body><h2>Comparison: ${escHtml(stem(fa.name))} vs ${escHtml(stem(fb.name))}</h2><p>Text similarity: <b>${(ratio * 100).toFixed(1)}%</b>. Pages: ${da.countPages()} vs ${db.countPages()}.</p>
<table><tr><th>${escHtml(stem(fa.name))}</th><th>${escHtml(stem(fb.name))}</th></tr>${body || '<tr><td colspan="2">The text is identical.</td></tr>'}</table></body></html>`;
  job.out("comparison.html", html);
  // visual differences
  const vis = new mupdf.PDFDocument();
  const label = await resolveFont("helv", false, "Page");
  for (let i = 0; i < Math.min(da.countPages(), db.countPages()); i++) {
    const pa = renderPage(da.loadPage(i), 1), pb = renderPage(db.loadPage(i), 1);
    const w = Math.min(pa.getWidth(), pb.getWidth()), h = Math.min(pa.getHeight(), pb.getHeight());
    const A = pa.getPixels(), B = pb.getPixels(), sa = pa.getStride(), sb = pb.getStride();
    const out = new mupdf.Pixmap(RGB(), [0, 0, w, h], false), O = out.getPixels(), so = out.getStride();
    let any = false;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ia = y * sa + x * 3, ib = y * sb + x * 3, io = y * so + x * 3;
      const d = Math.abs(A[ia] - B[ib]) + Math.abs(A[ia + 1] - B[ib + 1]) + Math.abs(A[ia + 2] - B[ib + 2]);
      if (d > 60) { any = true; O[io] = 255; O[io + 1] = 0; O[io + 2] = 0; } else { O[io] = B[ib]; O[io + 1] = B[ib + 1]; O[io + 2] = B[ib + 2]; }
    }
    if (!any) continue;
    const page = imagePage(vis, new mupdf.Image(out), w, h + 20, [0, 20, w, h + 20], false);
    overlay(vis, page, (dev) => dev.fillText(makeText(label, `Page ${i + 1}: differences in red`, 6, 14, 10), I, RGB(), [0, 0, 0], 1));
  }
  const n = vis.countPages();
  if (n) job.out("visual_differences.pdf", savePdf(vis));
  job.message = `Text similarity ${(ratio * 100).toFixed(1)}%. ` + (n ? `${n} page(s) look different.` : "Pages look identical.");
});

// ================================================================ UI helpers
/** Editable text lines of a page in normalized visual coords (for "Edit text"). */
export function editableLines(bytes, pno) {
  const doc = new mupdf.PDFDocument(bytes);
  const page = doc.loadPage(pno);
  const { x0, y0, W, H } = pageBox(page);
  const res = [];
  for (const l of pageLines(page)) {
    const spans = l.spans.filter(s => s.text.trim());
    if (!spans.length || Math.abs(l.dir[1]) > 0.01) continue;
    const xs0 = Math.min(...spans.map(s => s.bbox[0])), ys0 = Math.min(...spans.map(s => s.bbox[1]));
    const xs1 = Math.max(...spans.map(s => s.bbox[2])), ys1 = Math.max(...spans.map(s => s.bbox[3]));
    const s0 = spans.reduce((a, b) => b.text.length > a.text.length ? b : a);
    const fname = s0.font.toLowerCase();
    const font = (s0.serif || /times|serif|roman|georgia|cambria|minion|garamond/.test(fname)) && !/sans/.test(fname) ? "tiro" : (s0.mono || /courier|mono|consol/.test(fname)) ? "cour" : "helv";
    res.push({ x: (xs0 - x0) / W, y: (ys0 - y0) / H, w: (xs1 - xs0) / W, h: (ys1 - ys0) / H, text: lineText(l).trim(), size: Math.round(s0.size * 10) / 10, color: colorHex(s0.color), bold: s0.bold, font });
  }
  doc.destroy?.();
  return res;
}

export { copyBytes, bufBytes, png, ext };
