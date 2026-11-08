import fs from "node:fs"; import * as mupdf from "mupdf";
const [,, file, pno = "0", out = "r.png"] = process.argv;
const d = mupdf.Document.openDocument(fs.readFileSync(file), "application/pdf");
const p = d.loadPage(+pno);
fs.writeFileSync(out, p.toPixmap([0.8,0,0,0.8,0,0], mupdf.ColorSpace.DeviceRGB, false, true).asPNG());
const o = p.getObject();
console.log(o.get("Contents").toString().slice(0,200));
console.log(o.get("Resources").toString().slice(0,300));
