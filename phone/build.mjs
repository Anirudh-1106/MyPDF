// Builds the offline web app bundled inside the Android APK:  node phone/build.mjs [outDir]
// static/ (shared UI) + phone/src (on-device engine) + MuPDF.js + OpenCV.js  ->  android/app/src/main/assets/www
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "android/app/src/main/assets/www"));
const NM = path.join(HERE, "node_modules");

if (fs.existsSync(OUT)) for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "local/engine"), { recursive: true });
const cp = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };

// shared UI
for (const f of ["app.js", "style.css", "manifest.webmanifest"]) cp(path.join(ROOT, "static", f), path.join(OUT, f));
for (const f of fs.readdirSync(path.join(ROOT, "static/icons"))) cp(path.join(ROOT, "static/icons", f), path.join(OUT, "icons", f));
let html = fs.readFileSync(path.join(ROOT, "static/index.html"), "utf8");
html = html.replace('<script src="app.js"></script>', '<script src="local/local.js"></script>\n  <script src="app.js"></script>');
html = html.replace('<link rel="manifest" href="manifest.webmanifest">', "");
fs.writeFileSync(path.join(OUT, "index.html"), html);

// on-device engine
for (const f of ["local.js", "engine-worker.js", "cv-worker.js", "scanner-core.js"]) cp(path.join(HERE, "src", f), path.join(OUT, "local", f));
for (const f of fs.readdirSync(path.join(HERE, "src/engine"))) if (f !== "mupdf.js") cp(path.join(HERE, "src/engine", f), path.join(OUT, "local/engine", f));
for (const f of ["mupdf.js", "mupdf-wasm.js", "mupdf-wasm.wasm"]) cp(path.join(NM, "mupdf/dist", f), path.join(OUT, "local/engine", f));
cp(path.join(NM, "@techstark/opencv-js/dist/opencv.js"), path.join(OUT, "local/opencv.js"));

let total = 0;
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else total += fs.statSync(p).size; } };
walk(OUT);
console.log(`Built ${OUT} (${(total / 1048576).toFixed(1)} MB)`);
