// Conversions (port of mypdf/convert.py) on MuPDF.js.
import {
  IMAGE_EXT, MM, OFFICE_EXT, PAPER, TEXT_EXT, ToolError, convertToPdf, copyBytes, escHtml, ext, host, humanSize, imagePage,
  jpeg, loadImage, mupdf, openAny, openPdf, pageBox, pageText, parsePages, png, renderPage, savePdf, stem, toBool, toFloat, toInt, tool, RGB, rectPath,
} from "./core.js";
import { blocksToHtml, blocksToMarkdown, bodySize, pageBlocks, blockParagraphs } from "./blocks.js";
import { markdownToHtml } from "./markdown.js";
import { buildDocx, buildEpub, buildPptx, buildXlsx } from "./ooxml.js";
import { copyPages } from "./organize.js";

// ================================================================ images -> PDF
async function imageFrames(file) {
  const e = ext(file.name);
  if (e === ".tif" || e === ".tiff") { // multi-page TIFF
    try {
      const d = mupdf.Document.openDocument(file.bytes, file.name);
      const n = d.countPages();
      if (n > 1) {
        const out = [];
        for (let i = 0; i < n; i++) out.push(new mupdf.Image(d.loadPage(i).toPixmap(mupdf.Matrix.identity, RGB(), false)));
        return out;
      }
    } catch { /* fall back to a single frame */ }
  }
  return [await loadImage(file.bytes, file.name)];
}

export async function imagesToPdfDoc(files, o) {
  const size = o.page_size || "fit", orient = o.orientation || "auto", margin = toFloat(o.margin, 0) * MM;
  const doc = new mupdf.PDFDocument();
  for (const f of files) {
    for (const im of await imageFrames(f)) {
      const iw = im.getWidth(), ih = im.getHeight();
      let W, H;
      if (size === "fit") {
        [W, H] = iw > ih ? [842, 842 * ih / iw] : [595, 595 * ih / iw];
        W += 2 * margin; H += 2 * margin;
      } else {
        [W, H] = PAPER[size] || PAPER.a4;
        const land = orient === "auto" ? iw > ih : orient === "landscape";
        if (land) [W, H] = [H, W];
      }
      imagePage(doc, im, W, H, [margin, margin, W - margin, H - margin]);
    }
  }
  return doc;
}

tool("images_to_pdf", async (job) => {
  const files = job.require(1).filter(f => IMAGE_EXT.has(ext(f.name)));
  if (!files.length) throw new ToolError("Please add image files (JPG, PNG, HEIC, WEBP...).");
  if (toBool(job.opts.separate)) {
    for (const f of files) job.out(`${stem(f.name)}.pdf`, savePdf(await imagesToPdfDoc([f], job.opts)));
    return;
  }
  const name = job.opts.filename || (files.length === 1 ? stem(files[0].name) : "images") + ".pdf";
  job.out(name.endsWith(".pdf") ? name : name + ".pdf", savePdf(await imagesToPdfDoc(files, job.opts)));
});

// ================================================================ documents / text -> PDF
const CSS = `@page { margin: 54pt; } body { font-family: sans-serif; font-size: 11pt; line-height: 1.4; }
h1 { font-size: 20pt; } h2 { font-size: 16pt; } h3 { font-size: 13pt; } pre, code { font-family: monospace; font-size: 9.5pt; }
table { border-collapse: collapse; } td, th { border: 1px solid #999; padding: 3px; } blockquote { margin-left: 18pt; color: #444; } img { max-width: 100%; }`;

function decodeText(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, ""); }
  catch { return new TextDecoder("windows-1252").decode(bytes); }
}
function csvRows(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === "," || c === ";" && !text.includes(",")) { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function htmlToPdf(html, paper = "a4") {
  const [W, H] = PAPER[paper] || PAPER.a4;
  mupdf.setUserCSS(CSS);
  const doc = mupdf.Document.openDocument(new TextEncoder().encode(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`), "text/html");
  doc.layout(W, H, 11);
  const pdf = convertToPdf(doc);
  mupdf.setUserCSS("");
  return pdf;
}

export function textFileToPdf(file, paper = "a4") {
  const text = decodeText(file.bytes);
  const e = ext(file.name);
  let html;
  if (e === ".html" || e === ".htm") html = text.replace(/^[\s\S]*<body[^>]*>/i, "").replace(/<\/body>[\s\S]*$/i, "");
  else if (e === ".md" || e === ".markdown") html = markdownToHtml(text);
  else if (e === ".csv") html = `<table>${csvRows(text).map(r => `<tr>${r.map(c => `<td>${escHtml(c)}</td>`).join("")}</tr>`).join("")}</table>`;
  else {
    const mono = ![".txt", ".log"].includes(e);
    html = `<div style="font-family:${mono ? "monospace" : "sans-serif"};font-size:${mono ? "9.5pt" : "11pt"};white-space:pre-wrap">${escHtml(text)}</div>`;
  }
  return htmlToPdf(html, paper);
}

/** Office / EPUB / XPS / FB2 / CBZ / SVG … -> PDF with MuPDF's own layout engine. */
export function documentToPdf(file) {
  const e = ext(file.name);
  if ([".doc", ".xls", ".ppt"].includes(e)) throw new ToolError(`'${file.name}' uses the old ${e.slice(1).toUpperCase()} format. Save it as ${e.slice(1).toUpperCase()}X (newer format) and try again.`);
  if ([".odt", ".ods", ".odp", ".rtf"].includes(e)) throw new ToolError(`${e.slice(1).toUpperCase()} files can't be converted on the phone. Save it as DOCX / XLSX / PPTX first.`);
  const doc = openAny(file.bytes, file.name);
  try { doc.layout?.(PAPER.a4[0], PAPER.a4[1], 11); } catch { /* fixed layout */ }
  if (doc.isPDF()) return doc.asPDF();
  return convertToPdf(doc);
}

tool("office_to_pdf", async (job) => {
  for (const f of job.require(1)) {
    if (!OFFICE_EXT.has(ext(f.name))) throw new ToolError(`'${f.name}' is not a Word/Excel/PowerPoint file.`);
    const doc = ext(f.name) === ".csv" ? textFileToPdf(f) : documentToPdf(f);
    job.out(`${stem(f.name)}.pdf`, savePdf(doc, { subset: true }));
  }
  job.message = "Converted with the built-in engine. Complex layouts may look slightly different from Office.";
});

tool("text_to_pdf", async (job) => {
  const paper = job.opts.page_size || "a4";
  if (String(job.opts.text || "").trim() && !job.files.length) {
    job.out(`${job.opts.filename || "document"}.pdf`, savePdf(htmlToPdf(markdownToHtml(job.opts.text), paper), { subset: true }));
    return;
  }
  for (const f of job.require(1)) job.out(`${stem(f.name)}.pdf`, savePdf(textFileToPdf(f, paper), { subset: true }));
});

tool("to_pdf", async (job) => {
  const files = job.require(1);
  const images = files.filter(f => IMAGE_EXT.has(ext(f.name)));
  const others = files.filter(f => !IMAGE_EXT.has(ext(f.name)));
  const outs = [];
  if (images.length) outs.push([images.length > 1 ? "images.pdf" : `${stem(images[0].name)}.pdf`, await imagesToPdfDoc(images, job.opts)]);
  for (const f of others) {
    const e = ext(f.name);
    let doc;
    if (e === ".pdf") doc = openPdf(f, job.password);
    else if (TEXT_EXT.has(e) || e === ".csv") doc = textFileToPdf(f);
    else doc = documentToPdf(f);
    outs.push([`${stem(f.name)}.pdf`, doc]);
  }
  if (toBool(job.opts.merge) && outs.length > 1) {
    const m = new mupdf.PDFDocument();
    for (const [, d] of outs) copyPages(m, d, [...Array(d.countPages()).keys()]);
    job.out("combined.pdf", savePdf(m, { subset: true }));
    return;
  }
  for (const [name, d] of outs) job.out(name, savePdf(d, { subset: true }));
});

// ================================================================ PDF -> images
function tiffRGB(w, h, rgb) { // baseline uncompressed RGB TIFF
  const entries = [[256, 4, 1, w], [257, 4, 1, h], [258, 3, 3, 0], [259, 3, 1, 1], [262, 3, 1, 2], [273, 4, 1, 0], [277, 3, 1, 3], [278, 4, 1, h], [279, 4, 1, w * h * 3], [282, 5, 1, 0], [283, 5, 1, 0], [296, 3, 1, 2]];
  const ifdSize = 2 + entries.length * 12 + 4, extra = 6 + 16, header = 8;
  const dataOff = header + ifdSize + extra;
  const buf = new Uint8Array(dataOff + rgb.length);
  const dv = new DataView(buf.buffer);
  buf.set([0x49, 0x49, 42, 0]); dv.setUint32(4, 8, true);
  dv.setUint16(8, entries.length, true);
  const bpsOff = header + ifdSize, resOff = bpsOff + 6;
  entries.forEach(([tag, type, count, val], i) => {
    const o = 10 + i * 12;
    dv.setUint16(o, tag, true); dv.setUint16(o + 2, type, true); dv.setUint32(o + 4, count, true);
    if (tag === 258) val = bpsOff; else if (tag === 273) val = dataOff; else if (tag === 282) val = resOff; else if (tag === 283) val = resOff + 8;
    if (type === 3 && count === 1) dv.setUint16(o + 8, val, true); else dv.setUint32(o + 8, val, true);
  });
  dv.setUint16(bpsOff, 8, true); dv.setUint16(bpsOff + 2, 8, true); dv.setUint16(bpsOff + 4, 8, true);
  dv.setUint32(resOff, 150, true); dv.setUint32(resOff + 4, 1, true); dv.setUint32(resOff + 8, 150, true); dv.setUint32(resOff + 12, 1, true);
  buf.set(rgb, dataOff);
  return buf;
}
function packedRGB(pix) {
  const w = pix.getWidth(), h = pix.getHeight(), s = pix.getStride(), n = pix.getNumberOfComponents() + (pix.getAlpha() ? 1 : 0), px = pix.getPixels();
  const out = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) out[(y * w + x) * 3 + c] = px[y * s + x * n + (n >= 3 ? c : 0)];
  return out;
}
export async function encodePix(pix, format, quality = 90) {
  if (format === "jpg" || format === "jpeg") return jpeg(pix, quality);
  if (format === "png") return png(pix);
  if (format === "tiff" || format === "tif") return tiffRGB(pix.getWidth(), pix.getHeight(), packedRGB(pix));
  if (format === "webp") {
    if (!host.encodeImage) throw new ToolError("WEBP export is not available here.");
    return host.encodeImage({ w: pix.getWidth(), h: pix.getHeight(), rgb: packedRGB(pix) }, "image/webp", quality / 100);
  }
  return png(pix);
}

tool("pdf_to_images", async (job) => {
  const f = job.first();
  const doc = openPdf(f, job.password);
  const fmt = job.opts.format || "jpg", z = toInt(job.opts.dpi, 150) / 72;
  for (const i of parsePages(job.opts.pages, doc.countPages())) {
    const pix = renderPage(doc.loadPage(i), z);
    job.out(`${stem(f.name)}_page${i + 1}.${fmt}`, await encodePix(pix, fmt, toInt(job.opts.quality, 90)));
    pix.destroy?.();
  }
});

tool("pdf_to_long_image", async (job) => {
  const f = job.first();
  const doc = openPdf(f, job.password);
  const width = Math.max(200, Math.min(4000, toInt(job.opts.width, 1200)));
  let pages = parsePages(job.opts.pages, doc.countPages()).slice(0, 60);
  const gap = 12;
  const heights = pages.map(i => { const b = pageBox(doc.loadPage(i)); return Math.round(b.H * width / b.W); });
  let total = 0, keep = 0;
  for (const hgt of heights) { if (total + hgt > 65000) break; total += hgt + (keep ? gap : 0); keep++; }
  if (keep < pages.length) job.message = `Image size limit reached - included the first ${keep} pages.`;
  pages = pages.slice(0, keep);
  const pix = new mupdf.Pixmap(RGB(), [0, 0, width, total], false);
  pix.clear(225);
  let y = 0;
  pages.forEach((i, k) => {
    const page = doc.loadPage(i), b = pageBox(page), z = width / b.W;
    const dev = new mupdf.DrawDevice([z, 0, 0, z, -b.x0 * z, y - b.y0 * z], pix);
    dev.fillPath(rectPath([b.x0, b.y0, b.x0 + b.W, b.y0 + b.H]), false, mupdf.Matrix.identity, RGB(), [1, 1, 1], 1);
    page.run(dev, mupdf.Matrix.identity);
    dev.close();
    y += heights[k] + gap;
  });
  job.out(`${stem(f.name)}_long.jpg`, jpeg(pix, 85));
});

// ================================================================ PDF -> Office / text
const FAMILY = (s) => s.mono ? "Courier New" : s.serif ? "Times New Roman" : "Arial";

function imageBytes(image) {
  let pix = image.toPixmap();
  const cs = pix.getColorSpace();
  if (cs && !cs.isRGB() && !cs.isGray()) pix = pix.convertToColorSpace(RGB(), false);
  return png(pix);
}

tool("pdf_to_word", async (job) => {
  for (const f of job.require(1)) {
    const doc = openPdf(f, job.password);
    const n = doc.countPages();
    const sel = job.opts.pages ? parsePages(job.opts.pages, n) : [...Array(n).keys()];
    const pages = [];
    for (const i of sel) {
      const page = doc.loadPage(i), { x0: px, y0: py, W, H } = pageBox(page);
      const blocks = pageBlocks(page);
      const body = bodySize(blocks);
      const left = Math.min(72, ...blocks.map(b => b.bbox[0] - px).filter(v => v >= 0));
      const right = Math.min(72, ...blocks.map(b => px + W - b.bbox[2]).filter(v => v >= 0));
      const top = Math.min(72, ...blocks.map(b => b.bbox[1] - py).filter(v => v >= 0));
      const items = [];
      let lastY = py + top;
      for (const b of blocks) {
        const before = Math.max(0, b.bbox[1] - lastY);
        const indent = Math.max(0, b.bbox[0] - px - left);
        if (b.type === "image") {
          const w = b.bbox[2] - b.bbox[0], hgt = b.bbox[3] - b.bbox[1];
          if (w > 4 && hgt > 4) { try { items.push({ type: "img", data: imageBytes(b.image), ext: "png", w: Math.min(w, W - left - right), h: hgt * Math.min(1, (W - left - right) / w), before, indent }); } catch { /* skip */ } }
        } else {
          const contentW = W - left - right, bw = b.bbox[2] - b.bbox[0];
          const lm = b.bbox[0] - px - left, rm = px + W - right - b.bbox[2];
          const align = bw < contentW * 0.8 && Math.abs(lm - rm) < 12 && lm > 20 ? "center" : rm < 2 && lm > contentW * 0.3 ? "right" : null;
          const paras = blockParagraphs(b, body);
          paras.forEach((p, k) => {
            const style = p.kind[0] === "h" ? `Heading${p.kind[1]}` : null;
            items.push({ type: "p", style, before: k ? 0 : before, indent: align ? 0 : indent, align,
              runs: p.spans.map(s => ({ text: (p.kind === "li" && s === p.spans[0] ? "• " : "") + s.text, size: s.size, bold: s.bold, italic: s.italic, color: s.color, font: FAMILY(s) })) });
          });
        }
        lastY = b.bbox[3];
      }
      pages.push({ w: W, h: H, margins: [top, right, 36, left], items });
    }
    job.out(`${stem(f.name)}.docx`, await buildDocx(pages));
  }
  job.message = "Converted with the built-in engine: text, fonts, colours and pictures are kept; complex layouts and tables become simple paragraphs.";
});

const num = (v) => {
  const s = String(v).trim().replace(/,/g, "");
  return /^-?\d+(\.\d+)?$/.test(s) && s.length < 16 ? +s : String(v).trim();
};

/** Split page text into a grid: rows by baseline, columns by x-position clusters. */
export function pageGrid(page) {
  const segs = [];
  for (const b of pageBlocks(page, { images: false })) for (const l of b.lines) {
    for (const s of l.spans) {
      // split spans on wide gaps (2+ spaces)
      let x = s.x0;
      for (const part of s.text.split(/\s{2,}|\t/)) {
        if (part.trim()) segs.push({ text: part.trim(), x0: x, y: l.bbox[1], y1: l.bbox[3] });
        x += (part.length + 2) * s.size * 0.5;
      }
    }
  }
  if (!segs.length) return [];
  segs.sort((a, b) => a.y - b.y || a.x0 - b.x0);
  const rows = [];
  for (const s of segs) {
    const r = rows[rows.length - 1];
    if (r && Math.abs(s.y - r.y) < Math.max(3, (s.y1 - s.y) * 0.5)) r.segs.push(s); else rows.push({ y: s.y, segs: [s] });
  }
  const xs = segs.map(s => s.x0).sort((a, b) => a - b);
  const anchors = [];
  for (const x of xs) if (!anchors.length || x - anchors[anchors.length - 1] > 14) anchors.push(x);
  return rows.map(r => {
    const out = [];
    for (const s of r.segs.sort((a, b) => a.x0 - b.x0)) {
      let c = 0;
      for (let k = 0; k < anchors.length; k++) if (anchors[k] <= s.x0 + 2) c = k;
      while (out[c] !== undefined) c++;
      out[c] = num(s.text);
    }
    return Array.from(out, v => v ?? "");
  });
}

tool("pdf_to_excel", async (job) => {
  const f = job.first();
  const doc = openPdf(f, job.password);
  const sheets = [];
  for (let i = 0; i < doc.countPages(); i++) {
    const rows = pageGrid(doc.loadPage(i));
    if (rows.length) sheets.push({ name: `Page ${i + 1}`, rows, boldFirst: true });
  }
  if (!sheets.length) throw new ToolError("No text found - this looks like a scanned PDF. Use OCR first.");
  job.message = `Exported ${sheets.length} page(s); columns are detected from the text positions.`;
  job.out(`${stem(f.name)}.xlsx`, await buildXlsx(sheets));
});

tool("pdf_to_pptx", async (job) => {
  const f = job.first();
  const doc = openPdf(f, job.password);
  const z = toInt(job.opts.dpi, 150) / 72;
  const slides = [];
  let size = null;
  for (let i = 0; i < doc.countPages(); i++) {
    const page = doc.loadPage(i);
    if (!size) { const b = pageBox(page); size = [b.W, b.H]; }
    const pix = renderPage(page, z);
    slides.push({ data: jpeg(pix, 88), ext: "jpeg" });
    pix.destroy?.();
  }
  job.out(`${stem(f.name)}.pptx`, await buildPptx(slides, size));
});

tool("pdf_to_text", async (job) => {
  for (const f of job.require(1)) {
    const doc = openPdf(f, job.password);
    const parts = [];
    for (let i = 0; i < doc.countPages(); i++) parts.push(pageText(doc.loadPage(i)));
    const text = parts.join(toBool(job.opts.page_breaks) ? "\n\f" : "\n");
    if (!text.trim()) job.message = "No text found - this looks like a scanned PDF. Use the OCR tool instead.";
    job.out(`${stem(f.name)}.txt`, text);
  }
});

function docBlocks(doc) {
  const pages = [];
  for (let i = 0; i < doc.countPages(); i++) pages.push(pageBlocks(doc.loadPage(i)));
  return { pages, body: bodySize(pages.flat()) };
}

tool("pdf_to_markdown", async (job) => {
  for (const f of job.require(1)) {
    const { pages, body } = docBlocks(openPdf(f, job.password));
    job.out(`${stem(f.name)}.md`, pages.map(b => blocksToMarkdown(b, body)).join("\n\n---\n\n"));
  }
});

const b64 = (bytes) => {
  if (typeof Buffer !== "undefined" && Buffer.from) return Buffer.from(bytes).toString("base64");
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

tool("pdf_to_html", async (job) => {
  const f = job.first();
  const { pages, body } = docBlocks(openPdf(f, job.password));
  const img = (b) => { try { return "data:image/png;base64," + b64(imageBytes(b.image)); } catch { return null; } };
  const html = pages.map(b => `<section class="page">${blocksToHtml(b, body, img)}</section>`).join("\n");
  job.out(`${stem(f.name)}.html`, `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(stem(f.name))}</title>`
    + `<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:860px;margin:auto;padding:16px;line-height:1.5}`
    + `section.page{border-bottom:1px solid #ddd;padding:12px 0}img{max-width:100%}</style></head><body>${html}</body></html>`);
});

tool("pdf_to_epub", async (job) => {
  const f = job.first();
  const doc = openPdf(f, job.password);
  const title = doc.getMetaData("info:Title") || stem(f.name);
  const { pages, body } = docBlocks(doc);
  const images = [];
  const img = (b) => { try { const name = `img${images.length + 1}.png`; images.push({ name, data: imageBytes(b.image), type: "image/png" }); return name; } catch { return null; } };
  const chapters = pages.map((b, i) => ({ title: `Page ${i + 1}`, html: blocksToHtml(b, body, img) || "<p></p>" }));
  job.out(`${stem(f.name)}.epub`, await buildEpub(title, chapters, images));
});

// ================================================================ extract images
function* pageImageRefs(res, depth = 0) {
  if (!res || res.isNull()) return;
  const xo = res.get("XObject");
  if (xo.isNull()) return;
  const refs = [];
  xo.forEach((v) => refs.push(v));
  for (const v of refs) {
    const st = v.get("Subtype");
    if (st.isName() && st.asName() === "Image") yield v;
    else if (st.isName() && st.asName() === "Form" && depth < 3) yield* pageImageRefs(v.get("Resources"), depth + 1);
  }
}

tool("extract_images", async (job) => {
  const f = job.first();
  const doc = openPdf(f, job.password);
  const minPx = toInt(job.opts.min_size, 50);
  const seen = new Set();
  let count = 0;
  for (let i = 0; i < doc.countPages(); i++) {
    const pobj = doc.loadPage(i).getObject();
    for (const ref of pageImageRefs(pobj.getInheritable("Resources"))) {
      const id = ref.isIndirect() ? ref.asIndirect() : Math.random();
      if (seen.has(id)) continue;
      seen.add(id);
      try {
        const w = ref.get("Width").asNumber(), h = ref.get("Height").asNumber();
        if (w < minPx || h < minPx) continue;
        const filter = ref.get("Filter");
        const fname = filter.isName() ? filter.asName() : "";
        const cs = ref.get("ColorSpace");
        const plainCs = cs.isName() && ["DeviceRGB", "DeviceGray"].includes(cs.asName());
        count++;
        if (fname === "DCTDecode" && ref.get("SMask").isNull() && plainCs) {
          job.out(`page${i + 1}_img${count}.jpg`, copyBytes(ref.readRawStream().asUint8Array()));
        } else {
          job.out(`page${i + 1}_img${count}.png`, imageBytes(doc.loadImage(ref)));
        }
      } catch { /* unreadable image */ }
    }
  }
  if (!count) throw new ToolError("No images found in this PDF.");
  job.message = `Extracted ${count} image(s).`;
});

// ================================================================ image tools
tool("image_convert", async (job) => {
  if (!host.transcode) throw new ToolError("Image conversion is not available here.");
  const o = job.opts, msgs = [];
  for (const f of job.require(1)) {
    if (!IMAGE_EXT.has(ext(f.name))) throw new ToolError(`'${f.name}' is not an image.`);
    let fmt = o.format || "jpg";
    if (fmt === "same") fmt = { ".jpeg": "jpg", ".jfif": "jpg", ".heic": "jpg", ".heif": "jpg", ".avif": "jpg", ".tif": "png", ".tiff": "png", ".bmp": "png", ".gif": "png" }[ext(f.name)] || ext(f.name).slice(1);
    const data = await host.transcode(f.bytes, f.name, { format: fmt, quality: toInt(o.quality, 85), maxW: toInt(o.max_width, 0), maxH: toInt(o.max_height, 0), gray: toBool(o.grayscale), targetKB: toFloat(o.target_kb, 0) });
    job.out(`${stem(f.name)}.${fmt}`, data);
    msgs.push(`${stem(f.name)}: ${humanSize(f.bytes.length)} → ${humanSize(data.length)}`);
  }
  job.message = msgs.join("\n");
});
