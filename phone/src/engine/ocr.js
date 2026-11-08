// OCR (text recognition comes from the host: ML Kit in the Android app) + searchable text layer + scan assembly.
import { IMAGE_EXT, ToolError, ext, host, makeText, mupdf, openPdf, overlay, pageBox, pageText, parsePages, png, renderPage, resolveFont, savePdf, stem, textWidth, toBool, toInt, tool } from "./core.js";
import { imagesToPdfDoc } from "./convert.js";
import { textToDocx } from "./ooxml.js";

const I = mupdf.Matrix.identity;

function needOcr() {
  if (!host.ocr) throw new ToolError("Text recognition (OCR) is not available here.");
}

/** OCR a page -> [{r:[x0,y0,x1,y1] (visual coords), text}] sorted in reading order. */
export async function ocrPageLines(page, dpi = 200) {
  needOcr();
  const { x0, y0, W, H } = pageBox(page);
  const z = Math.min(dpi / 72, 3200 / Math.max(W, H));
  const pix = renderPage(page, z);
  const lines = (await host.ocr(png(pix), pix.getWidth(), pix.getHeight())) || [];
  pix.destroy?.();
  const out = lines.filter(l => String(l.text || "").trim()).map(l => ({ r: [x0 + l.box[0] / z, y0 + l.box[1] / z, x0 + l.box[2] / z, y0 + l.box[3] / z], text: l.text }));
  out.sort((a, b) => Math.round(a.r[1] / 8) - Math.round(b.r[1] / 8) || a.r[0] - b.r[0]);
  return out;
}

export async function addTextLayer(doc, page, lines) {
  if (!lines.length) return;
  const { x0, y0 } = pageBox(page);
  const fonts = [];
  for (const l of lines) fonts.push(await resolveFont("helv", false, l.text));
  overlay(doc, page, (dev) => {
    lines.forEach((l, k) => {
      const [a, b, c, d] = [l.r[0] - x0, l.r[1] - y0, l.r[2] - x0, l.r[3] - y0];
      const size = Math.max(4, (d - b) * 0.85);
      const tl = textWidth(fonts[k], l.text, size) || 1;
      const t = makeText(fonts[k], l.text, a, d - (d - b) * 0.18, size, [(c - a) / tl, 0, 0, 1, 0, 0]);
      dev.ignoreText(t, I); // invisible (render mode 3) but searchable
    });
  });
}

export function linesToText(lines) {
  const out = [];
  let lastY = null;
  for (const { r, text } of lines) {
    if (lastY !== null && Math.abs(r[1] - lastY) < (r[3] - r[1]) * 0.5) out[out.length - 1] += "  " + text;
    else out.push(text);
    lastY = r[1];
  }
  return out.join("\n");
}

export async function makeSearchable(doc, pages = null, force = false, dpi = 200, progress = null) {
  let done = 0;
  const texts = [];
  const list = pages ?? [...Array(doc.countPages()).keys()];
  for (const [k, i] of list.entries()) {
    const page = doc.loadPage(i);
    const existing = pageText(page);
    if (!force && existing.trim()) { texts.push(existing); continue; }
    progress?.(`Reading text on page ${k + 1} of ${list.length}…`);
    const lines = await ocrPageLines(page, dpi);
    await addTextLayer(doc, page, lines);
    texts.push(linesToText(lines));
    done++;
  }
  return { done, text: texts.join("\n\n") };
}

tool("ocr", async (job) => {
  needOcr();
  const fmt = job.opts.output || "pdf";
  for (const f of job.require(1)) {
    const doc = IMAGE_EXT.has(ext(f.name)) ? await imagesToPdfDoc([f], {}) : openPdf(f, job.password);
    const pages = parsePages(job.opts.pages, doc.countPages());
    const { done, text } = await makeSearchable(doc, pages, toBool(job.opts.force), toInt(job.opts.dpi, 200), job.progress);
    if (fmt === "txt" || fmt === "both") job.out(`${stem(f.name)}_ocr.txt`, text);
    if (fmt === "pdf" || fmt === "both") job.out(`${stem(f.name)}_searchable.pdf`, savePdf(doc, { subset: true }));
    if (fmt === "docx") job.out(`${stem(f.name)}_ocr.docx`, await textToDocx(text));
    job.message = done ? `Recognised text on ${done} page(s).` : "These pages already had text. Tick 'Force OCR' to redo them.";
  }
});

export async function ocrImageText(bytes, name) {
  needOcr();
  const lines = (await host.ocr(bytes, 0, 0, name)) || [];
  const rows = lines.filter(l => String(l.text || "").trim()).map(l => ({ r: l.box, text: l.text }));
  rows.sort((a, b) => Math.round(a.r[1] / 10) - Math.round(b.r[1] / 10) || a.r[0] - b.r[0]);
  return linesToText(rows);
}

/** Scanner output: job.files are the processed page images (from the scanner worker). */
tool("scan", async (job) => {
  if (!job.files.length) throw new ToolError("Add at least one photo.");
  const name = String(job.opts.filename || "Scan").replace(/\.pdf$/i, "");
  if (job.opts.output === "images") {
    job.files.forEach((f, k) => job.out(`${name}_${k + 1}${ext(f.name)}`, f.bytes));
    return;
  }
  const doc = await imagesToPdfDoc(job.files, { page_size: job.opts.page_size || "a4", margin: 0 });
  if (toBool(job.opts.ocr) && host.ocr) {
    await makeSearchable(doc, null, true, 200, job.progress);
    job.message = "Text recognised - the PDF is searchable.";
  }
  job.out(`${name}.pdf`, savePdf(doc, { subset: true }));
});
