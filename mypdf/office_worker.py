"""Runs one MS Office conversion in its own process (so a hung Office can be killed).

    python -m mypdf.office_worker <to-pdf|pdf-to-docx> <src> <out>
"""
from __future__ import annotations

import sys
from pathlib import Path

WORD_EXT = {".doc", ".docx", ".odt", ".rtf", ".txt"}
EXCEL_EXT = {".xls", ".xlsx", ".ods", ".csv"}
PPT_EXT = {".ppt", ".pptx", ".odp"}


def main(mode: str, src: str, out: str) -> int:
    import pythoncom
    import win32com.client
    pythoncom.CoInitialize()
    e = Path(src).suffix.lower()
    app = None
    try:
        if mode == "pdf-to-docx" or e in WORD_EXT:
            app = win32com.client.DispatchEx("Word.Application")
            app.Visible = False
            app.DisplayAlerts = 0
            try:
                app.Options.DoNotPromptForConvert = True
                app.Options.ConfirmConversions = False
            except Exception:  # noqa: BLE001
                pass
            d = app.Documents.Open(src, ConfirmConversions=False, ReadOnly=True, AddToRecentFiles=False,
                                   Visible=False, OpenAndRepair=False, NoEncodingDialog=True)
            if mode == "pdf-to-docx":
                d.SaveAs2(out, FileFormat=16)
            else:
                d.ExportAsFixedFormat(out, 17)
            d.Close(False)
        elif e in EXCEL_EXT:
            app = win32com.client.DispatchEx("Excel.Application")
            app.Visible = False
            app.DisplayAlerts = False
            wb = app.Workbooks.Open(src, ReadOnly=True, UpdateLinks=0)
            wb.ExportAsFixedFormat(0, out)
            wb.Close(False)
        elif e in PPT_EXT:
            app = win32com.client.DispatchEx("PowerPoint.Application")
            pres = app.Presentations.Open(src, ReadOnly=True, Untitled=False, WithWindow=False)
            pres.SaveAs(out, 32)
            pres.Close()
        else:
            print(f"Unsupported file type {e}", file=sys.stderr)
            return 2
    finally:
        try:
            if app is not None:
                app.Quit()
        except Exception:  # noqa: BLE001
            pass
        pythoncom.CoUninitialize()
    return 0 if Path(out).exists() else 1


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:4]))
