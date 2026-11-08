# MyPDF — PDF & Document Toolkit

A private, all-in-one PDF and document app that runs on **your own computer**. You use it as a
**desktop app**, and also on your **phone** (over your home Wi-Fi), where you can install it to the home screen.
Your files never go to the internet.

## Download

| Platform | Download | How to install |
|---|---|---|
| 📱 **Android** | [**Download MyPDF.apk**](https://github.com/Anirudh-1106/MyPDF/raw/main/android/MyPDF.apk) | Open the APK on your phone and allow *install unknown apps* if asked. Works fully offline. |
| 💻 **Windows** | [**Download MyPDF for Windows (.zip)**](https://github.com/Anirudh-1106/MyPDF/archive/refs/heads/main.zip) | Extract the zip, then double-click **`setup.bat`** (needs [Python 3.10+](https://www.python.org/downloads/)). Afterwards open MyPDF from the Desktop shortcut. |

## Start

| What | How |
|---|---|
| First-time setup | Double-click **`setup.bat`** (creates `venv\`, installs everything, adds a Desktop + Start-menu shortcut) |
| Open the app | Double-click the **MyPDF** shortcut, or **`MyPDF.bat`** |
| Open in your web browser instead | `venv\Scripts\python main.py --browser` |
| Server only (no window) | `venv\Scripts\python main.py --server` |
| Disable phone access | `venv\Scripts\python main.py --local-only` |

Everything is installed inside `venv\`, so nothing touches your other Python projects.
You can delete the folder to uninstall everything.

## Android app (works on its own, offline)

The Android app (`android\MyPDF.apk`) contains the **whole toolkit**: it runs on the phone itself, with no laptop,
no Wi-Fi and no internet needed. Your files never leave the phone.

- **Install:** copy `android\MyPDF.apk` to the phone (USB, Google Drive, WhatsApp to yourself…) and open it. Allow
  *install unknown apps* if asked. Installing over the older version keeps working.
- Results are saved to **Downloads/MyPDF**. **Share** sends them to WhatsApp, Drive and other apps, and MyPDF appears in
  Android's **Share** menu so you can send PDFs and photos into it.
- How it works: the same interface, with the PDF engine running inside the app (MuPDF compiled to WebAssembly), the
  scanner on OpenCV.js, and text recognition (OCR) by Google ML Kit, all bundled in the APK.
- Differences from the laptop version: Word/Excel/PowerPoint conversions use the built-in engine (DOCX, XLSX, PPTX
  only; complex layouts may differ slightly), PDF → Word turns pages into simple paragraphs, and OCR reads
  Latin-alphabet text (English etc.).

Rebuild the Android app after changing it: `android\build_apk.bat` (needs Node.js, Android Studio + JDK 17).
The phone engine's code is in `phone\` (`phone\test\run.mjs` runs every tool on test files with Node).

## Use the laptop version from a phone browser (optional)

Start MyPDF on the laptop, click **Connect phone** and scan the QR code (same Wi-Fi). The QR code holds a secret key,
so other people on your Wi-Fi can't use it. **iPhone:** Safari → Share → *Add to Home Screen*.

## Features

**Organize:** visual page organizer (drag to reorder, rotate, delete, duplicate, blank pages, combine files), merge, split
(every page / ranges / every N / in half / by size), remove, extract, rotate, insert blank pages, reverse, crop (margins or
auto-trim white space), N-up (2/4/6/8/9 pages per sheet).

**Edit & sign:** full visual editor (**edit existing text**, add text in many fonts including Indian scripts, images,
signatures, freehand drawing, highlight, white-out, real redaction, rectangles, ellipses, lines, check marks, links, undo,
copy to all pages). **Sign** by drawing, typing or uploading a signature, with background removal and saved signatures.
Also: fill PDF forms, watermark (text/logo, tiled), page numbers, header & footer, bookmarks, metadata.

**Convert from PDF:** Word (standard engine or Microsoft Word), Excel (detects tables), PowerPoint, JPG/PNG/WEBP/TIFF,
one long image (for chat apps), text, Markdown, HTML, EPUB, extract embedded images.

**Convert to PDF:** anything → PDF (Word, Excel, PowerPoint via MS Office; images including iPhone HEIC; text; Markdown;
HTML; CSV; EPUB/XPS), images → PDF, typed text → PDF.

**Scan & OCR:** camera document scanner with automatic edge detection, draggable corners, perspective correction, shadow
removal and filters (auto-clean, color, grayscale, black & white) → PDF or images. OCR turns scans into
**searchable PDFs**, text or Word. Image → text, with a copy button.

**Security:** password-protect (AES-256, print/copy permissions), unlock, redact (words + presets for emails, phones,
Aadhaar, PAN, card numbers, dates, links), sanitize hidden data.

**Optimize:** compress (4 levels, or **a target size in KB** for upload limits), grayscale, flatten, repair.

**Images:** convert / resize / compress images, including "make it under 50 KB" for application forms.

**More:** PDF info, compare two PDFs (text diff report plus visual differences), "Continue with another tool" chaining,
password prompts, drag & drop anywhere, dark mode.

## Notes

- **Office → PDF** uses your installed Microsoft Office (or LibreOffice if present). If Office shows a first-run, sign-in or
  activation prompt, open Word/Excel/PowerPoint once yourself and close it. MyPDF stops a stuck conversion after 3 minutes.
- **OCR** uses RapidOCR (bundled; no Tesseract needed) and works best on English/Latin text. The first OCR takes a few
  extra seconds to load.
- Temporary files are kept in `data\` and deleted automatically after 6 hours.
- Live camera inside the page needs a secure page (desktop app / localhost). On phones, **Take photo** opens the normal
  camera app instead, which works everywhere.

## Project layout

```
main.py              launcher (desktop window via pywebview + Wi-Fi server via waitress)
mypdf/server.py      Flask API, phone access key, file storage & cleanup
mypdf/pdf_tools.py   organize / edit / security / optimize / info / compare
mypdf/convert.py     to/from PDF conversions, image tools
mypdf/scanner.py     document detection, perspective fix, filters
mypdf/ocr.py         OCR + searchable text layer
mypdf/office_worker.py  MS Office automation in a separate, time-limited process
static/              the app UI (HTML/CSS/JS, PWA manifest, service worker, icons)
phone/               on-device engine for the Android app (MuPDF.js tools, scanner, workers) + build.mjs + tests
android/             MyPDF Android app (bundles static/ + phone/, ML Kit OCR, downloads, share) -> android/MyPDF.apk
```
