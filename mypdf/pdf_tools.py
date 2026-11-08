"""Organize / edit / security / optimize tools."""
from __future__ import annotations

import base64
import datetime as dt
import difflib
import html
import io
import json
import re
from pathlib import Path

import numpy as np
import pymupdf as fitz
from PIL import Image

from .core import (IMAGE_EXT, ToolError, ext, font_object, hex_color, human_size, open_pdf,
                   parse_pages, pdf_point, pdf_rect, resolve_font, save_pdf, stem, to_bool,
                   to_float, to_int, tool, visual_rect)
from .job import Job

MM = 72 / 25.4


def _image_as_pdf(path: Path) -> fitz.Document:
    from .convert import images_to_pdf_doc
    return images_to_pdf_doc([path], {})


def _load_any(path: Path, password=None) -> fitz.Document:
    if ext(path) in IMAGE_EXT:
        return _image_as_pdf(path)
    return open_pdf(path, password)


# =================================================================== ORGANIZE
@tool("merge")
def merge(job: Job):
    files = job.require(2) if len(job.files) != 1 else job.files
    out = fitz.open()
    toc = []
    for f in files:
        src = _load_any(f, job.password)
        toc.append([1, stem(f), out.page_count + 1])
        out.insert_pdf(src)
        src.close()
    if to_bool(job.opts.get("bookmarks", True)):
        out.set_toc(toc)
    name = job.opts.get("filename") or "merged.pdf"
    return [save_pdf(out, job.out(name if name.endswith(".pdf") else name + ".pdf"))]


def _write_range(src, pages, path):
    d = fitz.open()
    for p in pages:
        d.insert_pdf(src, from_page=p, to_page=p)
    return save_pdf(d, path)


@tool("split")
def split(job: Job):
    f = job.first()
    src = open_pdf(f, job.password)
    n = src.page_count
    mode = job.opts.get("mode", "each")
    groups: list[list[int]] = []
    if mode == "each":
        groups = [[i] for i in range(n)]
    elif mode == "every":
        k = max(1, to_int(job.opts.get("every"), 1))
        groups = [list(range(i, min(i + k, n))) for i in range(0, n, k)]
    elif mode == "ranges":
        spec = job.opts.get("ranges", "")
        parts = [p for p in re.split(r"[;,]", spec) if p.strip()]
        if not parts:
            raise ToolError("Enter ranges like 1-3, 4-6, 7-")
        groups = [parse_pages(p, n) for p in parts]
    elif mode == "half":
        h = (n + 1) // 2
        groups = [list(range(0, h)), list(range(h, n))]
    elif mode == "size":
        limit = to_float(job.opts.get("size_mb"), 5) * 1024 * 1024
        cur: list[int] = []
        for i in range(n):
            trial = cur + [i]
            d = fitz.open(); [d.insert_pdf(src, from_page=p, to_page=p) for p in trial]
            size = len(d.tobytes(garbage=3, deflate=True))
            if size > limit and cur:
                groups.append(cur); cur = [i]
            else:
                cur = trial
        if cur:
            groups.append(cur)
    outs = []
    for g in groups:
        if not g:
            continue
        label = f"{g[0] + 1}" if len(g) == 1 else f"{g[0] + 1}-{g[-1] + 1}"
        outs.append(_write_range(src, g, job.out(f"{stem(f)}_p{label}.pdf")))
    job.message = f"Split into {len(outs)} files."
    return outs


@tool("remove_pages")
def remove_pages(job: Job):
    f = job.first()
    doc = open_pdf(f, job.password)
    pages = sorted(set(parse_pages(job.opts.get("pages"), doc.page_count, default_all=False)))
    if len(pages) >= doc.page_count:
        raise ToolError("You can't remove every page.")
    doc.delete_pages(pages)
    job.message = f"Removed {len(pages)} page(s); {doc.page_count} left."
    return [save_pdf(doc, job.out(f"{stem(f)}_edited.pdf"))]


@tool("extract_pages")
def extract_pages(job: Job):
    f = job.first()
    doc = open_pdf(f, job.password)
    pages = parse_pages(job.opts.get("pages"), doc.page_count, default_all=False)
    if to_bool(job.opts.get("separate")):
        return [_write_range(doc, [p], job.out(f"{stem(f)}_p{p + 1}.pdf")) for p in pages]
    return [_write_range(doc, pages, job.out(f"{stem(f)}_extract.pdf"))]


@tool("organize")
def organize(job: Job):
    """Visual organizer: items = [{d: doc_id, p: page, r: extra_rotation} | {blank: true}]"""
    items = job.opts.get("items") or []
    if not items:
        raise ToolError("No pages left - add at least one page.")
    srcs: dict[str, fitz.Document] = {}
    out = fitz.open()
    last_size = fitz.paper_rect("a4")
    for it in items:
        if it.get("blank"):
            out.new_page(width=last_size.width, height=last_size.height)
            continue
        d = it["d"]
        if d not in srcs:
            srcs[d] = fitz.open(job.doc_path(d))
        src = srcs[d]
        p = int(it["p"])
        out.insert_pdf(src, from_page=p, to_page=p)
        page = out[-1]
        rot = int(it.get("r", 0)) % 360
        if rot:
            page.set_rotation((page.rotation + rot) % 360)
        last_size = page.rect
    name = job.opts.get("filename") or "organized.pdf"
    return [save_pdf(out, job.out(name if name.endswith(".pdf") else name + ".pdf"))]


@tool("rotate")
def rotate(job: Job):
    outs = []
    angle = to_int(job.opts.get("angle"), 90)
    for f in job.require(1):
        doc = open_pdf(f, job.password)
        for i in parse_pages(job.opts.get("pages"), doc.page_count):
            pg = doc[i]
            pg.set_rotation((pg.rotation + angle) % 360)
        outs.append(save_pdf(doc, job.out(f"{stem(f)}_rotated.pdf")))
    return outs


@tool("insert_blank")
def insert_blank(job: Job):
    f = job.first()
    doc = open_pdf(f, job.password)
    after = to_int(job.opts.get("after"), doc.page_count)
    count = max(1, to_int(job.opts.get("count"), 1))
    after = max(0, min(after, doc.page_count))
    ref = doc[max(0, after - 1)].rect if doc.page_count else fitz.paper_rect("a4")
    for k in range(count):
        doc.new_page(pno=after + k, width=ref.width, height=ref.height)
    return [save_pdf(doc, job.out(f"{stem(f)}_blank.pdf"))]


@tool("reverse")
def reverse(job: Job):
    f = job.first()
    doc = open_pdf(f, job.password)
    doc.select(list(range(doc.page_count - 1, -1, -1)))
    return [save_pdf(doc, job.out(f"{stem(f)}_reversed.pdf"))]


def _content_bbox(page: fitz.Page) -> fitz.Rect | None:
    pix = page.get_pixmap(dpi=50, colorspace=fitz.csGRAY)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)
    ys, xs = np.where(arr < 245)
    if len(xs) == 0:
        return None
    sx, sy = page.rect.width / pix.width, page.rect.height / pix.height
    return fitz.Rect(xs.min() * sx, ys.min() * sy, (xs.max() + 1) * sx, (ys.max() + 1) * sy)


@tool("crop")
def crop(job: Job):
    f = job.first()
    doc = open_pdf(f, job.password)
    mode = job.opts.get("mode", "margins")
    t, r, b, l = (to_float(job.opts.get(k), 0) * MM for k in ("top", "right", "bottom", "left"))
    pad = to_float(job.opts.get("padding"), 5) * MM
    for i in parse_pages(job.opts.get("pages"), doc.page_count):
        page = doc[i]
        vis = page.rect  # what the user sees
        if mode == "auto":
            bb = _content_bbox(page)
            if not bb:
                continue
            new_vis = fitz.Rect(bb.x0 - pad, bb.y0 - pad, bb.x1 + pad, bb.y1 + pad) & vis
        else:
            new_vis = fitz.Rect(vis.x0 + l, vis.y0 + t, vis.x1 - r, vis.y1 - b)
        if new_vis.is_empty or new_vis.width < 10 or new_vis.height < 10:
            raise ToolError("Margins are too large - nothing would be left of the page.")
        unrot = pdf_rect(page, new_vis)
        cb = page.cropbox
        page.set_cropbox(fitz.Rect(unrot.x0 + cb.x0, unrot.y0 + cb.y0, unrot.x1 + cb.x0, unrot.y1 + cb.y0) & page.mediabox)
    return [save_pdf(doc, job.out(f"{stem(f)}_cropped.pdf"))]


@tool("nup")
def nup(job: Job):
    f = job.first()
    src = open_pdf(f, job.password)
    per = to_int(job.opts.get("per_sheet"), 2)
    layouts = {2: (2, 1, True), 4: (2, 2, False), 6: (2, 3, False), 8: (2, 4, True), 9: (3, 3, False)}
    cols, rows, landscape = layouts.get(per, (2, 1, True))
    if landscape:
        cols, rows = max(cols, rows), min(cols, rows)
    sheet = fitz.paper_rect("a4-l" if landscape else "a4")
    out = fitz.open()
    cw, ch = sheet.width / cols, sheet.height / rows
    for i in range(src.page_count):
        k = i % (cols * rows)
        if k == 0:
            pg = out.new_page(width=sheet.width, height=sheet.height)
        c, rw = k % cols, k // cols
        cell = fitz.Rect(c * cw, rw * ch, (c + 1) * cw, (rw + 1) * ch) + (6, 6, -6, -6)
        pg.show_pdf_page(cell, src, i)
        if to_bool(job.opts.get("borders")):
            pg.draw_rect(cell, color=(0.7, 0.7, 0.7), width=0.5)
    return [save_pdf(out, job.out(f"{stem(f)}_{per}up.pdf"))]


# =================================================================== EDIT
def _place_text(page: fitz.Page, vis_point, text: str, size: float, color, font: str, bold: bool,
                opacity: float = 1.0, line_height: float = 1.2, align: str = "left", width: float = 0):
    kw = resolve_font(font, bold, text)
    fo = font_object(kw)
    x0, y = vis_point
    for line in text.split("\n"):
        y += size  # baseline
        x = x0
        if align != "left" and width:
            lw = fo.text_length(line, fontsize=size)
            x = x0 + (width - lw) / (2 if align == "center" else 1)
        if line.strip():
            page.insert_text(pdf_point(page, (x, y)), line, fontsize=size, color=color,
                             rotate=page.rotation, fill_opacity=opacity, **kw)
        y += size * (line_height - 1)
    return fo


@tool("edit")
def edit(job: Job):
    """Visual editor. ops: list of objects with normalized coords on the *visible* page."""
    doc = open_pdf(job.doc_path(job.opts["doc"]))
    ops = job.opts.get("ops") or []
    by_page: dict[int, list] = {}
    for op in ops:
        by_page.setdefault(int(op["page"]), []).append(op)

    for pno, items in by_page.items():
        page = doc[pno]
        W, H = page.rect.width, page.rect.height

        def R(op):
            return fitz.Rect(op["x"] * W, op["y"] * H, (op["x"] + op["w"]) * W, (op["y"] + op["h"]) * H)

        # 1) remove original text that is being replaced, and real redactions
        need_apply = False
        for op in items:
            if op.get("replace"):
                o = op["replace"]
                rr = fitz.Rect(o["x"] * W, o["y"] * H, (o["x"] + o["w"]) * W, (o["y"] + o["h"]) * H)
                page.add_redact_annot(pdf_rect(page, rr), fill=False)
                need_apply = True
            if op["type"] == "redact":
                page.add_redact_annot(pdf_rect(page, R(op)), fill=(0, 0, 0))
                need_apply = True
        if need_apply:
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE)

        # 2) draw objects in order
        for op in items:
            t = op["type"]
            r = R(op)
            color = hex_color(op.get("color"), (0, 0, 0))
            opacity = to_float(op.get("opacity"), 1.0)
            if t == "text":
                txt = op.get("text", "")
                if txt.strip():
                    _place_text(page, (r.x0, r.y0), txt, to_float(op.get("size"), 14), color,
                                op.get("font", "helv"), to_bool(op.get("bold")), opacity,
                                align=op.get("align", "left"), width=r.width)
            elif t in ("whiteout", "rect", "highlight", "ellipse"):
                shape = page.new_shape()
                pr = pdf_rect(page, r)
                if t == "ellipse":
                    shape.draw_oval(pr)
                else:
                    shape.draw_rect(pr)
                if t == "whiteout":
                    shape.finish(color=None, fill=hex_color(op.get("color"), (1, 1, 1)), width=0)
                elif t == "highlight":
                    shape.finish(color=None, fill=hex_color(op.get("color"), (1, 0.92, 0.2)), fill_opacity=0.4, width=0)
                else:
                    fill = hex_color(op["fill"]) if op.get("fill") else None
                    shape.finish(color=color, fill=fill, width=to_float(op.get("stroke"), 2), stroke_opacity=opacity)
                shape.commit()
            elif t == "line":
                p1 = pdf_point(page, (op["x1"] * W, op["y1"] * H))
                p2 = pdf_point(page, (op["x2"] * W, op["y2"] * H))
                page.draw_line(p1, p2, color=color, width=to_float(op.get("stroke"), 2), stroke_opacity=opacity)
            elif t == "ink":
                shape = page.new_shape()
                for stroke in op.get("paths", []):
                    pts = [pdf_point(page, (px * W, py * H)) for px, py in stroke]
                    if len(pts) > 1:
                        shape.draw_polyline(pts)
                shape.finish(color=color, width=to_float(op.get("stroke"), 2), closePath=False,
                             lineCap=1, lineJoin=1, stroke_opacity=opacity)
                shape.commit()
            elif t == "image":
                asset = job.assets.get(op.get("asset", ""))
                if asset:
                    page.insert_image(pdf_rect(page, r), filename=str(asset), rotate=page.rotation,
                                      keep_proportion=False, overlay=True)
            elif t == "check":
                _place_text(page, (r.x0, r.y0 - r.height * 0.1), "✔" if op.get("mark") != "x" else "✘",
                            r.height, color, "symbol", False)
            elif t == "note":
                a = page.add_text_annot(pdf_point(page, (r.x0, r.y0)), op.get("text", ""))
                a.update()
            elif t == "link":
                url = op.get("url", "")
                if url:
                    page.insert_link({"kind": fitz.LINK_URI, "from": pdf_rect(page, r), "uri": url})
    name = job.opts.get("filename") or "edited.pdf"
    return [save_pdf(doc, job.out(name), subset=True)]


def _stamp_image_bytes(path: Path, opacity: float) -> bytes:
    im = Image.open(path).convert("RGBA")
    if opacity < 1:
        a = im.getchannel("A").point(lambda v: int(v * opacity))
        im.putalpha(a)
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


@tool("watermark")
def watermark(job: Job):
    o = job.opts
    text = o.get("text", "CONFIDENTIAL")
    size = to_float(o.get("size"), 60)
    opacity = to_float(o.get("opacity"), 0.25)
    angle = to_float(o.get("angle"), 45)
    color = hex_color(o.get("color"), (0.8, 0.1, 0.1))
    pos = o.get("position", "center")
    img_path = job.assets.get("image")
    img_bytes = _stamp_image_bytes(img_path, opacity) if img_path else None
    scale = to_float(o.get("scale"), 40) / 100
    outs = []
    for f in job.require(1):
        doc = open_pdf(f, job.password)
        for i in parse_pages(o.get("pages"), doc.page_count):
            page = doc[i]
            W, H = page.rect.width, page.rect.height
            if img_bytes:
                iw, ih = Image.open(io.BytesIO(img_bytes)).size
                w = W * scale
                h = w * ih / iw
                cx, cy = _anchor(pos, W, H, w, h)
                page.insert_image(pdf_rect(page, fitz.Rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)),
                                  stream=img_bytes, rotate=page.rotation, overlay=True)
                continue
            kw = resolve_font(o.get("font", "helv"), to_bool(o.get("bold", True)), text)
            tl = font_object(kw).text_length(text, fontsize=size)
            centers = []
            if pos == "tile":
                step_x, step_y = tl * 0.9 + 80, size * 4
                y = step_y / 2
                while y < H + step_y:
                    x = step_x / 2 if int(y / step_y) % 2 == 0 else step_x
                    while x < W + step_x:
                        centers.append((x, y)); x += step_x
                    y += step_y
            else:
                centers.append(_anchor(pos, W, H, tl, size))
            for cx, cy in centers:
                c = pdf_point(page, (cx, cy))
                mat = fitz.Matrix(angle + page.rotation)
                start = fitz.Point(c.x - tl / 2, c.y + size * 0.35)
                page.insert_text(start, text, fontsize=size, color=color, fill_opacity=opacity,
                                 morph=(c, mat), overlay=to_bool(o.get("on_top", True)), **kw)
        outs.append(save_pdf(doc, job.out(f"{stem(f)}_watermarked.pdf"), subset=True))
    return outs


def _anchor(pos, W, H, w, h, m=36):
    xs = {"left": m + w / 2, "center": W / 2, "right": W - m - w / 2}
    ys = {"top": m + h / 2, "center": H / 2, "bottom": H - m - h / 2}
    if pos in ("center", "tile"):
        return W / 2, H / 2
    v, _, hz = pos.partition("-")
    return xs.get(hz or "center", W / 2), ys.get(v, H / 2)


def _fmt(template: str, n: int, total: int, name: str) -> str:
    return (template.replace("{n}", str(n)).replace("{total}", str(total))
            .replace("{date}", dt.date.today().strftime("%d %b %Y")).replace("{file}", name)
            .replace("{roman}", _roman(n)))


def _roman(n: int) -> str:
    vals = [(1000, "m"), (900, "cm"), (500, "d"), (400, "cd"), (100, "c"), (90, "xc"), (50, "l"),
            (40, "xl"), (10, "x"), (9, "ix"), (5, "v"), (4, "iv"), (1, "i")]
    s = ""
    for v, r in vals:
        while n >= v:
            s += r; n -= v
    return s


def _stamp_line(page, template, pos, size, color, font, margin):
    W, H = page.rect.width, page.rect.height
    kw = resolve_font(font, False, template)
    fo = font_object(kw)
    tl = fo.text_length(template, fontsize=size)
    v, _, hz = pos.partition("-")
    x = {"left": margin, "center": (W - tl) / 2, "right": W - margin - tl}[hz or "center"]
    y = margin * 0.75 + size if v == "top" else H - margin * 0.75
    page.insert_text(pdf_point(page, (x, y)), template, fontsize=size, color=color, rotate=page.rotation, **kw)


@tool("page_numbers")
def page_numbers(job: Job):
    o = job.opts
    outs = []
    for f in job.require(1):
        doc = open_pdf(f, job.password)
        pages = parse_pages(o.get("pages"), doc.page_count)
        start = to_int(o.get("start"), 1)
        total = len(pages) + start - 1
        for k, i in enumerate(pages):
            n = start + k
            txt = _fmt(o.get("format", "{n}"), n, total, stem(f))
            pos = o.get("position", "bottom-center")
            if to_bool(o.get("mirror")) and pos.endswith(("left", "right")) and n % 2 == 0:
                pos = pos.replace("left", "@").replace("right", "left").replace("@", "right")
            _stamp_line(doc[i], txt, pos, to_float(o.get("size"), 11), hex_color(o.get("color")),
                        o.get("font", "helv"), to_float(o.get("margin"), 10) * MM * 2)
        outs.append(save_pdf(doc, job.out(f"{stem(f)}_numbered.pdf"), subset=True))
    return outs


@tool("header_footer")
def header_footer(job: Job):
    o = job.opts
    outs = []
    for f in job.require(1):
        doc = open_pdf(f, job.password)
        pages = parse_pages(o.get("pages"), doc.page_count)
        total = doc.page_count
        for i in pages:
            for key, v in (("header", "top"), ("footer", "bottom")):
                tmpl = o.get(key, "")
                if tmpl.strip():
                    _stamp_line(doc[i], _fmt(tmpl, i + 1, total, stem(f)), f"{v}-{o.get(key + '_align', 'center')}",
                                to_float(o.get("size"), 10), hex_color(o.get("color"), (0.3, 0.3, 0.3)),
                                o.get("font", "helv"), 36)
        outs.append(save_pdf(doc, job.out(f"{stem(f)}_stamped.pdf"), subset=True))
    return outs


REDACT_PRESETS = {
    "email": r"[\w.+-]+@[\w-]+\.[\w.-]+",
    "phone": r"(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,5}",
    "card": r"\b(?:\d[ -]?){13,19}\b",
    "aadhaar": r"\b\d{4}\s?\d{4}\s?\d{4}\b",
    "pan": r"\b[A-Z]{5}\d{4}[A-Z]\b",
    "date": r"\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b",
    "url": r"https?://\S+|www\.\S+",
}


@tool("redact")
def redact(job: Job):
    o = job.opts
    terms = [t.strip() for t in re.split(r"[\n,]", o.get("terms", "")) if t.strip()]
    presets = [p for p in REDACT_PRESETS if to_bool(o.get("p_" + p))]
    if not terms and not presets:
        raise ToolError("Enter words to redact or tick at least one preset.")
    fill = hex_color(o.get("color"), (0, 0, 0))
    outs, total = [], 0
    for f in job.require(1):
        doc = open_pdf(f, job.password)
        for page in doc:
            found = []
            for t in terms:
                found += page.search_for(t)
            if presets:
                text = page.get_text()
                for p in presets:
                    for m in re.finditer(REDACT_PRESETS[p], text):
                        s = m.group(0).strip()
                        if len(s) >= 4:
                            found += page.search_for(s)
            for r in found:
                page.add_redact_annot(r, fill=fill)
            total += len(found)
            if found:
                page.apply_redactions()
        if to_bool(o.get("metadata", True)):
            doc.set_metadata({})
        outs.append(save_pdf(doc, job.out(f"{stem(f)}_redacted.pdf"), garbage=4))
    job.message = f"Permanently removed {total} match(es)."
    return outs


@tool("metadata")
def metadata(job: Job):
    o = job.opts
    f = job.first()
    doc = open_pdf(f, job.password)
    if to_bool(o.get("strip")):
        doc.set_metadata({})
        doc.del_xml_metadata()
    else:
        md = dict(doc.metadata or {})
        for k in ("title", "author", "subject", "keywords", "creator", "producer"):
            if o.get(k) not in (None, ""):
                md[k] = o[k]
        md.pop("format", None); md.pop("encryption", None)
        doc.set_metadata(md)
    return [save_pdf(doc, job.out(f"{stem(f)}.pdf"))]


@tool("bookmarks")
def bookmarks(job: Job):
    """Add bookmarks: one per line 'Title | page' (indent with '-' for levels)."""
    f = job.first()
    doc = open_pdf(f, job.password)
    toc = []
    for line in job.opts.get("toc", "").splitlines():
        if "|" not in line:
            continue
        title, _, pg = line.rpartition("|")
        lvl = 1 + len(title) - len(title.lstrip("-"))
        try:
            p = max(1, min(int(pg.strip()), doc.page_count))
        except ValueError:
            continue
        toc.append([min(lvl, (toc[-1][0] + 1) if toc else 1), title.strip("- ").strip(), p])
    if job.opts.get("auto") and not toc:
        for i, page in enumerate(doc):
            blocks = page.get_text("dict")["blocks"]
            spans = [s for b in blocks for l in b.get("lines", []) for s in l["spans"] if s["text"].strip()]
            if spans:
                big = max(spans, key=lambda s: s["size"])
                toc.append([1, big["text"].strip()[:80], i + 1])
    if not toc:
        raise ToolError("Add lines like:  Introduction | 1")
    doc.set_toc(toc)
    return [save_pdf(doc, job.out(f"{stem(f)}_bookmarked.pdf"))]


@tool("form_fill")
def form_fill(job: Job):
    doc = open_pdf(job.doc_path(job.opts["doc"]))
    values = job.opts.get("values", {})
    for page in doc:
        for w in page.widgets():
            key = f"{w.field_name}#{w.xref}"
            if key not in values:
                continue
            v = values[key]
            if w.field_type in (fitz.PDF_WIDGET_TYPE_CHECKBOX, fitz.PDF_WIDGET_TYPE_RADIOBUTTON):
                w.field_value = w.on_state() if to_bool(v) else "Off"
            else:
                w.field_value = str(v)
            w.update()
    if to_bool(job.opts.get("flatten")):
        doc.bake()
    return [save_pdf(doc, job.out(job.opts.get("filename") or "filled.pdf"))]


def form_fields(path: Path) -> list[dict]:
    doc = fitz.open(path)
    out = []
    for page in doc:
        for w in page.widgets():
            out.append({
                "key": f"{w.field_name}#{w.xref}", "name": w.field_label or w.field_name,
                "type": w.field_type_string.lower(), "value": w.field_value,
                "options": list(w.choice_values or []), "page": page.number + 1,
            })
    return out


# =================================================================== SECURITY
@tool("protect")
def protect(job: Job):
    o = job.opts
    user = o.get("user_password", "")
    if not user:
        raise ToolError("Enter a password.")
    if o.get("confirm") is not None and o.get("confirm") != user:
        raise ToolError("Passwords do not match.")
    owner = o.get("owner_password") or user + "#owner"
    perm = fitz.PDF_PERM_ACCESSIBILITY
    if to_bool(o.get("allow_print", True)):
        perm |= fitz.PDF_PERM_PRINT | fitz.PDF_PERM_PRINT_HQ
    if to_bool(o.get("allow_copy", True)):
        perm |= fitz.PDF_PERM_COPY
    if to_bool(o.get("allow_modify")):
        perm |= fitz.PDF_PERM_MODIFY | fitz.PDF_PERM_ANNOTATE | fitz.PDF_PERM_FORM | fitz.PDF_PERM_ASSEMBLE
    outs = []
    for f in job.require(1):
        doc = open_pdf(f, o.get("password"))
        outs.append(save_pdf(doc, job.out(f"{stem(f)}_protected.pdf"), encryption=fitz.PDF_ENCRYPT_AES_256,
                             user_pw=user, owner_pw=owner, permissions=perm))
    return outs


@tool("unlock")
def unlock(job: Job):
    outs = []
    for f in job.require(1):
        doc = fitz.open(f)
        if doc.needs_pass:
            pw = job.opts.get("password", "")
            if not pw or not doc.authenticate(pw):
                raise ToolError(f"Wrong password for '{stem(f)}'.", code="needs_password")
        outs.append(save_pdf(doc, job.out(f"{stem(f)}_unlocked.pdf"), encryption=fitz.PDF_ENCRYPT_NONE))
    return outs


@tool("sanitize")
def sanitize(job: Job):
    outs = []
    for f in job.require(1):
        doc = open_pdf(f, job.password)
        doc.scrub(metadata=True, xml_metadata=True, javascript=True, embedded_files=True,
                  attached_files=True, thumbnails=True, reset_fields=False, reset_responses=True,
                  hidden_text=True, redactions=True, clean_pages=True,
                  remove_links=to_bool(job.opts.get("links")))
        outs.append(save_pdf(doc, job.out(f"{stem(f)}_clean.pdf"), garbage=4))
    return outs


# =================================================================== OPTIMIZE
LEVELS = {"low": (150, 85), "medium": (110, 70), "high": (80, 55), "extreme": (60, 40)}


def _compress_bytes(path: Path, level: str, password=None, gray=False) -> bytes:
    doc = open_pdf(path, password)
    dpi, q = LEVELS.get(level, LEVELS["medium"])
    try:
        doc.rewrite_images(dpi_threshold=dpi + 20, dpi_target=dpi, quality=q, lossy=True,
                           lossless=True, bitonal=True, color=True, gray=True, set_to_gray=gray)
    except Exception:  # noqa: BLE001 - very old/odd images: just skip
        pass
    try:
        doc.subset_fonts()
    except Exception:  # noqa: BLE001
        pass
    doc.scrub(metadata=False, xml_metadata=True, thumbnails=True, reset_fields=False,
              reset_responses=False, redactions=False, clean_pages=False, hidden_text=False,
              javascript=False, embedded_files=False, attached_files=False, remove_links=False)
    return doc.tobytes(garbage=4, deflate=True, deflate_images=True, deflate_fonts=True,
                       use_objstms=1, clean=True)


@tool("compress")
def compress(job: Job):
    outs, msgs = [], []
    target_kb = to_float(job.opts.get("target_kb"), 0)
    gray = to_bool(job.opts.get("grayscale"))
    for f in job.require(1):
        before = f.stat().st_size
        if target_kb > 0:
            data = None
            for lvl in ("low", "medium", "high", "extreme"):
                data = _compress_bytes(f, lvl, job.password, gray)
                if len(data) <= target_kb * 1024:
                    break
            if len(data) > target_kb * 1024:
                data = _raster_compress(f, target_kb, job.password, gray) or data
        else:
            data = _compress_bytes(f, job.opts.get("level", "medium"), job.password, gray)
        if len(data) >= before and not gray:
            data = f.read_bytes()
        p = job.out(f"{stem(f)}_compressed.pdf")
        p.write_bytes(data)
        saved = 100 - len(data) * 100 / max(before, 1)
        msgs.append(f"{stem(f)}: {human_size(before)} → {human_size(len(data))} ({saved:.0f}% smaller)")
        if target_kb and len(data) > target_kb * 1024:
            msgs.append(f"Could not reach {target_kb:.0f} KB - this is the smallest readable version.")
        outs.append(p)
    job.message = "\n".join(msgs)
    return outs


def _raster_compress(f: Path, target_kb: float, password, gray) -> bytes | None:
    """Last resort for a hard size limit: rasterize pages at decreasing quality."""
    src = open_pdf(f, password)
    for dpi, q in ((120, 60), (100, 50), (85, 40), (72, 30), (60, 25)):
        out = fitz.open()
        for page in src:
            pix = page.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY if gray else fitz.csRGB)
            np_ = out.new_page(width=page.rect.width, height=page.rect.height)
            np_.insert_image(np_.rect, stream=pix.tobytes("jpg", jpg_quality=q))
        data = out.tobytes(garbage=4, deflate=True)
        if len(data) <= target_kb * 1024:
            return data
    return data


@tool("grayscale")
def grayscale(job: Job):
    outs = []
    dpi = to_int(job.opts.get("dpi"), 150)
    for f in job.require(1):
        src = open_pdf(f, job.password)
        out = fitz.open()
        for page in src:
            pix = page.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY)
            np_ = out.new_page(width=page.rect.width, height=page.rect.height)
            np_.insert_image(np_.rect, stream=pix.tobytes("jpg", jpg_quality=80))
        outs.append(save_pdf(out, job.out(f"{stem(f)}_grayscale.pdf")))
    return outs


@tool("repair")
def repair(job: Job):
    outs = []
    for f in job.require(1):
        doc = open_pdf(f, job.password)
        outs.append(save_pdf(doc, job.out(f"{stem(f)}_repaired.pdf"), garbage=4, clean=True))
    job.message = "Rebuilt the file structure. If the original opened with errors, try the repaired copy."
    return outs


@tool("flatten")
def flatten(job: Job):
    outs = []
    for f in job.require(1):
        doc = open_pdf(f, job.password)
        if to_bool(job.opts.get("raster")):
            out = fitz.open()
            for page in doc:
                pix = page.get_pixmap(dpi=to_int(job.opts.get("dpi"), 150))
                np_ = out.new_page(width=page.rect.width, height=page.rect.height)
                np_.insert_image(np_.rect, stream=pix.tobytes("jpg", jpg_quality=85))
            doc = out
        else:
            doc.bake(annots=True, widgets=True)
        outs.append(save_pdf(doc, job.out(f"{stem(f)}_flat.pdf")))
    return outs


# =================================================================== INFO / COMPARE
@tool("info")
def info(job: Job):
    f = job.first()
    raw = fitz.open(f)
    encrypted = raw.needs_pass or bool(raw.is_encrypted)
    doc = open_pdf(f, job.password)
    sizes = {}
    imgs = set()
    fonts = set()
    words = 0
    scanned = 0
    for page in doc:
        r = page.rect
        key = f"{r.width / MM:.0f} × {r.height / MM:.0f} mm"
        sizes[key] = sizes.get(key, 0) + 1
        for im in page.get_images():
            imgs.add(im[0])
        for fo in page.get_fonts():
            fonts.add(fo[3].split("+")[-1])
        t = page.get_text()
        words += len(t.split())
        if not t.strip() and page.get_images():
            scanned += 1
    md = {k: v for k, v in (doc.metadata or {}).items() if v}
    return {
        "File": Path(f).name.split("__", 1)[-1],
        "File size": human_size(f.stat().st_size),
        "Pages": doc.page_count,
        "Page sizes": ", ".join(f"{k} ({v})" for k, v in sizes.items()),
        "Words": words,
        "Images": len(imgs),
        "Fonts": ", ".join(sorted(fonts)[:15]) or "none",
        "Encrypted": "yes" if encrypted else "no",
        "Form fields": sum(1 for p in doc for _ in p.widgets()),
        "Bookmarks": len(doc.get_toc()),
        "Looks scanned": f"{scanned} page(s) have no text - use OCR to make them searchable" if scanned else "no",
        "PDF version": md.pop("format", ""),
        **{k.capitalize(): v for k, v in md.items() if k != "encryption"},
    }


@tool("compare")
def compare(job: Job):
    a, b = job.require(2, 2)
    da, db = open_pdf(a, job.password), open_pdf(b, job.password)
    ta = [l for p in da for l in p.get_text().splitlines()]
    tb = [l for p in db for l in p.get_text().splitlines()]
    diff = difflib.HtmlDiff(wrapcolumn=80).make_file(ta, tb, html.escape(stem(a)), html.escape(stem(b)),
                                                     context=True, numlines=2)
    ratio = difflib.SequenceMatcher(None, "\n".join(ta), "\n".join(tb)).quick_ratio()
    style = "<style>body{font-family:Segoe UI,Arial;margin:16px}table.diff{font-size:13px;border-collapse:collapse}" \
            "td{padding:2px 6px}.diff_add{background:#c8f7c5}.diff_chg{background:#fff3b0}.diff_sub{background:#ffc9c9}</style>"
    summary = f"<h2>Comparison: {html.escape(stem(a))} vs {html.escape(stem(b))}</h2><p>Text similarity: <b>{ratio * 100:.1f}%</b>. " \
              f"Pages: {da.page_count} vs {db.page_count}.</p>"
    diff = diff.replace("<body>", "<body>" + summary).replace("</head>", style + "</head>")
    p = job.out("comparison.html")
    p.write_text(diff, encoding="utf-8")
    # visual diff of each page pair
    vis = fitz.open()
    for i in range(min(da.page_count, db.page_count)):
        pa = da[i].get_pixmap(dpi=72); pb = db[i].get_pixmap(dpi=72)
        ia = np.frombuffer(pa.samples, np.uint8).reshape(pa.h, pa.w, pa.n)[:, :, :3]
        ib = np.frombuffer(pb.samples, np.uint8).reshape(pb.h, pb.w, pb.n)[:, :, :3]
        h, w = min(ia.shape[0], ib.shape[0]), min(ia.shape[1], ib.shape[1])
        d = np.abs(ia[:h, :w].astype(int) - ib[:h, :w].astype(int)).sum(axis=2) > 60
        if not d.any():
            continue
        over = ib[:h, :w].copy()
        over[d] = [255, 0, 0]
        buf = io.BytesIO(); Image.fromarray(over).save(buf, "PNG")
        pg = vis.new_page(width=w, height=h + 20)
        pg.insert_text((6, 14), f"Page {i + 1}: differences in red", fontsize=10)
        pg.insert_image(fitz.Rect(0, 20, w, h + 20), stream=buf.getvalue())
    outs = [p]
    if vis.page_count:
        outs.append(save_pdf(vis, job.out("visual_differences.pdf")))
    job.message = f"Text similarity {ratio * 100:.1f}%. " + (
        f"{vis.page_count} page(s) look different." if vis.page_count else "Pages look identical.")
    return outs


# =================================================================== helpers for the UI
def page_lines(path: Path, pno: int) -> list[dict]:
    """Text lines on a page in normalized visible coords (for 'edit existing text')."""
    doc = fitz.open(path)
    page = doc[pno]
    W, H = page.rect.width, page.rect.height
    res = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            spans = [s for s in l["spans"] if s["text"].strip()]
            if not spans or (page.rotation == 0 and abs(l["dir"][1]) > 0.01):
                continue  # skip vertical / slanted text
            r = fitz.Rect()
            for s in spans:
                r |= fitz.Rect(s["bbox"])
            vr = visual_rect(page, r)
            s0 = max(spans, key=lambda s: len(s["text"]))
            fname = s0["font"].lower()
            font = "tiro" if any(k in fname for k in ("times", "serif", "roman", "georgia", "cambria")) and "sans" not in fname \
                else "cour" if any(k in fname for k in ("courier", "mono", "consol")) else "helv"
            c = s0["color"]
            res.append({
                "x": vr.x0 / W, "y": vr.y0 / H, "w": vr.width / W, "h": vr.height / H,
                "text": "".join(s["text"] for s in l["spans"]).strip(), "size": round(s0["size"], 1),
                "color": f"#{c:06x}", "bold": bool(s0["flags"] & 16) or "bold" in fname, "font": font,
            })
    return res


def thumbnail(path: Path, pno: int, width: int) -> bytes:
    doc = fitz.open(path)
    page = doc[pno]
    zoom = width / page.rect.width
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    return pix.tobytes("jpg", jpg_quality=82) if width > 400 else pix.tobytes("png")


def data_uri(png: bytes, mime="image/png") -> str:
    return f"data:{mime};base64,{base64.b64encode(png).decode()}"


_ = json  # (kept for tools that may parse JSON options)
