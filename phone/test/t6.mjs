import fs from "node:fs";
import * as mupdf from "mupdf";
import { overlay, rectPath, RGB } from "../src/engine/core.js";
for (const opts of ["garbage=2", "garbage=4", "TWOPASS"]) {
  const doc = new mupdf.PDFDocument(fs.readFileSync("fixtures/sample.pdf"));
  const page = doc.loadPage(0);
  overlay(doc, page, (dev) => dev.fillPath(rectPath([10,10,200,200]), false, mupdf.Matrix.identity, RGB(), [1,0,0], 1));
  let b = doc.saveToBuffer(opts === "TWOPASS" ? "" : opts); if (opts === "TWOPASS") b = new mupdf.PDFDocument(b).saveToBuffer("garbage=4,compress");
  const d2 = new mupdf.PDFDocument(b);
  const x2 = d2.loadPage(0).getObject().get("Resources").get("XObject").get("MyP0");
  console.log(JSON.stringify(opts), "saved isStream", x2.isStream());
}
