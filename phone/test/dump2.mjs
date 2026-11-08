import fs from "node:fs"; import * as mupdf from "mupdf";
const d = new mupdf.PDFDocument(fs.readFileSync("out/edit__edited.pdf"));
const o = d.loadPage(0).getObject();
const x = o.get("Resources").get("XObject").get("MyP0");
console.log("isStream", x.isStream(), "resolved", x.resolve().isStream());
console.log(x.resolve().toString().slice(0, 400));
try { console.log("STREAM:", JSON.stringify(x.readStream().asString().slice(0, 300))); } catch (e) { console.log("readStream err", e.message); }
const c = o.get("Contents").get(1); console.log("orig content isStream", c.isStream(), c.isIndirect());
