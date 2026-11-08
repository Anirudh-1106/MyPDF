"""Document scanner: edge detection, perspective correction and enhancement filters."""
from __future__ import annotations

import io
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from .convert import images_to_pdf_doc, load_image
from .core import ToolError, save_pdf, to_bool, to_int, tool
from .job import Job

MAX_SIDE = 3000


def prepare_upload(src: Path, dst: Path) -> tuple[int, int]:
    """Normalize an uploaded photo (EXIF rotation, size) and store it as JPEG."""
    im = load_image(src).convert("RGB")
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    im.save(dst, "JPEG", quality=92)
    return im.size


def read_bgr(path: Path) -> np.ndarray:
    data = np.fromfile(str(path), dtype=np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if img is None:
        raise ToolError("Could not read the image.")
    return img


def order_points(pts: np.ndarray) -> np.ndarray:
    pts = np.asarray(pts, dtype=np.float32).reshape(4, 2)
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]], dtype=np.float32)


def detect_corners(img: np.ndarray) -> tuple[list[list[float]], bool]:
    """Return normalized [tl, tr, br, bl] corners and whether a document was found."""
    h, w = img.shape[:2]
    scale = min(1.0, 900 / max(h, w))
    small = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else img.copy()
    sh, sw = small.shape[:2]
    min_area = 0.18 * sh * sw
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    closed = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8), iterations=2)

    candidates = []
    edge_maps = [cv2.Canny(closed, lo, hi) for lo, hi in ((20, 60), (40, 120), (75, 200))]
    _, otsu = cv2.threshold(closed, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    edge_maps.append(cv2.Canny(otsu, 50, 150))
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    sat = cv2.GaussianBlur(hsv[:, :, 1], (5, 5), 0)
    edge_maps.append(cv2.Canny(sat, 30, 90))

    for edges in edge_maps:
        edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=2)
        cnts, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for c in sorted(cnts, key=cv2.contourArea, reverse=True)[:6]:
            peri = cv2.arcLength(c, True)
            for eps in (0.02, 0.03, 0.05):
                approx = cv2.approxPolyDP(c, eps * peri, True)
                if len(approx) == 4 and cv2.isContourConvex(approx):
                    area = cv2.contourArea(approx)
                    if min_area < area < 0.98 * sh * sw:
                        candidates.append((area, approx.reshape(4, 2)))
                    break
    if candidates:
        _, best = max(candidates, key=lambda t: t[0])
        pts = order_points(best / scale)
        return [[float(x / w), float(y / h)] for x, y in pts], True
    # fallback: bounding box of the brightest large region
    cnts, _ = cv2.findContours(otsu, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if cnts:
        c = max(cnts, key=cv2.contourArea)
        if cv2.contourArea(c) > min_area:
            box = cv2.boxPoints(cv2.minAreaRect(c))
            pts = order_points(box / scale)
            pts[:, 0] = np.clip(pts[:, 0], 0, w - 1); pts[:, 1] = np.clip(pts[:, 1], 0, h - 1)
            return [[float(x / w), float(y / h)] for x, y in pts], True
    m = 0.03
    return [[m, m], [1 - m, m], [1 - m, 1 - m], [m, 1 - m]], False


def warp(img: np.ndarray, corners_norm) -> np.ndarray:
    h, w = img.shape[:2]
    pts = order_points(np.array([[x * w, y * h] for x, y in corners_norm], dtype=np.float32))
    tl, tr, br, bl = pts
    width = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
    height = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
    width, height = max(width, 10), max(height, 10)
    dst = np.array([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype=np.float32)
    M = cv2.getPerspectiveTransform(pts, dst)
    out = cv2.warpPerspective(img, M, (width, height), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    m = int(min(width, height) * 0.008)  # trim the sliver of background along the edges
    return out[m:height - m, m:width - m] if m and width > 4 * m and height > 4 * m else out


def _normalize_bg(ch: np.ndarray) -> np.ndarray:
    """Divide out the paper's uneven lighting / shadows."""
    k = max(15, (min(ch.shape[:2]) // 40) | 1)
    bg = cv2.morphologyEx(ch, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    bg = cv2.medianBlur(bg, 21)
    norm = cv2.divide(ch, bg, scale=255)
    return norm


def apply_filter(img: np.ndarray, name: str) -> np.ndarray:
    if name == "original":
        return img
    if name == "color":
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        l = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(l)
        out = cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)
        blur = cv2.GaussianBlur(out, (0, 0), 2)
        return cv2.addWeighted(out, 1.4, blur, -0.4, 0)
    if name == "magic":  # clean white paper, keep colours (stamps, signatures)
        chans = [_normalize_bg(c) for c in cv2.split(img)]
        out = cv2.merge(chans)
        return cv2.convertScaleAbs(out, alpha=1.15, beta=-20)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    if name == "gray":
        g = _normalize_bg(gray)
        return cv2.convertScaleAbs(g, alpha=1.2, beta=-25)
    if name == "bw":
        g = _normalize_bg(gray)
        g = cv2.fastNlMeansDenoising(g, None, 7, 7, 21) if g.size < 6_000_000 else g
        bs = max(15, (min(g.shape) // 50) | 1)
        return cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, bs, 12)
    return img


def rotate(img: np.ndarray, deg: int) -> np.ndarray:
    deg %= 360
    if deg == 90:
        return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    if deg == 180:
        return cv2.rotate(img, cv2.ROTATE_180)
    if deg == 270:
        return cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return img


def process(path: Path, corners, filt: str, rot: int = 0, crop: bool = True) -> np.ndarray:
    img = read_bgr(path)
    if crop and corners:
        img = warp(img, corners)
    img = apply_filter(img, filt)
    return rotate(img, rot)


def to_pil(img: np.ndarray, filt: str) -> Image.Image:
    if img.ndim == 2:
        im = Image.fromarray(img)
        return im.convert("1") if filt == "bw" else im
    return Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))


def preview_jpeg(path: Path, corners, filt: str, rot: int, max_side=900) -> bytes:
    img = read_bgr(path)
    s = min(1.0, 1600 / max(img.shape[:2]))
    if s < 1:
        img = cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    out = warp(img, corners) if corners else img
    out = rotate(apply_filter(out, filt), rot)
    s = min(1.0, max_side / max(out.shape[:2]))
    if s < 1:
        out = cv2.resize(out, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return buf.tobytes()


@tool("scan")
def scan(job: Job):
    """pages: [{id, corners, rotate, filter?}] -> PDF (optionally OCR'd) or images."""
    pages = job.opts.get("pages") or []
    if not pages:
        raise ToolError("Add at least one photo.")
    default_filter = job.opts.get("filter", "magic")
    tmp_paths = []
    for k, pg in enumerate(pages):
        src = job.doc_path(pg["id"])
        filt = pg.get("filter") or default_filter
        img = process(src, pg.get("corners"), filt, to_int(pg.get("rotate"), 0), crop=pg.get("crop", True))
        im = to_pil(img, filt)
        p = job.out_dir / f"_scan_{k:03d}.{'png' if filt == 'bw' else 'jpg'}"
        if filt == "bw":
            im.save(p, "PNG", optimize=True)
        else:
            im.save(p, "JPEG", quality=to_int(job.opts.get("quality"), 82), optimize=True)
        tmp_paths.append(p)
    name = (job.opts.get("filename") or "Scan").removesuffix(".pdf")
    if job.opts.get("output") == "images":
        outs = []
        for k, p in enumerate(tmp_paths):
            final = job.out(f"{name}_{k + 1}{p.suffix}")
            p.rename(final)
            outs.append(final)
        return outs
    doc = images_to_pdf_doc(tmp_paths, {"page_size": job.opts.get("page_size", "a4"), "margin": 0, "quality": 85})
    if to_bool(job.opts.get("ocr")):
        from .ocr import make_searchable
        make_searchable(doc, force=True)
        job.message = "Text recognised - the PDF is searchable."
    out = save_pdf(doc, job.out(f"{name}.pdf"), subset=True)
    for p in tmp_paths:
        p.unlink(missing_ok=True)
    return [out]


_ = io
