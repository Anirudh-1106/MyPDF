// Document scanner on OpenCV.js (port of mypdf/scanner.py). Works in a worker and in Node (for tests).
// All functions take/return cv.Mat in RGB(A) order and free their temporaries.
/* global cv */
(function (root) {
  const keep = [];
  const track = (m) => { keep.push(m); return m; };
  const free = () => { while (keep.length) { const m = keep.pop(); try { if (!m.isDeleted?.()) m.delete(); } catch { /* already freed */ } } };

  function orderPoints(pts) { // [[x,y]x4] -> tl, tr, br, bl
    const s = pts.map(p => p[0] + p[1]), d = pts.map(p => p[1] - p[0]);
    const at = (arr, fn) => pts[arr.indexOf(fn(...arr))];
    return [at(s, Math.min), at(d, Math.min), at(s, Math.max), at(d, Math.max)];
  }
  const matPts = (m) => { const a = []; for (let i = 0; i < m.rows; i++) a.push([m.data32S[i * 2], m.data32S[i * 2 + 1]]); return a; };

  /** rgba Mat -> {corners: [[x,y] normalized] (tl,tr,br,bl), found} */
  function detectCorners(src) {
    const h = src.rows, w = src.cols;
    const scale = Math.min(1, 900 / Math.max(h, w));
    try {
      const small = track(new cv.Mat());
      if (scale < 1) cv.resize(src, small, new cv.Size(Math.round(w * scale), Math.round(h * scale)), 0, 0, cv.INTER_AREA); else src.copyTo(small);
      const sh = small.rows, sw = small.cols, minArea = 0.18 * sh * sw;
      const rgb = track(new cv.Mat()); cv.cvtColor(small, rgb, cv.COLOR_RGBA2RGB);
      const gray = track(new cv.Mat()); cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
      cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
      const closed = track(new cv.Mat());
      const k9 = track(cv.Mat.ones(9, 9, cv.CV_8U));
      cv.morphologyEx(gray, closed, cv.MORPH_CLOSE, k9, new cv.Point(-1, -1), 2);
      const maps = [];
      for (const [lo, hi] of [[20, 60], [40, 120], [75, 200]]) { const e = track(new cv.Mat()); cv.Canny(closed, e, lo, hi); maps.push(e); }
      const otsu = track(new cv.Mat()); cv.threshold(closed, otsu, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
      const eo = track(new cv.Mat()); cv.Canny(otsu, eo, 50, 150); maps.push(eo);
      const hsv = track(new cv.Mat()); cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
      const ch = track(new cv.MatVector()); cv.split(hsv, ch);
      const sat = track(ch.get(1)); cv.GaussianBlur(sat, sat, new cv.Size(5, 5), 0);
      const es = track(new cv.Mat()); cv.Canny(sat, es, 30, 90); maps.push(es);
      const k3 = track(cv.Mat.ones(3, 3, cv.CV_8U));
      let best = null;
      for (const edges of maps) {
        cv.dilate(edges, edges, k3, new cv.Point(-1, -1), 2);
        const cnts = track(new cv.MatVector()), hier = track(new cv.Mat());
        cv.findContours(edges, cnts, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
        const list = [];
        for (let i = 0; i < cnts.size(); i++) { const c = track(cnts.get(i)); list.push([cv.contourArea(c), c]); }
        list.sort((a, b) => b[0] - a[0]);
        for (const [, c] of list.slice(0, 6)) {
          const peri = cv.arcLength(c, true);
          for (const eps of [0.02, 0.03, 0.05]) {
            const approx = track(new cv.Mat());
            cv.approxPolyDP(c, approx, eps * peri, true);
            if (approx.rows === 4 && cv.isContourConvex(approx)) {
              const area = cv.contourArea(approx);
              if (area > minArea && area < 0.98 * sh * sw && (!best || area > best.area)) best = { area, pts: matPts(approx) };
              break;
            }
          }
        }
      }
      if (best) return { corners: orderPoints(best.pts.map(([x, y]) => [x / scale / w, y / scale / h])), found: true };
      // fallback: rotated bounding box of the brightest large region
      const cnts = track(new cv.MatVector()), hier = track(new cv.Mat());
      cv.findContours(otsu, cnts, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      let big = null, bigA = 0;
      for (let i = 0; i < cnts.size(); i++) { const c = track(cnts.get(i)); const a = cv.contourArea(c); if (a > bigA) { bigA = a; big = c; } }
      if (big && bigA > minArea) {
        const pts = cv.RotatedRect.points(cv.minAreaRect(big)).map(p => [Math.min(1, Math.max(0, p.x / scale / w)), Math.min(1, Math.max(0, p.y / scale / h))]);
        return { corners: orderPoints(pts), found: true };
      }
      const m = 0.03;
      return { corners: [[m, m], [1 - m, m], [1 - m, 1 - m], [m, 1 - m]], found: false };
    } finally { free(); }
  }

  /** Perspective-correct `src` (RGBA) to the quad; returns a new Mat. */
  function warp(src, cornersNorm) {
    const h = src.rows, w = src.cols;
    const [tl, tr, br, bl] = orderPoints(cornersNorm.map(([x, y]) => [x * w, y * h]));
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const W = Math.max(10, Math.round(Math.max(dist(br, bl), dist(tr, tl))));
    const H = Math.max(10, Math.round(Math.max(dist(tr, br), dist(tl, bl))));
    const from = cv.matFromArray(4, 1, cv.CV_32FC2, [...tl, ...tr, ...br, ...bl]);
    const to = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, W - 1, 0, W - 1, H - 1, 0, H - 1]);
    const M = cv.getPerspectiveTransform(from, to);
    const out = new cv.Mat();
    cv.warpPerspective(src, out, M, new cv.Size(W, H), cv.INTER_CUBIC, cv.BORDER_REPLICATE, new cv.Scalar());
    from.delete(); to.delete(); M.delete();
    const m = Math.floor(Math.min(W, H) * 0.008); // trim the sliver of background along the edges
    if (m && W > 4 * m && H > 4 * m) { const roi = out.roi(new cv.Rect(m, m, W - 2 * m, H - 2 * m)); const c = roi.clone(); roi.delete(); out.delete(); return c; }
    return out;
  }

  function normalizeBg(ch) { // divide out uneven lighting / shadows (in place)
    let k = Math.max(15, Math.floor(Math.min(ch.rows, ch.cols) / 40) | 1);
    const bg = new cv.Mat();
    const se = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(k, k));
    cv.morphologyEx(ch, bg, cv.MORPH_CLOSE, se);
    cv.medianBlur(bg, bg, 21);
    cv.divide(ch, bg, ch, 255);
    bg.delete(); se.delete();
  }

  /** RGBA in -> RGBA (or single-channel for gray/bw) out; returns a new Mat. */
  function applyFilter(src, name) {
    const rgb = new cv.Mat(); cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    if (name === "original") return rgb;
    if (name === "color") {
      const lab = new cv.Mat(); cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);
      const ch = new cv.MatVector(); cv.split(lab, ch);
      const l = ch.get(0); const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8)); clahe.apply(l, l); clahe.delete();
      ch.set(0, l); l.delete();
      cv.merge(ch, lab); ch.delete();
      const out = new cv.Mat(); cv.cvtColor(lab, out, cv.COLOR_Lab2RGB); lab.delete();
      const blur = new cv.Mat(); cv.GaussianBlur(out, blur, new cv.Size(0, 0), 2);
      cv.addWeighted(out, 1.4, blur, -0.4, 0, out); blur.delete(); rgb.delete();
      return out;
    }
    if (name === "magic") {
      const ch = new cv.MatVector(); cv.split(rgb, ch);
      for (let i = 0; i < 3; i++) { const c = ch.get(i); normalizeBg(c); ch.set(i, c); c.delete(); }
      const out = new cv.Mat(); cv.merge(ch, out); ch.delete(); rgb.delete();
      cv.convertScaleAbs(out, out, 1.15, -20);
      return out;
    }
    const g = new cv.Mat(); cv.cvtColor(rgb, g, cv.COLOR_RGB2GRAY); rgb.delete();
    normalizeBg(g);
    if (name === "gray") { cv.convertScaleAbs(g, g, 1.2, -25); return g; }
    if (name === "bw") {
      cv.medianBlur(g, g, 3);
      const bs = Math.max(15, Math.floor(Math.min(g.rows, g.cols) / 50) | 1);
      cv.adaptiveThreshold(g, g, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, bs, 12);
      return g;
    }
    return g;
  }

  function rotate(src, deg) {
    deg = ((deg % 360) + 360) % 360;
    if (!deg) return src;
    const out = new cv.Mat();
    cv.rotate(src, out, deg === 90 ? cv.ROTATE_90_CLOCKWISE : deg === 180 ? cv.ROTATE_180 : cv.ROTATE_90_COUNTERCLOCKWISE);
    src.delete();
    return out;
  }

  function resizeMax(src, max) {
    const s = Math.min(1, max / Math.max(src.rows, src.cols));
    if (s >= 1) return src;
    const out = new cv.Mat();
    cv.resize(src, out, new cv.Size(Math.round(src.cols * s), Math.round(src.rows * s)), 0, 0, cv.INTER_AREA);
    src.delete();
    return out;
  }

  /** Full pipeline: crop (warp) -> filter -> rotate. Input RGBA Mat (kept); output new Mat (RGB or gray). */
  function process(src, corners, filter, rot, crop = true, maxSide = 0) {
    let img = crop && corners ? warp(src, corners) : src.clone();
    if (maxSide) img = resizeMax(img, maxSide);
    const f = applyFilter(img, filter || "magic");
    img.delete();
    return rotate(f, rot || 0);
  }

  /** Mat (RGB / gray) -> RGBA ImageData-like {data, width, height} */
  function toRGBA(m) {
    const out = new cv.Mat();
    cv.cvtColor(m, out, m.channels() === 1 ? cv.COLOR_GRAY2RGBA : cv.COLOR_RGB2RGBA);
    const res = { data: new Uint8ClampedArray(out.data), width: out.cols, height: out.rows };
    out.delete();
    return res;
  }

  root.Scanner = { detectCorners, warp, applyFilter, process, resizeMax, toRGBA };
})(typeof self !== "undefined" ? self : globalThis);
