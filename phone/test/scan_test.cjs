const fs = require("fs");
const cvp = require("@techstark/opencv-js");
global.self = global;
(async () => {
  const cv = await (cvp instanceof Promise ? cvp : new Promise(r => { cvp.onRuntimeInitialized = () => r(cvp); if (cvp.Mat) r(cvp); }));
  global.cv = cv;
  require("../src/scanner-core.js");
  const mupdf = await import("mupdf");
  const img = new mupdf.Image(fs.readFileSync("fixtures/docphoto.jpg"));
  const pix = img.toPixmap(); const w = pix.getWidth(), h = pix.getHeight(), n = pix.getNumberOfComponents(), s = pix.getStride(), px = pix.getPixels();
  const rgba = new Uint8Array(w*h*4); for (let y=0;y<h;y++) for (let x=0;x<w;x++){ for(let c=0;c<3;c++) rgba[(y*w+x)*4+c]=px[y*s+x*n+c]; rgba[(y*w+x)*4+3]=255; }
  const src = cv.matFromArray(h, w, cv.CV_8UC4, rgba);
  let t = Date.now();
  const det = Scanner.detectCorners(src);
  console.log("detect", Date.now()-t, "ms", JSON.stringify(det.corners.map(p => [Math.round(p[0]*w), Math.round(p[1]*h)])), det.found);
  for (const f of ["magic", "color", "gray", "bw", "original"]) {
    t = Date.now();
    const out = Scanner.process(src, det.corners, f, f === "bw" ? 90 : 0, true, 1200);
    const r = Scanner.toRGBA(out); out.delete();
    const p2 = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0,0,r.width,r.height], false); const P = p2.getPixels(), ps = p2.getStride();
    for (let y=0;y<r.height;y++) for (let x=0;x<r.width;x++) for (let c=0;c<3;c++) P[y*ps+x*3+c] = r.data[(y*r.width+x)*4+c];
    fs.writeFileSync(`../scratch/scan_${f}.png`, p2.asPNG());
    console.log(f, Date.now()-t, "ms", r.width, "x", r.height);
  }
})();
