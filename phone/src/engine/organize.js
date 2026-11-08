// Organize tools (port of the ORGANIZE section of mypdf/pdf_tools.py).
import {
  IMAGE_EXT, MM, PAPER, ToolError, ext, mupdf, newBlankPage, openPdf, pageBox, pageXObject, parsePages, pdfRect,
  placeXObject, renderPage, savePdf, stem, toBool, toFloat, toInt, tool, overlay, rectPath, stroke, RGB,
} from "./core.js";
import { imagesToPdfDoc } from "./convert.js";

export async function loadAny(file, password) {
  if (IMAGE_EXT.has(ext(file.name))) return imagesToPdfDoc([file], {});
  return openPdf(file, password);
}

export function copyPages(dst, src, pages, at = -1) {
  const map = dst.newGraftMap();
  let pos = at;
  for (const p of pages) { map.graftPage(pos, src, p); if (pos >= 0) pos++; }
}

export function setToc(doc, toc) { // toc: [[level, title, page1based]]
  const it = doc.outlineIterator();
  while (it.item()) it.delete(); // replace existing outline
  const uri = (p) => doc.formatLinkURI({ type: "Fit", chapter: 0, page: p - 1 });
  let level = 1;
  for (const [lvl, title, page] of toc) {
    while (level > lvl) { it.up(); it.next(); level--; }
    while (level < lvl) { it.prev(); it.down(); level++; }
    it.insert({ title, uri: uri(page), open: true });
  }
}

const rotation = (page) => { const r = page.getObject().getInheritable("Rotate"); return r.isNull() ? 0 : ((r.asNumber() % 360) + 360) % 360; };
const setRotation = (page, r) => page.getObject().put("Rotate", ((r % 360) + 360) % 360);

tool("merge", async (job) => {
  const files = job.files.length === 1 ? job.files : job.require(2);
  const out = new mupdf.PDFDocument();
  const toc = [];
  for (const f of files) {
    const src = await loadAny(f, job.password);
    toc.push([1, stem(f.name), out.countPages() + 1]);
    copyPages(out, src, [...Array(src.countPages()).keys()]);
    src.destroy?.();
  }
  if (toBool(job.opts.bookmarks ?? true)) setToc(out, toc);
  const name = job.opts.filename || "merged.pdf";
  job.out(name.endsWith(".pdf") ? name : name + ".pdf", savePdf(out));
});

function writeRange(src, pages) {
  const d = new mupdf.PDFDocument();
  copyPages(d, src, pages);
  const b = savePdf(d);
  d.destroy?.();
  return b;
}

tool("split", async (job) => {
  const f = job.first();
  const src = openPdf(f, job.password);
  const n = src.countPages();
  const mode = job.opts.mode || "each";
  let groups = [];
  if (mode === "each") groups = [...Array(n).keys()].map(i => [i]);
  else if (mode === "every") {
    const k = Math.max(1, toInt(job.opts.every, 1));
    for (let i = 0; i < n; i += k) groups.push([...Array(Math.min(k, n - i)).keys()].map(j => i + j));
  } else if (mode === "ranges") {
    const parts = String(job.opts.ranges || "").split(/[;,]/).filter(p => p.trim());
    if (!parts.length) throw new ToolError("Enter ranges like 1-3, 4-6, 7-");
    groups = parts.map(p => parsePages(p, n));
  } else if (mode === "half") {
    const h = Math.ceil(n / 2);
    groups = [[...Array(h).keys()], [...Array(n - h).keys()].map(i => i + h)];
  } else if (mode === "size") {
    const limit = toFloat(job.opts.size_mb, 5) * 1024 * 1024;
    let cur = [];
    for (let i = 0; i < n; i++) {
      const trial = [...cur, i];
      if (writeRange(src, trial).length > limit && cur.length) { groups.push(cur); cur = [i]; } else cur = trial;
    }
    if (cur.length) groups.push(cur);
  }
  let count = 0;
  for (const g of groups) {
    if (!g.length) continue;
    const label = g.length === 1 ? `${g[0] + 1}` : `${g[0] + 1}-${g[g.length - 1] + 1}`;
    job.out(`${stem(f.name)}_p${label}.pdf`, writeRange(src, g));
    count++;
  }
  job.message = `Split into ${count} files.`;
});

tool("remove_pages", async (job) => {
  const f = job.first();
  const doc = openPdf(f, job.password);
  const n = doc.countPages();
  const pages = [...new Set(parsePages(job.opts.pages, n, false))].sort((a, b) => b - a);
  if (pages.length >= n) throw new ToolError("You can't remove every page.");
  for (const p of pages) doc.deletePage(p);
  job.message = `Removed ${pages.length} page(s); ${doc.countPages()} left.`;
  job.out(`${stem(f.name)}_edited.pdf`, savePdf(doc));
});

tool("extract_pages", async (job) => {
  const f = job.first();
  const doc = openPdf(f, job.password);
  const pages = parsePages(job.opts.pages, doc.countPages(), false);
  if (toBool(job.opts.separate)) for (const p of pages) job.out(`${stem(f.name)}_p${p + 1}.pdf`, writeRange(doc, [p]));
  else job.out(`${stem(f.name)}_extract.pdf`, writeRange(doc, pages));
});

tool("organize", async (job) => {
  const items = job.opts.items || [];
  if (!items.length) throw new ToolError("No pages left - add at least one page.");
  const srcs = new Map(), maps = new Map();
  const out = new mupdf.PDFDocument();
  let last = PAPER.a4;
  for (const it of items) {
    if (it.blank) { newBlankPage(out, last[0], last[1]); continue; }
    if (!srcs.has(it.d)) { srcs.set(it.d, new mupdf.PDFDocument(job.docBytes(it.d))); maps.set(it.d, out.newGraftMap()); }
    maps.get(it.d).graftPage(-1, srcs.get(it.d), +it.p);
    const page = out.loadPage(out.countPages() - 1);
    const rot = toInt(it.r, 0) % 360;
    if (rot) setRotation(page, rotation(page) + rot);
    const b = pageBox(page);
    last = [b.W, b.H];
  }
  const name = job.opts.filename || "organized.pdf";
  job.out(name.endsWith(".pdf") ? name : name + ".pdf", savePdf(out));
});

tool("rotate", async (job) => {
  const angle = toInt(job.opts.angle, 90);
  for (const f of job.require(1)) {
    const doc = openPdf(f, job.password);
    for (const i of parsePages(job.opts.pages, doc.countPages())) { const p = doc.loadPage(i); setRotation(p, rotation(p) + angle); }
    job.out(`${stem(f.name)}_rotated.pdf`, savePdf(doc));
  }
});

tool("insert_blank", async (job) => {
  const f = job.first();
  const doc = openPdf(f, job.password);
  const n = doc.countPages();
  const after = Math.max(0, Math.min(toInt(job.opts.after, n), n));
  const count = Math.max(1, toInt(job.opts.count, 1));
  let size = PAPER.a4;
  if (n) { const b = pageBox(doc.loadPage(Math.max(0, after - 1))); size = [b.W, b.H]; }
  for (let k = 0; k < count; k++) newBlankPage(doc, size[0], size[1], after + k);
  job.out(`${stem(f.name)}_blank.pdf`, savePdf(doc));
});

tool("reverse", async (job) => {
  const f = job.first();
  const doc = openPdf(f, job.password);
  doc.rearrangePages([...Array(doc.countPages()).keys()].reverse());
  job.out(`${stem(f.name)}_reversed.pdf`, savePdf(doc));
});

export function contentBBox(page) {
  const { x0, y0, W, H } = pageBox(page);
  const s = 50 / 72;
  const pix = renderPage(page, s, { gray: true });
  const w = pix.getWidth(), h = pix.getHeight(), stride = pix.getStride(), px = pix.getPixels();
  let minx = w, miny = h, maxx = -1, maxy = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[y * stride + x] < 245) {
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
  pix.destroy?.();
  if (maxx < 0) return null;
  const sx = W / w, sy = H / h;
  return [x0 + minx * sx, y0 + miny * sy, x0 + (maxx + 1) * sx, y0 + (maxy + 1) * sy];
}

tool("crop", async (job) => {
  const f = job.first();
  const doc = openPdf(f, job.password);
  const mode = job.opts.mode || "margins";
  const [t, r, b, l] = ["top", "right", "bottom", "left"].map(k => toFloat(job.opts[k], 0) * MM);
  const pad = toFloat(job.opts.padding, 5) * MM;
  for (const i of parsePages(job.opts.pages, doc.countPages())) {
    const page = doc.loadPage(i);
    const { x0, y0, W, H } = pageBox(page);
    let nv;
    if (mode === "auto") {
      const bb = contentBBox(page);
      if (!bb) continue;
      nv = [Math.max(x0, bb[0] - pad), Math.max(y0, bb[1] - pad), Math.min(x0 + W, bb[2] + pad), Math.min(y0 + H, bb[3] + pad)];
    } else nv = [x0 + l, y0 + t, x0 + W - r, y0 + H - b];
    if (nv[2] - nv[0] < 10 || nv[3] - nv[1] < 10) throw new ToolError("Margins are too large - nothing would be left of the page.");
    page.setPageBox("CropBox", nv); // MuPDF converts visual coords (incl. rotation) to PDF space
  }
  job.out(`${stem(f.name)}_cropped.pdf`, savePdf(doc));
});

tool("nup", async (job) => {
  const f = job.first();
  const src = openPdf(f, job.password);
  const per = toInt(job.opts.per_sheet, 2);
  const layouts = { 2: [2, 1, true], 4: [2, 2, false], 6: [2, 3, false], 8: [2, 4, true], 9: [3, 3, false] };
  let [cols, rows, land] = layouts[per] || layouts[2];
  if (land) [cols, rows] = [Math.max(cols, rows), Math.min(cols, rows)];
  if (per === 8) [cols, rows] = [4, 2];
  const [SW, SH] = land ? [PAPER.a4[1], PAPER.a4[0]] : PAPER.a4;
  const out = new mupdf.PDFDocument();
  const map = out.newGraftMap();
  const cw = SW / cols, ch = SH / rows;
  const borders = toBool(job.opts.borders);
  let page = null;
  const cells = [];
  const n = src.countPages();
  for (let i = 0; i < n; i++) {
    const k = i % (cols * rows);
    if (k === 0) {
      if (page && borders) drawBorders(out, page, cells.splice(0));
      newBlankPage(out, SW, SH);
      page = out.loadPage(out.countPages() - 1);
    }
    const c = k % cols, rw = Math.floor(k / cols);
    const cell = [c * cw + 6, rw * ch + 6, (c + 1) * cw - 6, (rw + 1) * ch - 6];
    placeXObject(out, page, pageXObject(out, src, i, map), cell);
    cells.push(cell);
  }
  if (page && borders) drawBorders(out, page, cells);
  job.out(`${stem(f.name)}_${per}up.pdf`, savePdf(out));
});

function drawBorders(doc, page, cells) {
  overlay(doc, page, (dev) => { for (const c of cells) dev.strokePath(rectPath(c), stroke(0.5, false), [1, 0, 0, 1, 0, 0], RGB(), [0.7, 0.7, 0.7], 1); });
}
