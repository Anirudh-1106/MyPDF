"""Flask web server that powers both the desktop window and the phone web-app."""
from __future__ import annotations

import io
import json
import secrets
import shutil
import socket
import threading
import time
import traceback
import uuid
import zipfile
from pathlib import Path

import pymupdf as fitz
from flask import Flask, abort, jsonify, make_response, redirect, request, send_file, send_from_directory
from werkzeug.utils import secure_filename

from . import convert, ocr, pdf_tools, scanner  # noqa: F401  (registers tools)
from .core import IMAGE_EXT, TOOLS, ToolError, ext, open_pdf
from .job import Job

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "static"
DATA = ROOT / "data"
WORK = DATA / "work"      # uploads per job
OUT = DATA / "out"        # results per job
STORE = DATA / "store"    # opened documents / scans (by id)
for d in (WORK, OUT, STORE):
    d.mkdir(parents=True, exist_ok=True)

KEEP_HOURS = 6
CONFIG_FILE = DATA / "config.json"


def load_config() -> dict:
    try:
        cfg = json.loads(CONFIG_FILE.read_text())
    except Exception:  # noqa: BLE001
        cfg = {}
    if not cfg.get("key"):
        cfg["key"] = secrets.token_urlsafe(9)
        CONFIG_FILE.write_text(json.dumps(cfg, indent=2))
    return cfg


CONFIG = load_config()
app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024 * 1024  # 1 GB
PORT = {"value": 8765}


# ------------------------------------------------------------------ housekeeping
def cleanup():
    cutoff = time.time() - KEEP_HOURS * 3600
    for base in (WORK, OUT, STORE):
        for d in base.iterdir():
            try:
                if d.stat().st_mtime < cutoff:
                    shutil.rmtree(d, ignore_errors=True) if d.is_dir() else d.unlink()
            except OSError:
                pass


def _cleanup_loop():
    while True:
        cleanup()
        time.sleep(1800)


threading.Thread(target=_cleanup_loop, daemon=True).start()


def lan_ips() -> list[str]:
    ips = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ips.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ips and not ip.startswith("127.") and not ip.startswith("169.254"):
                ips.append(ip)
    except OSError:
        pass
    return ips


# ------------------------------------------------------------------ access control
def _is_local() -> bool:
    return request.remote_addr in ("127.0.0.1", "::1")


@app.before_request
def guard():
    if _is_local():
        return None
    # Result downloads are capability URLs (random 64-bit job id, deleted after a few hours), so they
    # work without the cookie - Android's download manager often fetches files without the page's cookies.
    if request.path.startswith("/api/download/"):
        return None
    # Browsers fetch the web-app manifest and its icons WITHOUT cookies; they hold nothing private.
    if request.path in ("/manifest.webmanifest", "/MyPDF.apk") or request.path.startswith("/icons/"):
        return None
    key = CONFIG["key"]
    if request.args.get("key") == key:
        if request.path == "/" or request.method == "GET" and not request.path.startswith("/api"):
            resp = redirect(request.path)
            resp.set_cookie("mypdf_key", key, max_age=3600 * 24 * 365, samesite="Lax")
            return resp
        return None
    if request.cookies.get("mypdf_key") == key:
        return None
    if request.path.startswith("/api"):
        return jsonify(error="Not authorised. Scan the QR code shown in the desktop app again."), 403
    return make_response(
        "<html><body style='font-family:sans-serif;padding:24px'><h2>MyPDF</h2>"
        "<p>Open <b>Connect phone</b> in MyPDF on your computer and scan the QR code to use the app here.</p>"
        "</body></html>", 403)


# ------------------------------------------------------------------ static / PWA
@app.route("/")
def index():
    resp = send_from_directory(STATIC, "index.html")
    resp.headers["Cache-Control"] = "no-cache"
    return resp


@app.route("/MyPDF.apk")
def android_apk():
    apk = ROOT / "android" / "MyPDF.apk"
    if not apk.exists():
        abort(404)
    return send_file(apk, mimetype="application/vnd.android.package-archive", as_attachment=True,
                     download_name="MyPDF.apk")


@app.route("/<path:name>")
def static_files(name):
    if not (STATIC / name).is_file():
        abort(404)
    resp = send_from_directory(STATIC, name)
    if name in ("sw.js", "app.js", "style.css", "manifest.webmanifest"):
        resp.headers["Cache-Control"] = "no-cache"
    return resp


# ------------------------------------------------------------------ helpers
def _save_uploads(job_dir: Path) -> tuple[list[Path], dict[str, Path]]:
    files, assets = [], {}
    for i, f in enumerate(request.files.getlist("files")):
        if not f.filename:
            continue
        name = secure_filename(f.filename) or f"file{i}"
        if "." not in name and "." in f.filename:
            name += Path(f.filename).suffix.lower()
        # keep a readable original stem for output names (unicode kept)
        orig = Path(f.filename).name
        safe_orig = "".join(c for c in orig if c not in '<>:"/\\|?*') or name
        p = job_dir / f"{i:03d}__{safe_orig}"
        f.save(p)
        files.append(p)
    for key, f in request.files.items(multi=True):
        if key == "files" or not f.filename:
            continue
        p = job_dir / f"asset_{secure_filename(key)}{Path(f.filename).suffix.lower() or '.png'}"
        f.save(p)
        assets[key] = p
    return files, assets


def _file_entry(job_id: str, p: Path) -> dict:
    return {"name": p.name, "size": p.stat().st_size, "url": f"/api/download/{job_id}/{p.name}"}


def _err(e: Exception):
    if isinstance(e, ToolError):
        return jsonify(error=str(e), code=e.code), 400
    traceback.print_exc()
    return jsonify(error=f"Something went wrong: {e}", code="error"), 500


# ------------------------------------------------------------------ API
@app.get("/api/status")
def status():
    return jsonify(version="1.0.0", tools=sorted(TOOLS), office=convert.office_available(),
                   local=_is_local())


@app.post("/api/run/<name>")
def run_tool(name):
    fn = TOOLS.get(name)
    if not fn:
        return jsonify(error=f"Unknown tool {name}"), 404
    job_id = uuid.uuid4().hex[:16]
    in_dir, out_dir = WORK / job_id, OUT / job_id
    in_dir.mkdir(parents=True)
    out_dir.mkdir(parents=True)
    try:
        opts = json.loads(request.form.get("options") or "{}")
        files, assets = _save_uploads(in_dir)
        job = Job(files=files, opts=opts, out_dir=out_dir, assets=assets, store_dir=STORE)
        t0 = time.time()
        result = fn(job)
        if isinstance(result, dict):
            shutil.rmtree(out_dir, ignore_errors=True)
            return jsonify(info=result)
        outs = [p for p in result if p and Path(p).exists()]
        for p in out_dir.iterdir():  # drop temp files
            if p.name.startswith("_") and p not in outs:
                shutil.rmtree(p, ignore_errors=True) if p.is_dir() else p.unlink(missing_ok=True)
        resp = {"job": job_id, "files": [_file_entry(job_id, p) for p in outs],
                "message": job.message, "seconds": round(time.time() - t0, 1)}
        if len(outs) > 1:
            zname = f"{name}_results.zip"
            with zipfile.ZipFile(out_dir / zname, "w", zipfile.ZIP_DEFLATED) as z:
                for p in outs:
                    z.write(p, p.name)
            resp["zip"] = _file_entry(job_id, out_dir / zname)
        return jsonify(resp)
    except Exception as e:  # noqa: BLE001
        shutil.rmtree(out_dir, ignore_errors=True)
        return _err(e)
    finally:
        shutil.rmtree(in_dir, ignore_errors=True)


@app.get("/api/download/<job_id>/<path:name>")
def download(job_id, name):
    if not job_id.isalnum():
        abort(404)
    p = (OUT / job_id / name).resolve()
    if not p.is_file() or OUT.resolve() not in p.parents:
        abort(404)
    inline = request.args.get("inline") == "1"
    return send_file(p, as_attachment=not inline, download_name=p.name)


@app.post("/api/open")
def open_doc():
    """Store a document (any format -> PDF) for the visual tools; returns page sizes."""
    f = request.files.get("file")
    doc_id = request.form.get("doc")
    pw = request.form.get("password") or None
    try:
        if f:
            doc_id = uuid.uuid4().hex[:16]
            d = STORE / doc_id
            d.mkdir()
            raw = d / f"raw{Path(f.filename).suffix.lower() or '.pdf'}"
            f.save(raw)
        elif doc_id and (STORE / doc_id).is_dir():
            d = STORE / doc_id
            raw = next(d.glob("raw.*"))
        else:
            raise ToolError("No file uploaded.")
        if ext(raw) in IMAGE_EXT:
            doc = convert.images_to_pdf_doc([raw], {"page_size": "fit"})
        elif ext(raw) in {".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".odt", ".rtf"}:
            tmp = d / "conv.pdf"
            convert.office_to_pdf_file(raw, tmp)
            doc = fitz.open(tmp)
        else:
            try:
                doc = open_pdf(raw, pw)
            except ToolError as e:
                if e.code == "needs_password":
                    return jsonify(error=str(e), code="needs_password", doc=doc_id), 400
                raise
        target = d / "doc.pdf"
        doc.save(str(target), garbage=1, encryption=fitz.PDF_ENCRYPT_NONE)
        pages = [{"w": p.rect.width, "h": p.rect.height} for p in doc]
        return jsonify(doc=doc_id, name=Path(f.filename).name if f else "document.pdf", pages=pages,
                       fields=len([w for p in doc for w in p.widgets()]))
    except Exception as e:  # noqa: BLE001
        return _err(e)


def _store_doc(doc_id: str) -> Path:
    if not doc_id.isalnum():
        abort(404)
    p = STORE / doc_id / "doc.pdf"
    if not p.exists():
        abort(404)
    return p


@app.get("/api/doc/<doc_id>/page/<int:pno>")
def page_image(doc_id, pno):
    p = _store_doc(doc_id)
    w = max(60, min(int(request.args.get("w", 300)), 2400))
    cache = p.parent / f"p{pno}_{w}.img"
    if not cache.exists():
        try:
            cache.write_bytes(pdf_tools.thumbnail(p, pno, w))
        except (IndexError, ValueError):
            abort(404)
    resp = send_file(cache, mimetype="image/jpeg" if w > 400 else "image/png")
    resp.headers["Cache-Control"] = "max-age=3600"
    return resp


@app.get("/api/doc/<doc_id>/lines/<int:pno>")
def page_lines(doc_id, pno):
    return jsonify(lines=pdf_tools.page_lines(_store_doc(doc_id), pno))


@app.get("/api/doc/<doc_id>/fields")
def doc_fields(doc_id):
    return jsonify(fields=pdf_tools.form_fields(_store_doc(doc_id)))


@app.post("/api/scan/detect")
def scan_detect():
    f = request.files.get("file")
    if not f:
        return jsonify(error="No image"), 400
    try:
        sid = uuid.uuid4().hex[:16]
        d = STORE / sid
        d.mkdir()
        raw = d / f"raw{Path(f.filename).suffix.lower() or '.jpg'}"
        f.save(raw)
        img_path = d / "doc.jpg"
        w, h = scanner.prepare_upload(raw, img_path)
        raw.unlink(missing_ok=True)
        corners, found = scanner.detect_corners(scanner.read_bgr(img_path))
        prev = d / "preview.jpg"
        from PIL import Image
        im = Image.open(img_path)
        im.thumbnail((1000, 1000))
        im.save(prev, "JPEG", quality=80)
        return jsonify(id=sid, corners=corners, found=found, w=w, h=h, preview=f"/api/scan/{sid}/preview.jpg")
    except Exception as e:  # noqa: BLE001
        return _err(e)


@app.get("/api/scan/<sid>/preview.jpg")
def scan_original(sid):
    if not sid.isalnum():
        abort(404)
    p = STORE / sid / "preview.jpg"
    if not p.exists():
        abort(404)
    return send_file(p, mimetype="image/jpeg")


@app.post("/api/scan/render")
def scan_render():
    data = request.get_json(force=True)
    sid = data.get("id", "")
    if not sid.isalnum() or not (STORE / sid / "doc.jpg").exists():
        return jsonify(error="Scan expired, please add the photo again."), 404
    try:
        jpg = scanner.preview_jpeg(STORE / sid / "doc.jpg", data.get("corners") if data.get("crop", True) else None,
                                   data.get("filter", "magic"), int(data.get("rotate", 0)))
        return send_file(io.BytesIO(jpg), mimetype="image/jpeg")
    except Exception as e:  # noqa: BLE001
        return _err(e)


@app.post("/api/ocr/image")
def ocr_quick():
    """Quick OCR of one image -> text (used by 'Image to text')."""
    f = request.files.get("file")
    if not f:
        return jsonify(error="No image"), 400
    tmp = WORK / f"ocr_{uuid.uuid4().hex[:10]}{Path(f.filename).suffix.lower() or '.jpg'}"
    f.save(tmp)
    try:
        return jsonify(text=ocr.ocr_image_text(tmp))
    except Exception as e:  # noqa: BLE001
        return _err(e)
    finally:
        tmp.unlink(missing_ok=True)


@app.get("/api/connect")
def connect_info():
    import qrcode
    import qrcode.image.svg
    port = PORT["value"]
    urls = [f"http://{ip}:{port}/?key={CONFIG['key']}" for ip in lan_ips()]
    qrs = []
    for u in urls:
        img = qrcode.make(u, image_factory=qrcode.image.svg.SvgPathImage, box_size=12, border=2)
        buf = io.BytesIO(); img.save(buf)
        qrs.append(buf.getvalue().decode())
    return jsonify(urls=urls, qrs=qrs, local=_is_local())


@app.post("/api/connect/reset")
def reset_key():
    if not _is_local():
        abort(403)
    CONFIG["key"] = secrets.token_urlsafe(9)
    CONFIG_FILE.write_text(json.dumps(CONFIG, indent=2))
    return connect_info()


def output_path(job_id: str, name: str) -> Path | None:
    p = (OUT / job_id / name).resolve()
    return p if p.is_file() and OUT.resolve() in p.parents else None
