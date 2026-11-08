// Engine entry point: run tools, open documents for the visual tools, render thumbnails.
import { IMAGE_EXT, Job, TOOLS, ToolError, convertToPdf, ext, mupdf, openAny, pageBox, savePdf, setHost, stem } from "./core.js";
import "./organize.js";
import { documentToPdf, imagesToPdfDoc, textFileToPdf } from "./convert.js";
import { editableLines, formFields } from "./pdftools.js";
import { ocrImageText } from "./ocr.js";

export { setHost, ocrImageText };
export const toolNames = () => Object.keys(TOOLS).sort();

const STORE = new Map(); // doc id -> PDF bytes (unencrypted)
const OPEN = new Map();  // doc id -> PDFDocument (small cache for rendering)
const newId = () => Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-8);

function cachedDoc(id) {
  if (OPEN.has(id)) { const d = OPEN.get(id); OPEN.delete(id); OPEN.set(id, d); return d; }
  const bytes = STORE.get(id);
  if (!bytes) throw new ToolError("The opened document has expired. Please open it again.");
  const d = new mupdf.PDFDocument(bytes);
  OPEN.set(id, d);
  while (OPEN.size > 3) { const [k, v] = OPEN.entries().next().value; OPEN.delete(k); v.destroy?.(); }
  return d;
}

export async function runTool(name, { files = [], opts = {}, assets = {} }, progress) {
  const fn = TOOLS[name];
  if (!fn) throw new ToolError(`Unknown tool ${name}`);
  const job = new Job({ files, opts, assets, store: STORE });
  job.progress = progress;
  const t0 = Date.now();
  await fn(job);
  if (job.info) return { info: job.info };
  return { files: job.outputs, message: job.message, seconds: Math.round((Date.now() - t0) / 100) / 10 };
}

const pending = new Map(); // doc id -> {bytes, name} waiting for a password

/** Store a document (any format -> PDF) for the visual tools. */
export async function openDocument({ file, doc: id, password }) {
  let src;
  if (file) { id = newId(); src = file; }
  else if (id && pending.has(id)) src = pending.get(id);
  else throw new ToolError("No file uploaded.");
  let pdf;
  const e = ext(src.name);
  if (IMAGE_EXT.has(e)) pdf = await imagesToPdfDoc([src], { page_size: "fit" });
  else if ([".txt", ".md", ".markdown", ".html", ".htm", ".csv"].includes(e)) pdf = textFileToPdf(src);
  else if (e !== ".pdf" && e !== "") pdf = documentToPdf(src);
  else {
    const doc = openAny(src.bytes, src.name || "file.pdf");
    if (doc.needsPassword() && (!password || !doc.authenticatePassword(password))) {
      pending.set(id, src);
      const err = new ToolError(`'${stem(src.name)}' is password protected. Enter the password to continue.`, "needs_password");
      err.doc = id;
      throw err;
    }
    pdf = doc.isPDF() ? doc.asPDF() : convertToPdf(doc);
  }
  pending.delete(id);
  const bytes = savePdf(pdf, { garbage: 1 });
  STORE.set(id, bytes);
  const d = cachedDoc(id);
  const pages = [];
  let fields = 0;
  for (let i = 0; i < d.countPages(); i++) {
    const p = d.loadPage(i), { W, H } = pageBox(p);
    pages.push({ w: W, h: H });
    fields += p.getWidgets().length;
  }
  return { doc: id, name: src.name || "document.pdf", pages, fields };
}

export function pageImage(id, pno, width) {
  const d = cachedDoc(id);
  const page = d.loadPage(pno);
  const { W } = pageBox(page);
  const z = Math.max(60, Math.min(width, 2400)) / W;
  const pix = page.toPixmap([z, 0, 0, z, 0, 0], mupdf.ColorSpace.DeviceRGB, false, true);
  const data = width > 400 ? new Uint8Array(pix.asJPEG(82, false)) : new Uint8Array(pix.asPNG());
  pix.destroy?.(); page.destroy?.();
  return { data, type: width > 400 ? "image/jpeg" : "image/png" };
}

export const pageLinesFor = (id, pno) => editableLines(STORE.get(id) || cachedDoc(id) && STORE.get(id), pno);
export const fieldsFor = (id) => { if (!STORE.has(id)) throw new ToolError("The opened document has expired. Please open it again."); return formFields(STORE.get(id)); };
export const forget = (id) => { STORE.delete(id); const d = OPEN.get(id); OPEN.delete(id); d?.destroy?.(); };
