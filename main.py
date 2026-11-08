"""MyPDF launcher.

    python main.py            -> desktop window (and phone access over Wi-Fi)
    python main.py --browser  -> open in your default browser instead of a window
    python main.py --server   -> server only (no window), e.g. to use from phone
"""
from __future__ import annotations

import argparse
import os
import shutil
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path

from waitress import serve

from mypdf import server


def free_port(preferred: int) -> int:
    for port in [preferred] + list(range(preferred + 1, preferred + 20)):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("0.0.0.0", port))
                return port
            except OSError:
                continue
    raise SystemExit("No free port found")


def run_server(host: str, port: int):
    server.PORT["value"] = port
    serve(server.app, host=host, port=port, threads=8, channel_timeout=600,
          max_request_body_size=1024 * 1024 * 1024, ident="MyPDF")


def wait_ready(port: int, timeout=15):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.1)
    return False


class DesktopApi:
    """Functions callable from the page as window.pywebview.api.* (desktop only)."""

    def __init__(self):
        self._window = None

    def save_file(self, job_id: str, name: str):
        import webview
        src = server.output_path(job_id, name)
        if not src:
            return {"ok": False, "error": "File not found"}
        downloads = Path.home() / "Downloads"
        res = self._window.create_file_dialog(webview.FileDialog.SAVE, directory=str(downloads), save_filename=name)
        if not res:
            return {"ok": False, "cancelled": True}
        dest = Path(res if isinstance(res, str) else res[0])
        if not dest.suffix:
            dest = dest.with_suffix(src.suffix)
        shutil.copy(src, dest)
        return {"ok": True, "path": str(dest)}

    def open_file(self, job_id: str, name: str):
        src = server.output_path(job_id, name)
        if src:
            os.startfile(str(src)) if sys.platform == "win32" else webbrowser.open(src.as_uri())
        return {"ok": bool(src)}

    def reveal(self, path: str):
        p = Path(path)
        if sys.platform == "win32" and p.exists():
            import subprocess
            subprocess.Popen(["explorer", "/select,", str(p)])
        return {"ok": True}


def main():
    ap = argparse.ArgumentParser(description="MyPDF")
    ap.add_argument("--browser", action="store_true", help="open in the default browser")
    ap.add_argument("--server", action="store_true", help="run the server only")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--local-only", action="store_true", help="don't allow phones on the network")
    a = ap.parse_args()

    host = "127.0.0.1" if a.local_only else "0.0.0.0"
    port = free_port(a.port)
    url = f"http://127.0.0.1:{port}/"
    print(f"MyPDF running at {url}")
    for ip in server.lan_ips():
        print(f"  Phone (same Wi-Fi): http://{ip}:{port}/?key={server.CONFIG['key']}")

    if a.server:
        run_server(host, port)
        return
    threading.Thread(target=run_server, args=(host, port), daemon=True).start()
    wait_ready(port)
    if a.browser:
        webbrowser.open(url)
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            return
    try:
        import webview
    except ImportError:
        webbrowser.open(url)
        while True:
            time.sleep(3600)
    api = DesktopApi()
    icons = Path(__file__).parent / "static" / "icons"
    icon = icons / ("icon.ico" if sys.platform == "win32" else "icon-512.png")
    win = webview.create_window("MyPDF - PDF & Document Toolkit", url, js_api=api, width=1280, height=840,
                                min_size=(380, 560), text_select=True)
    api._window = win
    webview.settings["ALLOW_DOWNLOADS"] = True
    webview.start(private_mode=False, storage_path=str(Path(__file__).parent / "data" / "webview"),
                  icon=str(icon) if icon.exists() else None)


if __name__ == "__main__":
    main()
