import fs from "node:fs"; import * as mupdf from "mupdf";
// usage: node sheet.mjs out.png file:page file:page ...
const [,, out, ...items] = process.argv;
const W = 300, pix = [];
for (const it of items) {
  const [f, p] = it.split(":");
  const d = mupdf.Document.openDocument(fs.readFileSync(f), "application/pdf");
  const pg = d.loadPage(+p || 0); const b = pg.getBounds(); const z = W / (b[2]-b[0]);
  pix.push(pg.toPixmap([z,0,0,z,0,0], mupdf.ColorSpace.DeviceRGB, false, true));
}
const H = Math.max(...pix.map(p => p.getHeight()));
const sheet = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0,0,(W+10)*pix.length, H], false); sheet.clear(128);
const S = sheet.getPixels(), ss = sheet.getStride();
pix.forEach((p, k) => { const P = p.getPixels(), ps = p.getStride(); for (let y=0;y<p.getHeight();y++) for (let x=0;x<p.getWidth()*3;x++) S[y*ss + k*(W+10)*3 + x] = P[y*ps + x]; });
fs.writeFileSync(out, sheet.asPNG());
