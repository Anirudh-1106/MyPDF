// Runs every engine tool on fixtures (Node) and checks the outputs open correctly.
import fs from "node:fs";
import path from "node:path";
import * as mupdf from "mupdf";
import { runTool, openDocument, pageImage, pageLinesFor, fieldsFor, setHost, toolNames } from "../src/engine/index.js";

const FX = path.resolve("fixtures"), OUT = path.resolve("out");
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);
const F = (n) => ({ name: n, bytes: new Uint8Array(fs.readFileSync(path.join(FX, n))) });
const WINF = "C:/Windows/Fonts/";
setHost({
  font: async (k) => { const m = { sans: "arial.ttf", "sans-bold": "arialbd.ttf", serif: "georgia.ttf", script: "segoesc.ttf", hand: "Inkfree.ttf", symbols: "seguisym.ttf" }[k]; return m && fs.existsSync(WINF + m) ? new Uint8Array(fs.readFileSync(WINF + m)) : null; },
  ocr: async (pngBytes, w, h) => [{ text: "Recognised words here", box: [100, 100, 900, 160] }],
  transcode: async (bytes) => bytes,
});

const results = [];
async function run(name, files, opts = {}, assets = {}, check) {
  const t0 = Date.now();
  try {
    const r = await runTool(name, { files, opts, assets });
    const outs = r.files || [];
    for (const o of outs) fs.writeFileSync(path.join(OUT, `${name}__${o.name}`), o.data);
    let note = r.info ? JSON.stringify(r.info).slice(0, 160) : outs.map(o => `${o.name}(${o.data.length})`).join(", ");
    for (const o of outs) if (o.name.endsWith(".pdf")) { const d = mupdf.Document.openDocument(o.data, "application/pdf"); if (!d.needsPassword()) note += ` [${d.countPages()}p]`; }
    if (check) note += " " + (await check(r));
    results.push(["OK ", name, `${Date.now() - t0}ms`, note, r.message || ""]);
    return r;
  } catch (e) {
    results.push(["ERR", name, `${Date.now() - t0}ms`, e.code || "", e.stack?.split("\n").slice(0, 3).join(" | ")]);
  }
}
const pdfText = (bytes, p = 0) => mupdf.Document.openDocument(bytes, "application/pdf").loadPage(p).toStructuredText("").asText();

const S = F("sample.pdf");
await run("merge", [S, F("sample2.pdf"), F("photo.jpg")], { bookmarks: true });
await run("split", [S], { mode: "each" });
await run("split", [S], { mode: "ranges", ranges: "1-2, 3-" });
await run("split", [S], { mode: "size", size_mb: 0.2 });
await run("remove_pages", [S], { pages: "2,4" });
await run("extract_pages", [S], { pages: "1,3", separate: true });
await run("rotate", [S], { angle: 90, pages: "1" });
await run("insert_blank", [S], { after: 1, count: 2 });
await run("reverse", [S]);
await run("crop", [S], { mode: "margins", top: 20, bottom: 20, left: 20, right: 20 });
await run("crop", [S], { mode: "auto", padding: 5 });
await run("nup", [S], { per_sheet: 4, borders: true });
await run("watermark", [S], { kind: "text", text: "CONFIDENTIAL", position: "center", size: 60, angle: 45, color: "#cc1f1f", opacity: 0.3, font: "helv", on_top: true }, {}, r => "text:" + JSON.stringify(pdfText(r.files[0].data, 3).slice(-40)));
await run("watermark", [S], { kind: "image", position: "tile", scale: 20, opacity: 0.5 }, { image: F("logo.png") });
await run("page_numbers", [S], { format: "Page {n} of {total}", position: "bottom-center", size: 11, color: "#000000", font: "helv", start: 1 }, {}, r => JSON.stringify(pdfText(r.files[0].data, 3).slice(-30)));
await run("header_footer", [S], { header: "MyPDF — {date} ✓ नमस्ते", footer: "{file} page {n}/{total}", size: 10, font: "arial" });
await run("bookmarks", [S], { toc: "Intro | 1\n-Sub | 2\nEnd | 5" });
await run("bookmarks", [S], { auto: true });
await run("metadata", [S], { title: "New title", author: "Me" });
await run("metadata", [S], { strip: true });
await run("redact", [S], { terms: "Apple", p_email: true, p_pan: true, p_aadhaar: true, color: "#000000", metadata: true }, {}, r => JSON.stringify(pdfText(r.files[0].data).slice(0, 160)));
await run("protect", [S], { user_password: "pw1", confirm: "pw1", allow_print: true }, {}, r => { const d = mupdf.Document.openDocument(r.files[0].data, "application/pdf"); return `needsPass=${d.needsPassword()} auth=${d.authenticatePassword("pw1")}`; });
await run("unlock", [F("locked.pdf")], { password: "secret" });
await run("unlock", [F("locked.pdf")], { password: "wrong" });
await run("sanitize", [S], { links: true });
await run("compress", [S], { level: "medium" });
await run("compress", [S], { target_kb: 40 });
await run("grayscale", [S], { dpi: 100 });
await run("flatten", [S], {});
await run("flatten", [S], { raster: true });
await run("repair", [S]);
await run("info", [S]);
await run("info", [F("locked.pdf")], { password: "secret" });
await run("compare", [S, F("sample2.pdf")]);
await run("pdf_to_images", [S], { format: "png", dpi: 72, pages: "1-2" });
await run("pdf_to_images", [S], { format: "tiff", dpi: 50, pages: "1" });
await run("pdf_to_long_image", [S], { width: 600 });
await run("pdf_to_word", [S]);
await run("pdf_to_excel", [S]);
await run("pdf_to_pptx", [S], { dpi: 72 });
await run("pdf_to_text", [S], { page_breaks: true });
await run("pdf_to_markdown", [S]);
await run("pdf_to_html", [S]);
await run("pdf_to_epub", [S]);
await run("extract_images", [S], { min_size: 50 });
await run("images_to_pdf", [F("photo.jpg"), F("logo.png")], { page_size: "a4", orientation: "auto", margin: 10 });
await run("to_pdf", [F("doc.docx"), F("sheet.xlsx"), F("slides.pptx"), F("notes.md"), F("plain.txt"), F("data.csv"), S, F("photo.jpg")], { merge: false });
await run("to_pdf", [F("doc.docx"), F("notes.md")], { merge: true });
await run("office_to_pdf", [F("doc.docx")]);
await run("text_to_pdf", [], { text: "# Typed\n\nHello **world**" });
await run("ocr", [S], { output: "both", force: true, pages: "1" }, {}, r => JSON.stringify(pdfText(r.files.find(f => f.name.endsWith(".pdf")).data).slice(0, 200)));
await run("ocr", [F("photo.jpg")], { output: "docx" });
await run("scan", [F("photo.jpg"), F("photo.jpg")], { output: "pdf", page_size: "a4", ocr: true, filename: "Scan test" });

// visual tools
const d = await openDocument({ file: S });
results.push(["OK ", "open", "", JSON.stringify(d).slice(0, 120), ""]);
const th = pageImage(d.doc, 0, 300); fs.writeFileSync(path.join(OUT, "thumb.png"), th.data);
const lines = pageLinesFor(d.doc, 0);
results.push(["OK ", "lines", "", JSON.stringify(lines.slice(0, 2)), ""]);
const fields = fieldsFor(d.doc);
results.push(["OK ", "fields", "", JSON.stringify(fields), ""]);
await run("organize", [], { items: [{ d: d.doc, p: 2, r: 90 }, { blank: true }, { d: d.doc, p: 0, r: 0 }], filename: "org.pdf" });
await run("form_fill", [], { doc: d.doc, values: { [fields[0].key]: "Anirudh", [fields[1].key]: true }, flatten: false }, {}, r => JSON.stringify(mupdf.Document.openDocument(r.files[0].data, "application/pdf").loadPage(0).getWidgets().map(w => w.getValue())));
const L = lines.find(l => l.text.startsWith("Contact"));
await run("edit", [], { doc: d.doc, filename: "edited.pdf", ops: [
  { page: 0, type: "text", text: "Replaced contact line", x: L.x, y: L.y, w: L.w, h: L.h, size: L.size, color: "#1d3fbb", font: "helv", replace: { x: L.x, y: L.y, w: L.w, h: L.h } },
  { page: 0, type: "text", text: "New text नमस्ते ✓", x: 0.1, y: 0.5, w: 0.3, h: 0.03, size: 16, color: "#000000", font: "arial", bold: true },
  { page: 0, type: "whiteout", x: 0.6, y: 0.1, w: 0.2, h: 0.05, color: "#ffffff" },
  { page: 0, type: "highlight", x: 0.1, y: 0.06, w: 0.3, h: 0.03 },
  { page: 0, type: "rect", x: 0.5, y: 0.5, w: 0.2, h: 0.1, color: "#ff0000", stroke: 2, fill: "" },
  { page: 0, type: "ellipse", x: 0.5, y: 0.65, w: 0.2, h: 0.1, color: "#00aa00", stroke: 3, fill: "#00aa00" },
  { page: 0, type: "line", x1: 0.1, y1: 0.8, x2: 0.9, y2: 0.85, x: 0.1, y: 0.8, w: 0.8, h: 0.05, color: "#0000ff", stroke: 2 },
  { page: 0, type: "ink", paths: [[[0.1, 0.9], [0.2, 0.92], [0.3, 0.88]]], x: 0.1, y: 0.88, w: 0.2, h: 0.04, color: "#000000", stroke: 2 },
  { page: 0, type: "check", x: 0.8, y: 0.8, w: 0.04, h: 0.03, color: "#000000" },
  { page: 0, type: "image", asset: "a1", x: 0.6, y: 0.3, w: 0.3, h: 0.15 },
  { page: 0, type: "redact", x: 0.1, y: 0.15, w: 0.4, h: 0.03 },
  { page: 0, type: "link", x: 0.1, y: 0.7, w: 0.2, h: 0.03, url: "https://example.com" },
  { page: 3, type: "text", text: "On rotated page", x: 0.1, y: 0.1, w: 0.3, h: 0.03, size: 14, color: "#ff0000", font: "helv" },
] }, { a1: F("logo.png") }, r => JSON.stringify(pdfText(r.files[0].data).slice(0, 220)));

for (const r of results) console.log(r.join("  "));
const tools = toolNames(), tested = new Set(results.map(r => r[1]));
console.log("\nuntested:", tools.filter(t => !tested.has(t)).join(", ") || "none");
console.log(results.filter(r => r[0] === "ERR").length, "errors");
