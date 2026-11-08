"""OCR using RapidOCR (ONNX models bundled with the pip package - no Tesseract needed)."""
from __future__ import annotations

import threading
from pathlib import Path

import numpy as np
import pymupdf as fitz

from .core import IMAGE_EXT, ToolError, ext, open_pdf, parse_pages, pdf_point, resolve_font, save_pdf, stem, to_bool, to_int, tool
from .job import Job

_engine = None
_lock = threading.Lock()


def engine():
    global _engine
    with _lock:
        if _engine is None:
            from rapidocr_onnxruntime import RapidOCR
            _engine = RapidOCR()
        return _engine


def ocr_array(rgb: np.ndarray):
    """Returns list of (box[4][2], text, score)."""
    result, _ = engine()(rgb)
    return result or []


def _page_rgb(page: fitz.Page, dpi: int):
    pix = page.get_pixmap(dpi=dpi, alpha=False, colorspace=fitz.csRGB)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    return arr, page.rect.width / pix.width


def ocr_page_lines(page: fitz.Page, dpi: int = 200):
    arr, scale = _page_rgb(page, dpi)
    lines = []
    for box, text, score in ocr_array(arr):
        if not text.strip() or score < 0.4:
            continue
        xs = [p[0] * scale for p in box]
        ys = [p[1] * scale for p in box]
        lines.append((fitz.Rect(min(xs), min(ys), max(xs), max(ys)), text))
    lines.sort(key=lambda t: (round(t[0].y0 / 8), t[0].x0))
    return lines


def add_text_layer(page: fitz.Page, lines):
    """Invisible text over the page so it becomes searchable / copyable."""
    for r, text in lines:
        kw = resolve_font("helv", False, text)
        fo = fitz.Font(fontfile=kw["fontfile"]) if "fontfile" in kw else fitz.Font(kw["fontname"])
        size = max(4.0, r.height * 0.85)
        tl = fo.text_length(text, fontsize=size) or 1
        base = pdf_point(page, (r.x0, r.y1 - r.height * 0.18))
        if page.rotation == 0:
            sx = r.width / tl
            page.insert_text(base, text, fontsize=size, render_mode=3,
                             morph=(base, fitz.Matrix(sx, 1)), **kw)
        else:
            page.insert_text(base, text, fontsize=min(size, size * r.width / tl), render_mode=3,
                             rotate=page.rotation, **kw)


def lines_to_text(lines) -> str:
    out, last_y = [], None
    for r, t in lines:
        if last_y is not None and abs(r.y0 - last_y) < r.height * 0.5:
            out[-1] += "  " + t
        else:
            out.append(t)
        last_y = r.y0
    return "\n".join(out)


def make_searchable(doc: fitz.Document, pages=None, force=False, dpi=200) -> tuple[int, str]:
    done, texts = 0, []
    for i in pages if pages is not None else range(doc.page_count):
        page = doc[i]
        if not force and page.get_text().strip():
            texts.append(page.get_text("text", sort=True))
            continue
        lines = ocr_page_lines(page, dpi)
        add_text_layer(page, lines)
        texts.append(lines_to_text(lines))
        done += 1
    return done, "\n\n".join(texts)


@tool("ocr")
def ocr(job: Job):
    from .convert import images_to_pdf_doc
    outs = []
    fmt = job.opts.get("output", "pdf")
    for f in job.require(1):
        if ext(f) in IMAGE_EXT:
            doc = images_to_pdf_doc([f], {})
        else:
            doc = open_pdf(f, job.password)
        pages = parse_pages(job.opts.get("pages"), doc.page_count)
        done, text = make_searchable(doc, pages, force=to_bool(job.opts.get("force")),
                                     dpi=to_int(job.opts.get("dpi"), 200))
        if fmt in ("txt", "both"):
            p = job.out(f"{stem(f)}_ocr.txt")
            p.write_text(text, encoding="utf-8")
            outs.append(p)
        if fmt in ("pdf", "both"):
            outs.append(save_pdf(doc, job.out(f"{stem(f)}_searchable.pdf"), subset=True))
        if fmt == "docx":
            import docx
            d = docx.Document()
            for para in text.split("\n"):
                d.add_paragraph(para)
            p = job.out(f"{stem(f)}_ocr.docx")
            d.save(p)
            outs.append(p)
        job.message = f"Recognised text on {done} page(s)." if done else \
            "These pages already had text. Tick 'Force OCR' to redo them."
    return outs


def ocr_image_text(path: Path) -> str:
    from .convert import load_image
    im = load_image(path).convert("RGB")
    res = ocr_array(np.array(im))
    lines = []
    for box, text, score in res:
        xs = [p[0] for p in box]; ys = [p[1] for p in box]
        lines.append((fitz.Rect(min(xs), min(ys), max(xs), max(ys)), text))
    lines.sort(key=lambda t: (round(t[0].y0 / 10), t[0].x0))
    return lines_to_text(lines)


_ = ToolError
