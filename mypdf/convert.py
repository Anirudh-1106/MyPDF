"""Conversions: anything -> PDF, PDF -> other formats, image tools."""
from __future__ import annotations

import html
import io
import shutil
import subprocess
import sys
import threading
from pathlib import Path

import pymupdf as fitz
from PIL import Image, ImageOps

from .core import (EBOOK_EXT, IMAGE_EXT, OFFICE_EXT, TEXT_EXT, ToolError, ext, human_size, open_pdf,
                   parse_pages, save_pdf, stem, to_bool, to_float, to_int, tool)
from .job import Job

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception:  # noqa: BLE001
    pass

MM = 72 / 25.4
PAPER = {"a4": "a4", "letter": "letter", "legal": "legal", "a3": "a3", "a5": "a5"}


# =================================================================== images -> PDF
def load_image(path: Path) -> Image.Image:
    try:
        im = Image.open(path)
        im = ImageOps.exif_transpose(im)
    except Exception as e:  # noqa: BLE001
        raise ToolError(f"Could not read image '{stem(path)}': {e}")
    return im


def _img_bytes(im: Image.Image, quality: int = 88) -> bytes:
    buf = io.BytesIO()
    if im.mode in ("RGBA", "LA", "P") and "transparency" in im.info or im.mode in ("RGBA", "LA"):
        im.save(buf, "PNG", optimize=True)
    elif im.mode == "1":
        im.save(buf, "PNG", optimize=True)
    else:
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        im.save(buf, "JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def images_to_pdf_doc(paths: list[Path], o: dict) -> fitz.Document:
    size = o.get("page_size", "fit")
    orient = o.get("orientation", "auto")
    margin = to_float(o.get("margin"), 0) * MM
    quality = to_int(o.get("quality"), 88)
    doc = fitz.open()
    for p in paths:
        im = load_image(p)
        frames = []
        try:
            for i in range(getattr(im, "n_frames", 1)):  # multi-page TIFF
                im.seek(i)
                frames.append(ImageOps.exif_transpose(im.copy()))
        except EOFError:
            pass
        frames = frames or [im]
        if ext(p) == ".gif":
            frames = frames[:1]
        for fr in frames:
            data = _img_bytes(fr, quality)
            iw, ih = fr.size
            if size == "fit":
                pw = 595.0
                ph = pw * ih / iw
                if iw > ih:  # landscape photo: keep a comfortable size
                    pw, ph = 842.0, 842.0 * ih / iw
                rect = fitz.Rect(0, 0, pw + 2 * margin, ph + 2 * margin)
            else:
                rect = fitz.paper_rect(PAPER.get(size, "a4"))
                land = (iw > ih) if orient == "auto" else orient == "landscape"
                if land:
                    rect = fitz.Rect(0, 0, rect.height, rect.width)
            page = doc.new_page(width=rect.width, height=rect.height)
            page.insert_image(rect + (margin, margin, -margin, -margin), stream=data, keep_proportion=True)
    return doc


@tool("images_to_pdf")
def images_to_pdf(job: Job):
    files = [f for f in job.require(1) if ext(f) in IMAGE_EXT]
    if not files:
        raise ToolError("Please add image files (JPG, PNG, HEIC, WEBP...).")
    if to_bool(job.opts.get("separate")):
        return [save_pdf(images_to_pdf_doc([f], job.opts), job.out(f"{stem(f)}.pdf")) for f in files]
    doc = images_to_pdf_doc(files, job.opts)
    name = job.opts.get("filename") or (stem(files[0]) if len(files) == 1 else "images") + ".pdf"
    return [save_pdf(doc, job.out(name if name.endswith(".pdf") else name + ".pdf"))]


# =================================================================== office -> PDF
_office_lock = threading.Lock()


def _soffice() -> str | None:
    for c in (shutil.which("soffice"), r"C:\Program Files\LibreOffice\program\soffice.exe",
              r"C:\Program Files (x86)\LibreOffice\program\soffice.exe", "/usr/bin/soffice",
              "/Applications/LibreOffice.app/Contents/MacOS/soffice"):
        if c and Path(c).exists():
            return c
    return None


def office_available() -> dict:
    ms = False
    if sys.platform == "win32":
        try:
            import winreg
            for prog in ("Word.Application", "Excel.Application", "PowerPoint.Application"):
                winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, prog).Close()
            ms = True
        except OSError:
            ms = False
    return {"msoffice": ms, "libreoffice": bool(_soffice())}


OFFICE_PROCS = {"winword.exe", "excel.exe", "powerpnt.exe"}
ROOT = Path(__file__).resolve().parent.parent


def _office_pids() -> set[int]:
    import psutil
    return {p.pid for p in psutil.process_iter(["name"]) if (p.info["name"] or "").lower() in OFFICE_PROCS}


def _kill_started_office(before: set[int]):
    """Kill only Office processes started by our automation (parent = DCOM svchost), never the user's."""
    import psutil
    for pid in _office_pids() - before:
        try:
            p = psutil.Process(pid)
            parent = (p.parent().name() if p.parent() else "").lower()
            if parent in ("svchost.exe", "dllhost.exe", ""):
                p.kill()
        except psutil.Error:
            pass


def _run_office_worker(mode: str, src: Path, out: Path, timeout: int = 180):
    before = _office_pids()
    cmd = [sys.executable, "-m", "mypdf.office_worker", mode, str(src.resolve()), str(out.resolve())]
    try:
        r = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, timeout=timeout,
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    except subprocess.TimeoutExpired:
        _kill_started_office(before)
        raise ToolError("Microsoft Office did not respond. Open Word / Excel / PowerPoint once yourself "
                        "and close any sign-in, activation or 'first run' prompts, then try again.")
    if r.returncode != 0 or not out.exists():
        _kill_started_office(before)
        lines = [l for l in (r.stderr or "").strip().splitlines() if l.strip()]
        raise RuntimeError(lines[-1] if lines else "conversion failed")


def _ms_office_to_pdf(src: Path, out: Path):
    _run_office_worker("to-pdf", src, out)


def office_to_pdf_file(src: Path, out: Path) -> Path:
    avail = office_available()
    errors = []
    with _office_lock:
        if avail["msoffice"]:
            try:
                _ms_office_to_pdf(src.resolve(), out.resolve())
                if out.exists():
                    return out
            except ToolError:
                raise
            except Exception as e:  # noqa: BLE001
                errors.append(f"MS Office: {e}")
        so = _soffice()
        if so:
            tmp = out.parent / "_lo"
            tmp.mkdir(exist_ok=True)
            subprocess.run([so, "--headless", "--convert-to", "pdf", "--outdir", str(tmp), str(src)],
                           capture_output=True, timeout=180)
            produced = tmp / (src.stem + ".pdf")
            if produced.exists():
                shutil.move(produced, out)
                shutil.rmtree(tmp, ignore_errors=True)
                return out
            errors.append("LibreOffice conversion failed")
    if ext(src) == ".docx":  # pure-python fallback (text + basic formatting only)
        return _docx_fallback(src, out)
    if ext(src) == ".csv":
        return _text_to_pdf(src, out)
    raise ToolError("Converting Office files needs Microsoft Office or LibreOffice installed. " + "; ".join(errors))


def _docx_fallback(src: Path, out: Path) -> Path:
    import docx
    d = docx.Document(str(src))
    parts = []
    for p in d.paragraphs:
        style = (p.style.name or "").lower()
        tag = "h1" if "heading 1" in style or style == "title" else "h2" if "heading 2" in style else \
            "h3" if "heading" in style else "p"
        runs = "".join(
            (f"<b>{html.escape(r.text)}</b>" if r.bold else f"<i>{html.escape(r.text)}</i>" if r.italic else html.escape(r.text))
            for r in p.runs)
        parts.append(f"<{tag}>{runs or '&nbsp;'}</{tag}>")
    for t in d.tables:
        rows = "".join("<tr>" + "".join(f"<td>{html.escape(c.text)}</td>" for c in r.cells) + "</tr>" for r in t.rows)
        parts.append(f"<table border='1'>{rows}</table>")
    return html_to_pdf("".join(parts), out)


@tool("office_to_pdf")
def office_to_pdf(job: Job):
    outs = []
    for f in job.require(1):
        if ext(f) not in OFFICE_EXT:
            raise ToolError(f"'{Path(f).name}' is not a Word/Excel/PowerPoint file.")
        outs.append(office_to_pdf_file(f, job.out(f"{stem(f)}.pdf")))
    return outs


# =================================================================== text / html / markdown -> PDF
CSS = """
body { font-family: sans-serif; font-size: 11pt; line-height: 1.4; }
h1 { font-size: 20pt; } h2 { font-size: 16pt; } h3 { font-size: 13pt; }
pre, code { font-family: monospace; font-size: 9.5pt; }
table { border-collapse: collapse; } td, th { border: 1px solid #999; padding: 3px; }
"""


def html_to_pdf(body: str, out: Path, paper: str = "a4", margin: float = 54) -> Path:
    story = fitz.Story(html=body, user_css=CSS)
    writer = fitz.DocumentWriter(str(out))
    mediabox = fitz.paper_rect(paper)
    where = mediabox + (margin, margin, -margin, -margin)
    more = True
    while more:
        dev = writer.begin_page(mediabox)
        more, _ = story.place(where)
        story.draw(dev)
        writer.end_page()
    writer.close()
    return out


def _text_to_pdf(src: Path, out: Path, paper="a4") -> Path:
    raw = src.read_bytes()
    for enc in ("utf-8-sig", "utf-16", "cp1252", "latin-1"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    e = ext(src)
    if e in (".html", ".htm"):
        body = text
    elif e in (".md", ".markdown"):
        import markdown
        body = markdown.markdown(text, extensions=["tables", "fenced_code", "sane_lists"])
    elif e == ".csv":
        import csv
        rows = list(csv.reader(io.StringIO(text)))
        body = "<table>" + "".join("<tr>" + "".join(f"<td>{html.escape(c)}</td>" for c in r) + "</tr>" for r in rows) + "</table>"
    else:
        mono = e not in (".txt", ".log")
        esc = html.escape(text).replace("\n", "<br/>").replace("  ", "&nbsp; ")
        body = f"<div style='font-family:{'monospace' if mono else 'sans-serif'};font-size:{'9.5pt' if mono else '11pt'}'>{esc}</div>"
    return html_to_pdf(body, out, paper)


@tool("text_to_pdf")
def text_to_pdf(job: Job):
    paper = job.opts.get("page_size", "a4")
    if job.opts.get("text", "").strip() and not job.files:
        p = job.out_dir / "_typed.md"
        p.write_text(job.opts["text"], encoding="utf-8")
        return [_text_to_pdf(p, job.out((job.opts.get("filename") or "document") + ".pdf"), paper)]
    return [_text_to_pdf(f, job.out(f"{stem(f)}.pdf"), paper) for f in job.require(1)]


@tool("to_pdf")
def to_pdf(job: Job):
    """Universal: convert any supported file(s) to PDF, optionally merged into one."""
    outs = []
    images = [f for f in job.require(1) if ext(f) in IMAGE_EXT]
    others = [f for f in job.files if ext(f) not in IMAGE_EXT]
    if images:
        outs.append(save_pdf(images_to_pdf_doc(images, job.opts), job.out("images.pdf" if len(images) > 1 else f"{stem(images[0])}.pdf")))
    for f in others:
        e = ext(f)
        target = job.out(f"{stem(f)}.pdf")
        if e == ".pdf":
            shutil.copy(f, target); outs.append(target)
        elif e in OFFICE_EXT:
            outs.append(office_to_pdf_file(f, target))
        elif e in TEXT_EXT:
            outs.append(_text_to_pdf(f, target))
        elif e in EBOOK_EXT:
            d = fitz.open(f)
            outs.append(save_pdf(fitz.open("pdf", d.convert_to_pdf()), target))
        else:
            try:
                d = fitz.open(f)
                outs.append(save_pdf(fitz.open("pdf", d.convert_to_pdf()), target))
            except Exception:  # noqa: BLE001
                raise ToolError(f"Don't know how to convert '{Path(f).name}' to PDF.")
    if to_bool(job.opts.get("merge")) and len(outs) > 1:
        m = fitz.open()
        for o in outs:
            m.insert_pdf(fitz.open(o))
        return [save_pdf(m, job.out("combined.pdf"))]
    return outs


# =================================================================== PDF -> other
@tool("pdf_to_images")
def pdf_to_images(job: Job):
    f = job.first()
    doc = open_pdf(f, job.password)
    fmt = job.opts.get("format", "jpg")
    dpi = to_int(job.opts.get("dpi"), 150)
    outs = []
    for i in parse_pages(job.opts.get("pages"), doc.page_count):
        pix = doc[i].get_pixmap(dpi=dpi, alpha=False)
        p = job.out(f"{stem(f)}_page{i + 1}.{fmt}")
        if fmt in ("jpg", "jpeg"):
            p.write_bytes(pix.tobytes("jpg", jpg_quality=to_int(job.opts.get("quality"), 90)))
        elif fmt == "webp":
            pix.pil_save(str(p), format="WEBP", quality=85)
        elif fmt == "tiff":
            pix.pil_save(str(p), format="TIFF", compression="tiff_lzw")
        else:
            pix.save(str(p))
        outs.append(p)
    return outs


@tool("pdf_to_long_image")
def pdf_to_long_image(job: Job):
    f = job.first()
    doc = open_pdf(f, job.password)
    pages = parse_pages(job.opts.get("pages"), doc.page_count)[:60]
    width = to_int(job.opts.get("width"), 1200)
    ims = []
    for i in pages:
        pg = doc[i]
        z = width / pg.rect.width
        pix = pg.get_pixmap(matrix=fitz.Matrix(z, z), alpha=False)
        ims.append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
    gap = 12
    total = sum(i.height for i in ims) + gap * (len(ims) - 1)
    canvas = Image.new("RGB", (width, total), (225, 225, 225))
    y = 0
    for im in ims:
        canvas.paste(im, (0, y)); y += im.height + gap
    p = job.out(f"{stem(f)}_long.jpg")
    canvas.save(p, "JPEG", quality=85, optimize=True)
    return [p]


def _unlocked_copy(f: Path, job: Job) -> Path:
    d = fitz.open(f)
    if not d.needs_pass:
        return f
    doc = open_pdf(f, job.password)
    tmp = job.out_dir / f"_unlocked_{Path(f).name}"
    doc.save(str(tmp))
    return tmp


@tool("pdf_to_word")
def pdf_to_word(job: Job):
    outs = []
    for f in job.require(1):
        src = _unlocked_copy(f, job)
        out = job.out(f"{stem(f)}.docx")
        engine = job.opts.get("engine", "pdf2docx")
        if engine == "msword" and office_available()["msoffice"]:
            with _office_lock:
                try:
                    _run_office_worker("pdf-to-docx", src, out, timeout=90)
                except RuntimeError as e:
                    raise ToolError(f"Word could not convert this PDF ({e}). Try the standard engine.")
        else:
            from pdf2docx import Converter
            pages = None
            if job.opts.get("pages"):
                pages = parse_pages(job.opts["pages"], fitz.open(src).page_count)
            cv = Converter(str(src))
            try:
                cv.convert(str(out), pages=pages)
            finally:
                cv.close()
        outs.append(out)
    return outs


@tool("pdf_to_excel")
def pdf_to_excel(job: Job):
    from openpyxl import Workbook
    from openpyxl.styles import Font
    f = job.first()
    doc = open_pdf(f, job.password)
    wb = Workbook()
    wb.remove(wb.active)
    count = 0
    for page in doc:
        try:
            tabs = page.find_tables()
        except Exception:  # noqa: BLE001
            continue
        for k, t in enumerate(tabs.tables):
            rows = t.extract()
            if not rows:
                continue
            count += 1
            ws = wb.create_sheet(f"Page{page.number + 1}_Table{k + 1}"[:31])
            for r in rows:
                ws.append([_num((c or "").replace("\n", " ")) for c in r])
            for c in ws[1]:
                c.font = Font(bold=True)
            for col in ws.columns:
                ws.column_dimensions[col[0].column_letter].width = min(60, max(8, max(len(str(c.value or "")) for c in col) + 2))
    if not count:  # no tables: put text lines, splitting columns on big gaps
        ws = wb.create_sheet("Text")
        for page in doc:
            for line in page.get_text("text", sort=True).splitlines():
                if line.strip():
                    import re
                    ws.append([_num(x) for x in re.split(r"\s{3,}|\t", line.strip())])
        job.message = "No tables detected - exported text lines (columns split on wide gaps)."
    else:
        job.message = f"Exported {count} table(s)."
    out = job.out(f"{stem(f)}.xlsx")
    wb.save(out)
    return [out]


def _num(v: str):
    s = v.strip().replace(",", "")
    try:
        return int(s) if s.isdigit() else float(s) if s.replace(".", "", 1).lstrip("-").isdigit() else v.strip()
    except ValueError:
        return v.strip()


@tool("pdf_to_pptx")
def pdf_to_pptx(job: Job):
    from pptx import Presentation
    from pptx.util import Emu
    f = job.first()
    doc = open_pdf(f, job.password)
    prs = Presentation()
    r0 = doc[0].rect
    prs.slide_width = Emu(int(r0.width * 12700))
    prs.slide_height = Emu(int(r0.height * 12700))
    blank = prs.slide_layouts[6]
    for page in doc:
        pix = page.get_pixmap(dpi=to_int(job.opts.get("dpi"), 150), alpha=False)
        s = prs.slides.add_slide(blank)
        s.shapes.add_picture(io.BytesIO(pix.tobytes("png")), 0, 0, prs.slide_width, prs.slide_height)
        if to_bool(job.opts.get("notes", True)):
            s.notes_slide.notes_text_frame.text = page.get_text()[:5000]
    out = job.out(f"{stem(f)}.pptx")
    prs.save(out)
    return [out]


@tool("pdf_to_text")
def pdf_to_text(job: Job):
    outs = []
    for f in job.require(1):
        doc = open_pdf(f, job.password)
        parts = []
        for page in doc:
            parts.append(page.get_text("text", sort=True))
        text = ("\n\f" if to_bool(job.opts.get("page_breaks")) else "\n").join(parts)
        if not text.strip():
            job.message = "No text found - this looks like a scanned PDF. Use the OCR tool instead."
        p = job.out(f"{stem(f)}.txt")
        p.write_text(text, encoding="utf-8")
        outs.append(p)
    return outs


@tool("pdf_to_markdown")
def pdf_to_markdown(job: Job):
    import pymupdf4llm
    outs = []
    for f in job.require(1):
        src = _unlocked_copy(f, job)
        try:
            md = pymupdf4llm.to_markdown(str(src), show_progress=False, use_ocr=False)
        except Exception:  # noqa: BLE001 - layout engine failed: use the simpler converter
            md = pymupdf4llm.helpers.pymupdf_rag.to_markdown(str(src), show_progress=False)
        p = job.out(f"{stem(f)}.md")
        p.write_text(md, encoding="utf-8")
        outs.append(p)
    return outs


@tool("pdf_to_html")
def pdf_to_html(job: Job):
    f = job.first()
    doc = open_pdf(f, job.password)
    body = "\n".join(f"<section class='page'>{p.get_text('xhtml')}</section>" for p in doc)
    page = (f"<!doctype html><html><head><meta charset='utf-8'><title>{html.escape(stem(f))}</title>"
            "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            "<style>body{font-family:Segoe UI,Arial,sans-serif;max-width:860px;margin:auto;padding:16px;line-height:1.5}"
            "section.page{border-bottom:1px solid #ddd;padding:12px 0}img{max-width:100%}</style></head>"
            f"<body>{body}</body></html>")
    p = job.out(f"{stem(f)}.html")
    p.write_text(page, encoding="utf-8")
    return [p]


@tool("pdf_to_epub")
def pdf_to_epub(job: Job):
    """Simple reflowable EPUB built from the PDF's text."""
    import uuid
    import zipfile
    f = job.first()
    doc = open_pdf(f, job.password)
    title = (doc.metadata or {}).get("title") or stem(f)
    out = job.out(f"{stem(f)}.epub")
    chapters = []
    for p in doc:
        body = p.get_text("xhtml")
        chapters.append(f"<?xml version='1.0' encoding='utf-8'?><html xmlns='http://www.w3.org/1999/xhtml'><head><title>{p.number + 1}</title></head><body>{body}</body></html>")
    uid = str(uuid.uuid4())
    with zipfile.ZipFile(out, "w") as z:
        z.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        z.writestr("META-INF/container.xml", "<?xml version='1.0'?><container version='1.0' xmlns='urn:oasis:names:tc:opendocument:xmlns:container'><rootfiles><rootfile full-path='OEBPS/content.opf' media-type='application/oebps-package+xml'/></rootfiles></container>")
        manifest = "".join(f"<item id='c{i}' href='c{i}.xhtml' media-type='application/xhtml+xml'/>" for i in range(len(chapters)))
        spine = "".join(f"<itemref idref='c{i}'/>" for i in range(len(chapters)))
        z.writestr("OEBPS/content.opf", f"<?xml version='1.0' encoding='utf-8'?><package xmlns='http://www.idpf.org/2007/opf' unique-identifier='id' version='2.0'><metadata xmlns:dc='http://purl.org/dc/elements/1.1/'><dc:title>{html.escape(title)}</dc:title><dc:identifier id='id'>{uid}</dc:identifier><dc:language>en</dc:language></metadata><manifest>{manifest}<item id='ncx' href='toc.ncx' media-type='application/x-dtbncx+xml'/></manifest><spine toc='ncx'>{spine}</spine></package>")
        nav = "".join(f"<navPoint id='n{i}' playOrder='{i + 1}'><navLabel><text>Page {i + 1}</text></navLabel><content src='c{i}.xhtml'/></navPoint>" for i in range(len(chapters)))
        z.writestr("OEBPS/toc.ncx", f"<?xml version='1.0' encoding='utf-8'?><ncx xmlns='http://www.daisy.org/z3986/2005/ncx/' version='2005-1'><head><meta name='dtb:uid' content='{uid}'/></head><docTitle><text>{html.escape(title)}</text></docTitle><navMap>{nav}</navMap></ncx>")
        for i, c in enumerate(chapters):
            z.writestr(f"OEBPS/c{i}.xhtml", c)
    return [out]


@tool("extract_images")
def extract_images(job: Job):
    f = job.first()
    doc = open_pdf(f, job.password)
    seen, outs = set(), []
    min_px = to_int(job.opts.get("min_size"), 50)
    for page in doc:
        for im in page.get_images(full=True):
            xref = im[0]
            if xref in seen:
                continue
            seen.add(xref)
            try:
                pix = fitz.Pixmap(doc, xref)
                if pix.width < min_px or pix.height < min_px:
                    continue
                if im[1]:  # has soft mask
                    pix = fitz.Pixmap(pix, fitz.Pixmap(doc, im[1]))
                if pix.n - pix.alpha >= 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                info = doc.extract_image(xref)
                if info and info["ext"] in ("jpeg", "jpg", "png") and not im[1]:
                    p = job.out(f"page{page.number + 1}_img{len(outs) + 1}.{info['ext'].replace('jpeg', 'jpg')}")
                    p.write_bytes(info["image"])
                else:
                    p = job.out(f"page{page.number + 1}_img{len(outs) + 1}.png")
                    pix.save(str(p))
                outs.append(p)
            except Exception:  # noqa: BLE001
                continue
    if not outs:
        raise ToolError("No images found in this PDF.")
    job.message = f"Extracted {len(outs)} image(s)."
    return outs


# =================================================================== image tools
@tool("image_convert")
def image_convert(job: Job):
    """Convert / resize / compress images (e.g. to fit form upload limits)."""
    o = job.opts
    fmt = o.get("format", "jpg")
    outs, msgs = [], []
    for f in job.require(1):
        if ext(f) not in IMAGE_EXT:
            raise ToolError(f"'{Path(f).name}' is not an image.")
        im = load_image(f)
        if fmt == "same":
            target = {".jpeg": "jpg", ".jfif": "jpg", ".heic": "jpg", ".heif": "jpg", ".avif": "jpg"}.get(ext(f), ext(f)[1:])
        else:
            target = fmt
        # resize
        mw, mh, pct = to_int(o.get("max_width"), 0), to_int(o.get("max_height"), 0), to_float(o.get("percent"), 100)
        if pct and pct != 100:
            im = im.resize((max(1, int(im.width * pct / 100)), max(1, int(im.height * pct / 100))), Image.LANCZOS)
        if mw or mh:
            im.thumbnail((mw or 100000, mh or 100000), Image.LANCZOS)
        if to_bool(o.get("grayscale")):
            im = ImageOps.grayscale(im)
        if target in ("jpg", "bmp") and im.mode not in ("RGB", "L"):
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.convert("RGBA").getchannel("A"))
            im = bg
        pil_fmt = {"jpg": "JPEG", "png": "PNG", "webp": "WEBP", "bmp": "BMP", "tiff": "TIFF", "gif": "GIF", "tif": "TIFF"}.get(target, "JPEG")
        q = to_int(o.get("quality"), 85)
        target_kb = to_float(o.get("target_kb"), 0)
        data = _encode(im, pil_fmt, q)
        if target_kb > 0 and pil_fmt in ("JPEG", "WEBP"):
            work = im
            for _ in range(12):
                lo, hi, best = 10, 95, None
                while lo <= hi:
                    mid = (lo + hi) // 2
                    d = _encode(work, pil_fmt, mid)
                    if len(d) <= target_kb * 1024:
                        best, lo = d, mid + 1
                    else:
                        hi = mid - 1
                if best:
                    data = best
                    break
                work = work.resize((max(1, int(work.width * 0.8)), max(1, int(work.height * 0.8))), Image.LANCZOS)
            else:
                data = _encode(work, pil_fmt, 10)
        p = job.out(f"{stem(f)}.{target}")
        p.write_bytes(data)
        msgs.append(f"{stem(f)}: {human_size(f.stat().st_size)} \u2192 {human_size(len(data))}")
        outs.append(p)
    job.message = "\n".join(msgs)
    return outs


def _encode(im: Image.Image, fmt: str, q: int) -> bytes:
    buf = io.BytesIO()
    kw = {"quality": q, "optimize": True} if fmt in ("JPEG", "WEBP") else {"optimize": True} if fmt == "PNG" else {}
    if fmt == "JPEG":
        kw["progressive"] = True
    im.save(buf, fmt, **kw)
    return buf.getvalue()
