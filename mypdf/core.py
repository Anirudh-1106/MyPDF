"""Shared helpers: errors, opening documents, page-range parsing, fonts, tool registry."""
from __future__ import annotations

import os
import re
import warnings
from pathlib import Path

warnings.filterwarnings("ignore", message=".*fitz.*deprecated.*")

import pymupdf as fitz  # noqa: E402

fitz.TOOLS.mupdf_display_errors(False)

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tif", ".tiff", ".webp", ".heic", ".heif", ".jfif", ".avif"}
OFFICE_EXT = {".doc", ".docx", ".odt", ".rtf", ".xls", ".xlsx", ".ods", ".csv", ".ppt", ".pptx", ".odp"}
TEXT_EXT = {".txt", ".md", ".markdown", ".html", ".htm", ".log", ".json", ".xml", ".py", ".js", ".css"}
EBOOK_EXT = {".epub", ".xps", ".oxps", ".fb2", ".cbz", ".mobi", ".svg"}

TOOLS: dict[str, callable] = {}


class ToolError(Exception):
    """A user-facing error (shown in the UI as-is)."""

    def __init__(self, message: str, code: str = "error"):
        super().__init__(message)
        self.code = code


def tool(name: str):
    def deco(fn):
        TOOLS[name] = fn
        return fn
    return deco


def ext(path) -> str:
    return Path(path).suffix.lower()


def stem(path) -> str:
    """Original file stem (uploads are stored as '<n>__<original name>')."""
    s = Path(path).stem
    return s.split("__", 1)[1] if "__" in s else s


def open_pdf(path, password: str | None = None) -> fitz.Document:
    """Open a PDF (or any MuPDF-supported document, converted to PDF)."""
    try:
        doc = fitz.open(path)
    except Exception as e:  # noqa: BLE001
        raise ToolError(f"Could not open '{Path(path).name}': {e}")
    if doc.needs_pass:
        if not password or not doc.authenticate(password):
            raise ToolError(
                f"'{stem(path)}' is password protected. Enter the password to continue.",
                code="needs_password",
            )
    if not doc.is_pdf:
        data = doc.convert_to_pdf()
        doc.close()
        doc = fitz.open("pdf", data)
    return doc


def save_pdf(doc: fitz.Document, out: Path, subset: bool = False, **kw) -> Path:
    """Save; subset=True shrinks fonts we embedded (e.g. Unicode/symbol fonts) to the used glyphs."""
    if subset:
        try:
            doc.subset_fonts()
        except Exception:  # noqa: BLE001
            pass
    opts = dict(garbage=3, deflate=True)
    opts.update(kw)
    doc.save(str(out), **opts)
    return out


def parse_pages(spec: str | None, count: int, default_all: bool = True) -> list[int]:
    """Parse '1,3-5,8-,last,odd,even' into 0-based page indexes (order kept)."""
    spec = (spec or "").strip().lower()
    if not spec or spec == "all":
        if default_all:
            return list(range(count))
        raise ToolError("Please enter which pages to use (e.g. 1,3-5).")
    result: list[int] = []
    for part in re.split(r"[,\s;]+", spec):
        if not part:
            continue
        if part == "odd":
            result += list(range(0, count, 2)); continue
        if part == "even":
            result += list(range(1, count, 2)); continue
        part = part.replace("last", str(count)).replace("end", str(count))
        m = re.fullmatch(r"(\d*)\s*-\s*(\d*)", part)
        try:
            if m:
                a = int(m.group(1)) if m.group(1) else 1
                b = int(m.group(2)) if m.group(2) else count
                step = 1 if b >= a else -1
                result += [i - 1 for i in range(a, b + step, step)]
            else:
                result.append(int(part) - 1)
        except ValueError:
            raise ToolError(f"Invalid page range: '{part}'")
    bad = [i + 1 for i in result if i < 0 or i >= count]
    if bad:
        raise ToolError(f"Page {bad[0]} does not exist (document has {count} pages).")
    if not result:
        raise ToolError("No pages selected.")
    return result


# ---------------------------------------------------------------- fonts
WIN_FONTS = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"
FONT_FILES = {
    "arial": "arial.ttf", "arial-bold": "arialbd.ttf",
    "times": "times.ttf", "times-bold": "timesbd.ttf",
    "georgia": "georgia.ttf", "georgia-bold": "georgiab.ttf",
    "verdana": "verdana.ttf", "verdana-bold": "verdanab.ttf",
    "script": "segoesc.ttf", "script-bold": "segoescb.ttf",
    "handwriting": "Inkfree.ttf", "handwriting-bold": "Inkfree.ttf",
    "indic": "Nirmala.ttc", "indic-bold": "Nirmala.ttc",
    "segoe": "segoeui.ttf", "segoe-bold": "segoeuib.ttf",
    "symbol": "seguisym.ttf", "symbol-bold": "seguisym.ttf",
}
BASE14 = {
    "helv": ("helv", "hebo"), "tiro": ("tiro", "tibo"), "cour": ("cour", "cobo"),
}


def resolve_font(name: str, bold: bool, text: str = "") -> dict:
    """Return kwargs (fontname/fontfile) for insert_text & friends."""
    name = (name or "helv").lower()
    # base14 fonts only cover Latin-1; switch to a Unicode font if needed
    if name in BASE14 and any(ord(c) > 0xFF for c in text):
        name = "indic" if any(0x0900 <= ord(c) <= 0x0DFF for c in text) else "arial"
    if name in BASE14:
        return {"fontname": BASE14[name][1 if bold else 0]}
    fn = FONT_FILES.get(f"{name}-bold" if bold else name) or FONT_FILES.get(name)
    if fn and (WIN_FONTS / fn).exists():
        return {"fontname": f"F_{name}_{int(bold)}", "fontfile": str(WIN_FONTS / fn)}
    return {"fontname": "hebo" if bold else "helv"}


def font_object(kw: dict) -> fitz.Font:
    if "fontfile" in kw:
        return fitz.Font(fontfile=kw["fontfile"])
    return fitz.Font(kw["fontname"])


def hex_color(value: str | None, default=(0, 0, 0)):
    if not value:
        return default
    v = value.lstrip("#")
    if len(v) == 3:
        v = "".join(c * 2 for c in v)
    try:
        return tuple(int(v[i:i + 2], 16) / 255 for i in (0, 2, 4))
    except ValueError:
        return default


def to_bool(v) -> bool:
    return v in (True, 1, "1", "true", "on", "yes")


def to_float(v, default: float) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def to_int(v, default: int) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return default


def visual_rect(page: fitz.Page, r: fitz.Rect) -> fitz.Rect:
    """Unrotated (PDF) rect -> rect as the user sees the page."""
    return fitz.Rect(r) * page.rotation_matrix


def pdf_rect(page: fitz.Page, r: fitz.Rect) -> fitz.Rect:
    """Rect as the user sees the page -> unrotated PDF coordinates."""
    return fitz.Rect(r) * page.derotation_matrix


def pdf_point(page: fitz.Page, p) -> fitz.Point:
    return fitz.Point(p) * page.derotation_matrix


def human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024
    return str(n)
