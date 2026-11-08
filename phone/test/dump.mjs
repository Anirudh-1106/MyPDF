import fs from "node:fs"; import * as mupdf from "mupdf";
const [,, file, pno = "0"] = process.argv;
const d = new mupdf.PDFDocument(fs.readFileSync(file));
const p = d.loadPage(+pno), o = p.getObject();
const c = o.get("Contents"); const items=[]; c.forEach(v=>items.push(v));
const last = items[items.length-1]; console.log("LAST:", last.readStream().asString());
const xo = o.get("Resources").get("XObject"); xo.forEach((v,k)=>{ console.log(k, v.toString().slice(0,300)); console.log("STREAM:", v.readStream().asString().slice(0,400)); });
