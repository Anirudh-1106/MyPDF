import fs from "node:fs"; import * as mupdf from "mupdf";
for (const pno of [0, 3]) {
  const d = new mupdf.PDFDocument(fs.readFileSync("fixtures/sample.pdf"));
  const p = d.loadPage(pno);
  console.log("bounds before", p.getBounds(), "rot", p.getObject().getInheritable("Rotate").toString());
  const b = p.getBounds();
  p.setPageBox("CropBox", [b[0]+50, b[1]+100, b[2]-50, b[3]-100]); // visual coords
  const p2 = d.loadPage(pno);
  console.log("bounds after", p2.getBounds(), "CropBox", p2.getObject().get("CropBox").toString());
}
