/* MyPDF front-end — works in the desktop window and on phones. */
"use strict";

// ------------------------------------------------------------------ icons
const IC = {
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5",
  merge: "M7 3v5l5 5 5-5V3 M12 13v8",
  split: "M12 3v7l-6 5v6 M12 10l6 5v6",
  trash: "M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3",
  extract: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M12 11v6 M9 14l3 3 3-3",
  rotate: "M21 12a9 9 0 1 1-3-6.7L21 8 M21 3v5h-5",
  rotl: "M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5",
  plus: "M12 5v14 M5 12h14",
  swap: "M7 4v16 M3 8l4-4 4 4 M17 20V4 M13 16l4 4 4-4",
  crop: "M6 2v14a2 2 0 0 0 2 2h14 M2 6h14a2 2 0 0 1 2 2v14",
  grid: "M3 3h8v8H3z M13 3h8v8h-8z M3 13h8v8H3z M13 13h8v8h-8z",
  pen: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  sign: "M3 17c3-3 5-9 7-9s-1 9 1 9 3-4 4-4 1 3 3 3 M3 21h18",
  form: "M4 4h16v16H4z M8 9h8 M8 13h8 M8 17h5",
  drop: "M12 2.7l5.7 5.7a8 8 0 1 1-11.4 0z",
  hash: "M4 9h16 M4 15h16 M10 3L8 21 M16 3l-2 18",
  header: "M4 4h16v16H4z M4 8.5h16 M4 15.5h16",
  redact: "M4 6h16v4H4z M4 14h10v4H4z",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01",
  word: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M8 12l1.5 6 2.5-5 2.5 5L16 12",
  excel: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 12l6 7 M15 12l-6 7",
  ppt: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M10 19v-7h2.5a2 2 0 0 1 0 4H10",
  image: "M3 3h18v18H3z M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M21 15l-5-5L5 21",
  text: "M4 7V4h16v3 M9 20h6 M12 4v16",
  code: "M8 6l-6 6 6 6 M16 6l6 6-6 6",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z M4 19.5V22h16",
  images: "M7 7h14v14H7z M3 17V3h14",
  scan: "M3 7V3h4 M17 3h4v4 M21 17v4h-4 M7 21H3v-4 M7 12h10",
  ocr: "M3 7V3h4 M17 3h4v4 M21 17v4h-4 M7 21H3v-4 M8 9h8 M8 12h8 M8 15h5",
  lock: "M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4",
  unlock: "M5 11h14v10H5z M8 11V7a4 4 0 0 1 7.5-2",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
  compress: "M4 14h6v6 M20 10h-6V4 M14 10l7-7 M3 21l7-7",
  contrast: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 2v20",
  layers: "M12 2l10 5-10 5L2 7z M2 17l10 5 10-5 M2 12l10 5 10-5",
  wrench: "M14.7 6.3a4 4 0 0 0 5 5L22 14l-8 8-2.3-2.3a4 4 0 0 0-5-5L2 10l8-8z",
  compare: "M5 3h6v18H5z M13 3h6v18h-6z",
  camera: "M3 7h4l2-3h6l2 3h4v13H3z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  download: "M12 3v12 M7 10l5 5 5-5 M5 21h14",
  upload: "M12 21V9 M7 14l5-5 5 5 M5 3h14",
  x: "M6 6l12 12 M18 6L6 18",
  back: "M15 18l-6-6 6-6", next: "M9 18l6-6-6-6",
  copy: "M9 9h12v12H9z M5 15H3V3h12v2",
  open: "M14 3h7v7 M21 3l-9 9 M19 14v7H3V5h7",
  check: "M5 12l5 5L20 7",
  pointer: "M4 4l7 17 2-7 7-2z",
  square: "M4 4h16v16H4z",
  circle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  line: "M5 19L19 5",
  highlight: "M9 11l-6 6v3h9l3-3 M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4",
  eraser: "M20 20H7L3 16l10-10 7 7-6 6 M6 11l7 7",
  draw: "M3 17c2-4 4-6 6-6s2 6 4 6 4-8 8-8",
  undo: "M9 14L4 9l5-5 M4 9h11a5 5 0 0 1 0 10h-3",
  grip: "M9 6h.01 M9 12h.01 M9 18h.01 M15 6h.01 M15 12h.01 M15 18h.01",
  move: "M5 9l-3 3 3 3 M9 5l3-3 3 3 M15 19l-3 3-3-3 M19 9l3 3-3 3 M2 12h20 M12 2v20",
  edittext: "M4 7V4h16v3 M9 20h6 M12 4v16 M17 14l4 4",
  link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7 M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  tick: "M4 12l5 5L20 6",
  epub: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z M4 19.5V22h16 M9 7h7",
  long: "M7 2h10v20H7z M7 8h10 M7 14h10",
  star: "M12 2l3 7 7 .7-5.3 4.7L18 22l-6-3.6L6 22l1.3-7.6L2 9.7 9 9z",
  zoomin: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3 M11 8v6 M8 11h6",
  zoomout: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3 M8 11h6",
  share: "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M8.6 13.5l6.8 4 M15.4 6.5l-6.8 4",
  phone: "M7 2h10v20H7z M11 18h2",
};
const icon = (n, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24"><path d="${IC[n] || IC.file}"/></svg>`;

// ------------------------------------------------------------------ catalog
const CATS = {
  organize: ["Organize", "var(--c-organize)"],
  edit: ["Edit & Sign", "var(--c-edit)"],
  from: ["Convert from PDF", "var(--c-from)"],
  to: ["Convert to PDF", "var(--c-to)"],
  scan: ["Scan & OCR", "var(--c-scan)"],
  secure: ["Security", "var(--c-secure)"],
  optimize: ["Optimize", "var(--c-optimize)"],
  image: ["Images", "var(--c-image)"],
  other: ["More", "var(--c-other)"],
};
const PDF = ".pdf,application/pdf";
const IMG = "image/*,.heic,.heif,.webp,.tif,.tiff,.bmp";
const PAGES = { k: "pages", label: "Pages", type: "text", ph: "all  (e.g. 1,3-5,8-)", hint: "Leave empty for all pages. Use odd / even / last too." };
const POS = [["top-left", "Top left"], ["top-center", "Top center"], ["top-right", "Top right"], ["bottom-left", "Bottom left"], ["bottom-center", "Bottom center"], ["bottom-right", "Bottom right"]];
const FONTS = [["helv", "Helvetica"], ["tiro", "Times"], ["cour", "Courier"], ["arial", "Arial"], ["georgia", "Georgia"], ["verdana", "Verdana"], ["script", "Segoe Script"], ["handwriting", "Ink Free"], ["indic", "Nirmala (Indian scripts)"]];

const TOOLS = [
  // organize
  { id: "organize", cat: "organize", icon: "grid", name: "Organize pages", desc: "Reorder, rotate, delete, duplicate pages and add pages from other files — visually.", view: "organize", accept: PDF + "," + IMG },
  { id: "merge", cat: "organize", icon: "merge", name: "Merge PDF", desc: "Combine several PDFs and images into one PDF.", accept: PDF + "," + IMG, multiple: true, sortable: true,
    opts: [{ k: "filename", label: "Output file name", type: "text", def: "merged.pdf" }, { k: "bookmarks", label: "Add a bookmark for each file", type: "check", def: true }] },
  { id: "split", cat: "organize", icon: "split", name: "Split PDF", desc: "Split into single pages, by ranges, every N pages or by file size.", accept: PDF,
    opts: [{ k: "mode", label: "Split", type: "seg", def: "each", choices: [["each", "Every page"], ["ranges", "Ranges"], ["every", "Every N"], ["half", "In half"], ["size", "By size"]] },
      { k: "ranges", label: "Ranges (each becomes a file)", type: "text", ph: "1-3, 4-6, 7-", show: o => o.mode === "ranges" },
      { k: "every", label: "Pages per file", type: "number", def: 2, show: o => o.mode === "every" },
      { k: "size_mb", label: "Max size per file (MB)", type: "number", def: 5, show: o => o.mode === "size" }] },
  { id: "remove_pages", cat: "organize", icon: "trash", name: "Remove pages", desc: "Delete the pages you don't need.", accept: PDF,
    opts: [{ ...PAGES, label: "Pages to remove", ph: "e.g. 2, 5-7", hint: "" }] },
  { id: "extract_pages", cat: "organize", icon: "extract", name: "Extract pages", desc: "Pull selected pages into a new PDF.", accept: PDF,
    opts: [{ ...PAGES, label: "Pages to extract", ph: "e.g. 1, 4-6", hint: "" }, { k: "separate", label: "Each page as a separate PDF", type: "check" }] },
  { id: "rotate", cat: "organize", icon: "rotate", name: "Rotate PDF", desc: "Rotate all or some pages.", accept: PDF, multiple: true,
    opts: [{ k: "angle", label: "Rotate", type: "seg", def: "90", choices: [["90", "90° right"], ["180", "180°"], ["270", "90° left"]] }, PAGES] },
  { id: "insert_blank", cat: "organize", icon: "plus", name: "Insert blank pages", desc: "Add empty pages anywhere.", accept: PDF,
    opts: [{ k: "after", label: "Insert after page (0 = at the start)", type: "number", def: 1 }, { k: "count", label: "How many", type: "number", def: 1 }] },
  { id: "reverse", cat: "organize", icon: "swap", name: "Reverse order", desc: "Flip the page order (last page first).", accept: PDF },
  { id: "crop", cat: "organize", icon: "crop", name: "Crop pages", desc: "Trim margins or auto-crop white space.", accept: PDF,
    opts: [{ k: "mode", label: "Mode", type: "seg", def: "auto", choices: [["auto", "Auto (trim white)"], ["margins", "Margins"]] },
      { k: "padding", label: "Padding (mm)", type: "number", def: 5, show: o => o.mode === "auto" },
      { k: "top", label: "Top (mm)", type: "number", def: 10, show: o => o.mode === "margins", half: true }, { k: "bottom", label: "Bottom (mm)", type: "number", def: 10, show: o => o.mode === "margins", half: true },
      { k: "left", label: "Left (mm)", type: "number", def: 10, show: o => o.mode === "margins", half: true }, { k: "right", label: "Right (mm)", type: "number", def: 10, show: o => o.mode === "margins", half: true }, PAGES] },
  { id: "nup", cat: "organize", icon: "grid", name: "Pages per sheet (N-up)", desc: "Print 2, 4, 6, 8 or 9 pages on one sheet to save paper.", accept: PDF,
    opts: [{ k: "per_sheet", label: "Pages per sheet", type: "seg", def: "2", choices: [["2", "2"], ["4", "4"], ["6", "6"], ["8", "8"], ["9", "9"]] }, { k: "borders", label: "Draw borders", type: "check" }] },

  // edit
  { id: "edit", cat: "edit", icon: "pen", name: "Edit PDF", desc: "Edit existing text, add text, images, shapes, drawings, highlights, white-out.", view: "editor", accept: PDF + "," + IMG },
  { id: "sign", cat: "edit", icon: "sign", name: "Sign PDF", desc: "Draw, type or upload your signature and place it on the document.", view: "editor", accept: PDF + "," + IMG, startTool: "sign" },
  { id: "form_fill", cat: "edit", icon: "form", name: "Fill PDF forms", desc: "Fill in interactive form fields and optionally flatten them.", view: "form", accept: PDF },
  { id: "watermark", cat: "edit", icon: "drop", name: "Watermark", desc: "Stamp text or an image (logo) over pages.", accept: PDF, multiple: true,
    opts: [{ k: "kind", label: "Type", type: "seg", def: "text", choices: [["text", "Text"], ["image", "Image / logo"]] },
      { k: "text", label: "Text", type: "text", def: "CONFIDENTIAL", show: o => o.kind !== "image" },
      { k: "image", label: "Image", type: "image", show: o => o.kind === "image" },
      { k: "scale", label: "Image width (% of page)", type: "range", min: 5, max: 100, def: 40, show: o => o.kind === "image" },
      { k: "position", label: "Position", type: "select", def: "center", choices: [["center", "Center"], ["tile", "Tiled (repeat)"], ...POS] },
      { k: "size", label: "Font size", type: "number", def: 60, show: o => o.kind !== "image", half: true },
      { k: "angle", label: "Angle °", type: "number", def: 45, show: o => o.kind !== "image", half: true },
      { k: "color", label: "Color", type: "color", def: "#cc1f1f", show: o => o.kind !== "image", half: true },
      { k: "font", label: "Font", type: "select", def: "helv", choices: FONTS, show: o => o.kind !== "image", half: true },
      { k: "opacity", label: "Opacity", type: "range", min: 0.05, max: 1, step: 0.05, def: 0.25 },
      { k: "on_top", label: "Place over content", type: "check", def: true, show: o => o.kind !== "image" }, PAGES] },
  { id: "page_numbers", cat: "edit", icon: "hash", name: "Page numbers", desc: "Add page numbers in any style and position.", accept: PDF, multiple: true,
    opts: [{ k: "format", label: "Format", type: "select", def: "{n}", choices: [["{n}", "1"], ["Page {n}", "Page 1"], ["Page {n} of {total}", "Page 1 of 9"], ["{n} / {total}", "1 / 9"], ["- {n} -", "- 1 -"], ["{roman}", "i, ii, iii"]] },
      { k: "position", label: "Position", type: "select", def: "bottom-center", choices: POS },
      { k: "start", label: "Start at", type: "number", def: 1, half: true }, { k: "size", label: "Font size", type: "number", def: 11, half: true },
      { k: "font", label: "Font", type: "select", def: "helv", choices: FONTS, half: true }, { k: "color", label: "Color", type: "color", def: "#000000", half: true },
      { k: "mirror", label: "Mirror left/right on even pages (books)", type: "check" }, PAGES] },
  { id: "header_footer", cat: "edit", icon: "header", name: "Header & footer", desc: "Add text to the top/bottom of pages. Use {n}, {total}, {date}, {file}.", accept: PDF, multiple: true,
    opts: [{ k: "header", label: "Header text", type: "text", ph: "e.g. Company name — {date}" }, { k: "header_align", label: "Header alignment", type: "seg", def: "center", choices: [["left", "Left"], ["center", "Center"], ["right", "Right"]] },
      { k: "footer", label: "Footer text", type: "text", ph: "e.g. {file} — page {n} of {total}" }, { k: "footer_align", label: "Footer alignment", type: "seg", def: "center", choices: [["left", "Left"], ["center", "Center"], ["right", "Right"]] },
      { k: "size", label: "Font size", type: "number", def: 10, half: true }, { k: "color", label: "Color", type: "color", def: "#444444", half: true }, { k: "font", label: "Font", type: "select", def: "helv", choices: FONTS }, PAGES] },
  { id: "bookmarks", cat: "edit", icon: "bookmark", name: "Add bookmarks", desc: "Create a clickable table of contents (outline).", accept: PDF,
    opts: [{ k: "toc", label: "Bookmarks — one per line: Title | page (start with - for sub-items)", type: "textarea", ph: "Introduction | 1\n-Background | 2\nResults | 5" },
      { k: "auto", label: "If empty, auto-create from the biggest heading on each page", type: "check", def: true }] },
  { id: "metadata", cat: "edit", icon: "info", name: "Edit metadata", desc: "Change title, author, subject, keywords — or remove them.", accept: PDF,
    opts: [{ k: "title", label: "Title", type: "text" }, { k: "author", label: "Author", type: "text" }, { k: "subject", label: "Subject", type: "text" }, { k: "keywords", label: "Keywords", type: "text" },
      { k: "strip", label: "Remove all metadata instead", type: "check" }] },

  // convert from pdf
  { id: "pdf_to_word", cat: "from", icon: "word", name: "PDF to Word", desc: "Editable DOCX that keeps the layout.", accept: PDF, multiple: true,
    opts: [{ k: "engine", label: "Engine", type: "seg", def: "pdf2docx", choices: [["pdf2docx", "Standard"], ["msword", "Microsoft Word"]], hint: "Standard works everywhere. The Microsoft Word engine needs Word on the computer and may stop with a message if Word shows a prompt." }, PAGES] },
  { id: "pdf_to_excel", cat: "from", icon: "excel", name: "PDF to Excel", desc: "Detects tables and exports them to XLSX sheets.", accept: PDF },
  { id: "pdf_to_pptx", cat: "from", icon: "ppt", name: "PDF to PowerPoint", desc: "Each page becomes a slide (text kept in notes).", accept: PDF,
    opts: [{ k: "dpi", label: "Quality", type: "seg", def: "150", choices: [["100", "Small"], ["150", "Good"], ["220", "High"]] }, { k: "notes", label: "Put page text in speaker notes", type: "check", def: true }] },
  { id: "pdf_to_images", cat: "from", icon: "image", name: "PDF to images", desc: "Export pages as JPG, PNG, WEBP or TIFF.", accept: PDF, cats: ["image"],
    opts: [{ k: "format", label: "Format", type: "seg", def: "jpg", choices: [["jpg", "JPG"], ["png", "PNG"], ["webp", "WEBP"], ["tiff", "TIFF"]] },
      { k: "dpi", label: "Resolution", type: "seg", def: "150", choices: [["72", "72 dpi"], ["150", "150"], ["200", "200"], ["300", "300 (print)"]] }, PAGES] },
  { id: "pdf_to_long_image", cat: "from", icon: "long", name: "PDF to long image", desc: "All pages stitched into one tall image — easy to share on chat apps.", accept: PDF,
    opts: [{ k: "width", label: "Width (px)", type: "number", def: 1200 }, PAGES] },
  { id: "pdf_to_text", cat: "from", icon: "text", name: "PDF to text", desc: "Extract all text to a .txt file.", accept: PDF, multiple: true, opts: [{ k: "page_breaks", label: "Mark page breaks", type: "check" }] },
  { id: "pdf_to_markdown", cat: "from", icon: "code", name: "PDF to Markdown", desc: "Structured Markdown with headings, lists and tables (great for AI tools).", accept: PDF, multiple: true },
  { id: "pdf_to_html", cat: "from", icon: "code", name: "PDF to HTML", desc: "A web page version of the document.", accept: PDF },
  { id: "pdf_to_epub", cat: "from", icon: "epub", name: "PDF to EPUB", desc: "Reflowable e-book for e-readers.", accept: PDF },
  { id: "extract_images", cat: "from", icon: "images", name: "Extract images", desc: "Save every picture embedded in the PDF.", accept: PDF, cats: ["image"],
    opts: [{ k: "min_size", label: "Ignore images smaller than (px)", type: "number", def: 50 }] },

  // convert to pdf
  { id: "to_pdf", cat: "to", icon: "file", name: "Anything to PDF", desc: "Word, Excel, PowerPoint, images, text, Markdown, HTML, EPUB… to PDF.", accept: "*", multiple: true,
    opts: [{ k: "merge", label: "Combine everything into one PDF", type: "check" }] },
  { id: "images_to_pdf", cat: "to", icon: "image", name: "Images to PDF", desc: "JPG, PNG, HEIC (iPhone), WEBP, TIFF to PDF.", accept: IMG, multiple: true, sortable: true, cats: ["image"],
    opts: [{ k: "page_size", label: "Page size", type: "seg", def: "a4", choices: [["fit", "Fit image"], ["a4", "A4"], ["letter", "Letter"], ["legal", "Legal"]] },
      { k: "orientation", label: "Orientation", type: "seg", def: "auto", choices: [["auto", "Auto"], ["portrait", "Portrait"], ["landscape", "Landscape"]], show: o => o.page_size !== "fit" },
      { k: "margin", label: "Margin (mm)", type: "number", def: 0, half: true }, { k: "quality", label: "JPEG quality", type: "number", def: 88, half: true },
      { k: "filename", label: "File name", type: "text", ph: "images.pdf" }, { k: "separate", label: "One PDF per image", type: "check" }] },
  { id: "office_to_pdf", cat: "to", icon: "word", name: "Word / Excel / PPT to PDF", desc: "Convert Office documents using Microsoft Office or LibreOffice.", accept: ".doc,.docx,.odt,.rtf,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.odp", multiple: true },
  { id: "text_to_pdf", cat: "to", icon: "text", name: "Text / Markdown to PDF", desc: "Type or paste text (Markdown supported), or convert .txt/.md/.html files.", accept: ".txt,.md,.markdown,.html,.htm,.csv,.log,.json", multiple: true, optionalFiles: true,
    opts: [{ k: "text", label: "…or type / paste text here (Markdown: # Heading, **bold**, - lists)", type: "textarea", rows: 8 }, { k: "filename", label: "File name", type: "text", ph: "document" },
      { k: "page_size", label: "Page size", type: "seg", def: "a4", choices: [["a4", "A4"], ["letter", "Letter"], ["legal", "Legal"]] }] },

  // scan & ocr
  { id: "scan", cat: "scan", icon: "camera", name: "Scan document", desc: "Use the camera: auto edge detection, perspective fix and clean-up filters → PDF.", view: "scanner" },
  { id: "ocr", cat: "scan", icon: "ocr", name: "OCR — make searchable", desc: "Recognise text in scanned PDFs or photos so you can search & copy it.", accept: PDF + "," + IMG, multiple: true,
    opts: [{ k: "output", label: "Output", type: "seg", def: "pdf", choices: [["pdf", "Searchable PDF"], ["txt", "Text"], ["docx", "Word"], ["both", "PDF + text"]] },
      { k: "force", label: "Force OCR on pages that already have text", type: "check" }, PAGES] },
  { id: "image_to_text", cat: "scan", icon: "text", name: "Image to text", desc: "Snap or pick a photo and copy the text from it instantly.", view: "ocrtext", accept: IMG },

  // security
  { id: "protect", cat: "secure", icon: "lock", name: "Protect PDF", desc: "Add a password (AES-256) and restrict printing/copying.", accept: PDF, multiple: true,
    opts: [{ k: "user_password", label: "Password", type: "password" }, { k: "confirm", label: "Confirm password", type: "password" },
      { k: "allow_print", label: "Allow printing", type: "check", def: true }, { k: "allow_copy", label: "Allow copying text", type: "check", def: true }, { k: "allow_modify", label: "Allow editing", type: "check" },
      { k: "owner_password", label: "Owner password (optional, controls permissions)", type: "password", adv: true }] },
  { id: "unlock", cat: "secure", icon: "unlock", name: "Unlock PDF", desc: "Remove the password from a PDF you have the password for.", accept: PDF, multiple: true,
    opts: [{ k: "password", label: "Current password", type: "password" }] },
  { id: "redact", cat: "secure", icon: "redact", name: "Redact", desc: "Permanently black out words, emails, phone numbers, Aadhaar/PAN, card numbers…", accept: PDF, multiple: true, cats: ["edit"],
    opts: [{ k: "terms", label: "Words / phrases to remove (one per line or comma separated)", type: "textarea", rows: 3 },
      { k: "p_email", label: "Email addresses", type: "check" }, { k: "p_phone", label: "Phone numbers", type: "check" }, { k: "p_aadhaar", label: "Aadhaar numbers", type: "check" },
      { k: "p_pan", label: "PAN numbers", type: "check" }, { k: "p_card", label: "Card / account numbers", type: "check" }, { k: "p_date", label: "Dates", type: "check" }, { k: "p_url", label: "Web links", type: "check" },
      { k: "color", label: "Box color", type: "color", def: "#000000" }, { k: "metadata", label: "Also remove metadata", type: "check", def: true }] },
  { id: "sanitize", cat: "secure", icon: "shield", name: "Sanitize PDF", desc: "Remove hidden data: metadata, JavaScript, attachments, hidden text.", accept: PDF, multiple: true,
    opts: [{ k: "links", label: "Also remove links", type: "check" }] },

  // optimize
  { id: "compress", cat: "optimize", icon: "compress", name: "Compress PDF", desc: "Shrink file size — or hit an exact size limit for uploads.", accept: PDF, multiple: true,
    opts: [{ k: "level", label: "Compression", type: "seg", def: "medium", choices: [["low", "Light"], ["medium", "Recommended"], ["high", "Strong"], ["extreme", "Extreme"]] },
      { k: "target_kb", label: "…or target size in KB (optional)", type: "number", ph: "e.g. 200", hint: "Useful for forms that only accept files under a size limit." },
      { k: "grayscale", label: "Convert images to grayscale", type: "check" }] },
  { id: "grayscale", cat: "optimize", icon: "contrast", name: "Grayscale PDF", desc: "Convert to black & white to save ink.", accept: PDF, multiple: true,
    opts: [{ k: "dpi", label: "Quality", type: "seg", def: "150", choices: [["100", "Small"], ["150", "Good"], ["220", "High"]] }] },
  { id: "flatten", cat: "optimize", icon: "layers", name: "Flatten PDF", desc: "Merge form fields & annotations into the page so they can't be changed.", accept: PDF, multiple: true,
    opts: [{ k: "raster", label: "Convert pages to images (strongest, text not selectable)", type: "check" }] },
  { id: "repair", cat: "optimize", icon: "wrench", name: "Repair PDF", desc: "Fix damaged or corrupted PDF files.", accept: PDF, multiple: true },

  // images
  { id: "image_convert", cat: "image", icon: "image", name: "Resize / compress / convert images", desc: "Change format (JPG, PNG, WEBP…), resize, or shrink to a size limit (e.g. 50 KB).", accept: IMG, multiple: true,
    opts: [{ k: "format", label: "Format", type: "seg", def: "jpg", choices: [["jpg", "JPG"], ["png", "PNG"], ["webp", "WEBP"], ["same", "Keep"]] },
      { k: "target_kb", label: "Max file size in KB (optional)", type: "number", ph: "e.g. 50", hint: "Common for photo/signature uploads on application forms." },
      { k: "max_width", label: "Max width (px)", type: "number", half: true }, { k: "max_height", label: "Max height (px)", type: "number", half: true },
      { k: "quality", label: "Quality", type: "range", min: 10, max: 100, def: 85 }, { k: "grayscale", label: "Black & white", type: "check" }] },

  // other
  { id: "info", cat: "other", icon: "info", name: "PDF info", desc: "Pages, sizes, fonts, images, security, metadata and more.", accept: PDF },
  { id: "compare", cat: "other", icon: "compare", name: "Compare PDFs", desc: "Highlight text and visual differences between two versions.", accept: PDF, multiple: true, min: 2, max: 2 },
];
if (window.MyPDFLocal) { // on the phone: built-in engine only
  const tw = (id, fn) => { const t = TOOLS.find(x => x.id === id); if (t) fn(t); };
  tw("pdf_to_word", t => { t.opts = t.opts.filter(o => o.k !== "engine"); });
  tw("pdf_to_pptx", t => { t.opts = t.opts.filter(o => o.k !== "notes"); t.desc = "Each page becomes a slide."; });
  tw("office_to_pdf", t => { t.desc = "Convert Word, Excel and PowerPoint files (DOCX, XLSX, PPTX) with the built-in engine."; t.accept = ".docx,.xlsx,.pptx,.csv"; });
  tw("to_pdf", t => { t.desc = "Word, Excel, PowerPoint (DOCX/XLSX/PPTX), images, text, Markdown, HTML, EPUB… to PDF."; });
}
const T = Object.fromEntries(TOOLS.map(t => [t.id, t]));
const QUICK = ["scan", "edit", "merge", "compress", "to_pdf", "pdf_to_word"];

// ------------------------------------------------------------------ utils
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtSize = (n) => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB";
const extOf = (n) => (n.split(".").pop() || "").toLowerCase();
const isDesktop = () => !!(window.pywebview && window.pywebview.api);
const ANDROID = window.MyPDFAndroid || null; // the MyPDF Android app's native bridge
const LOCAL = window.MyPDFLocal || null;     // on-device engine (Android app): no computer needed
const absUrl = (u) => new URL(u, location.href).href;
const store = {
  get(k, d) { try { const v = localStorage.getItem("mypdf." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("mypdf." + k, JSON.stringify(v)); } catch { /* ignore */ } },
};
function toast(msg, err = false, ms = 3200) {
  const el = h(`<div class="toast ${err ? "err" : ""}">${esc(msg)}</div>`);
  $("#toasts").append(el);
  setTimeout(() => el.remove(), ms);
}
function modal(title, body, buttons = [], cls = "") {
  const bg = h(`<div class="modal-bg"><div class="modal ${cls}"><header><h3>${esc(title)}</h3><button class="mini" data-x>${icon("x")}</button></header><div class="body"></div><footer></footer></div></div>`);
  const b = $(".body", bg);
  typeof body === "string" ? (b.innerHTML = body) : b.append(body);
  const close = () => { bg.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  $("[data-x]", bg).onclick = close;
  bg.addEventListener("pointerdown", (e) => { if (e.target === bg) bg._down = true; });
  bg.addEventListener("click", (e) => { if (e.target === bg && bg._down) close(); bg._down = false; });
  const f = $("footer", bg);
  if (!buttons.length) f.remove();
  for (const [label, fn, primary] of buttons) {
    const btn = h(`<button class="btn ${primary ? "primary" : ""}">${label}</button>`);
    btn.onclick = async () => { if ((await fn?.(bg)) !== false) close(); };
    f.append(btn);
  }
  document.body.append(bg);
  return { el: bg, close, body: b };
}
function askPassword(msg) {
  return new Promise(res => {
    const body = h(`<div><p class="muted" style="margin-top:0">${esc(msg)}</p><input class="inp" type="password" placeholder="Password" autofocus></div>`);
    const m = modal("Password required", body, [["Cancel", () => res(null)], ["Unlock", () => res($("input", body).value), true]]);
    const inp = $("input", body); setTimeout(() => inp.focus(), 50);
    inp.onkeydown = (e) => { if (e.key === "Enter") { res(inp.value); m.close(); } };
  });
}
function pickFiles(accept, multiple, capture) {
  return new Promise(res => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = accept || ""; inp.multiple = !!multiple;
    if (capture) inp.setAttribute("capture", "environment");
    inp.onchange = () => res([...inp.files]);
    inp.click();
  });
}
// XHR so we get upload progress
function send(url, fd, onProgress) {
  if (LOCAL && url.startsWith("/api/")) return LOCAL.post(url, fd, onProgress);
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", url);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    x.upload.onload = () => onProgress?.(1);
    x.onload = () => {
      let j = {};
      try { j = JSON.parse(x.responseText); } catch { j = { error: `Server error (${x.status})` }; }
      x.status >= 200 && x.status < 300 ? resolve(j) : reject(Object.assign(new Error(j.error || "Failed"), j));
    };
    x.onerror = () => reject(new Error("Can't reach MyPDF. Is the app still running on your computer?"));
    x.send(fd);
  });
}
async function getJSON(url) {
  if (LOCAL) return LOCAL.get(url);
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || "Failed"), j);
  return j;
}
// page images: rendered by the server, or on the phone by the local engine (lazy, via data-pg)
const pgAttr = (doc, p, w) => LOCAL ? `data-pg="${doc}/${p}/${w}"` : `src="/api/doc/${doc}/page/${p}?w=${w}"`;
function setPg(img, doc, p, w) { if (LOCAL) { img.dataset.pg = `${doc}/${p}/${w}`; LOCAL.hydrate(img); } else img.src = `/api/doc/${doc}/page/${p}?w=${w}`; }
const outBlob = async (f) => LOCAL ? LOCAL.blobOf(f.url) : (await fetch(f.url + "?inline=1")).blob();
async function openDoc(file, onProgress) {
  const fd = new FormData(); fd.append("file", file);
  try { return await send("/api/open", fd, onProgress); }
  catch (e) {
    if (e.code !== "needs_password") throw e;
    for (;;) {
      const pw = await askPassword(`"${file.name}" is password protected.`);
      if (pw == null) throw new Error("Cancelled");
      const f2 = new FormData(); f2.append("doc", e.doc); f2.append("password", pw);
      try { return await send("/api/open", f2); } catch (e2) { if (e2.code !== "needs_password") throw e2; toast("Wrong password", true); }
    }
  }
}

// ------------------------------------------------------------------ theme
function applyTheme() { const t = store.get("theme", "auto"); t === "auto" ? delete document.documentElement.dataset.theme : (document.documentElement.dataset.theme = t); }
$("#btn-theme").onclick = () => {
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const cur = store.get("theme", "auto");
  const isDark = cur === "dark" || (cur === "auto" && dark);
  store.set("theme", isDark ? "light" : "dark"); applyTheme();
};
applyTheme();

// ------------------------------------------------------------------ router
let carry = []; // files handed from one tool to the next
let cleanupView = null;
function go(hash) { location.hash = hash; }
window.addEventListener("hashchange", route);
function route() {
  cleanupView?.(); cleanupView = null;
  const m = location.hash.match(/^#\/?tool\/(\w+)/);
  const view = $("#view");
  view.innerHTML = "";
  window.scrollTo(0, 0);
  if (m && T[m[1]]) renderTool(T[m[1]], view);
  else renderHome(view);
}
$("#home-link").onclick = () => { $("#search").value = ""; go("#/"); };
$("#search").addEventListener("input", () => { if (location.hash.startsWith("#/tool")) go("#/"); else renderHome($("#view")); });
$("#search").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const first = $(".card", $("#view"));
  if (first) { first.click(); e.target.value = ""; e.target.blur(); }
});

// ------------------------------------------------------------------ home
let homeCat = "all";
function toolCard(t) {
  const c = CATS[t.cat][1];
  const el = h(`<button class="card" style="--cc:${c}"><div class="ci">${icon(t.icon)}</div><div><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></div></button>`);
  el.onclick = () => go("#/tool/" + t.id);
  return el;
}
function renderHome(view) {
  const q = $("#search").value.trim().toLowerCase();
  view.innerHTML = "";
  if (!q) {
    view.append(h(`<div class="hero"><div><h1>What do you want to do?</h1><p>Every PDF & document tool in one place — ${LOCAL ? "private: everything runs on this phone, even offline." : "private, on your own computer."}</p></div></div>`));
    if (isPhoneBrowser() && !store.get("hideInstallTip2", false)) {
      const tip = h(`<div class="panel" style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
        ${icon("phone")}<span style="flex:1;min-width:180px;font-size:14px">${isAndroidPhone() ? "Get the MyPDF Android app: full screen, with Downloads and Share built in." : "Add MyPDF to your home screen to use it like an app."}</span>
        <button class="btn sm primary">${isAndroidPhone() ? "Get the app" : "How to"}</button><button class="mini" title="Hide">${icon("x")}</button></div>`);
      $(".btn", tip).onclick = installGuide;
      $(".mini", tip).onclick = () => { store.set("hideInstallTip2", true); tip.remove(); };
      view.append(tip);
    }
    const quick = h(`<div class="quick"></div>`);
    for (const id of QUICK) {
      const t = T[id];
      const b = h(`<button style="--qc:${CATS[t.cat][1]}"><div class="qi">${icon(t.icon)}</div><b>${esc(t.name)}</b></button>`);
      b.onclick = () => go("#/tool/" + id);
      quick.append(b);
    }
    view.append(quick);
    const chips = h(`<div class="chips"></div>`);
    for (const [k, [name]] of [["all", ["All tools"]], ...Object.entries(CATS)]) {
      const c = h(`<button class="chip ${homeCat === k ? "on" : ""}">${esc(name)}</button>`);
      c.onclick = () => { homeCat = k; renderHome(view); };
      chips.append(c);
    }
    view.append(chips);
  }
  const words = q.split(/\s+/).filter(Boolean);
  const match = (t) => words.every(w => (t.name + " " + t.desc + " " + t.id.replace(/_/g, " ") + " " + CATS[t.cat][0]).toLowerCase().includes(w));
  let any = false;
  for (const [k, [name, color]] of Object.entries(CATS)) {
    if (!q && homeCat !== "all" && homeCat !== k) continue;
    const list = TOOLS.filter(t => (t.cat === k || (!q && homeCat === k && t.cats?.includes(k))) && (!q || match(t)));
    if (!list.length) continue;
    any = true;
    const sec = h(`<section class="cat" style="--cc:${color}"><h2><span></span>${esc(name)}</h2><div class="grid"></div></section>`);
    list.forEach(t => $(".grid", sec).append(toolCard(t)));
    view.append(sec);
  }
  if (!any) view.append(h(`<div class="empty">No tool matches “${esc(q)}”.</div>`));
}

// ------------------------------------------------------------------ tool page
function toolHead(t) {
  const back = h(`<button class="btn sm" style="margin-bottom:14px">${icon("back")} All tools</button>`);
  back.onclick = () => go("#/");
  const head = h(`<div class="tool-head" style="--cc:${CATS[t.cat][1]}"><div class="ci">${icon(t.icon)}</div><div><h1>${esc(t.name)}</h1><p>${esc(t.desc)}</p></div></div>`);
  const frag = document.createDocumentFragment(); frag.append(back, head); return frag;
}
function renderTool(t, view) {
  view.append(toolHead(t));
  const views = { organize: OrganizeView, editor: EditorView, scanner: ScannerView, form: FormView, ocrtext: OcrTextView };
  if (t.view) return views[t.view](t, view);
  GenericView(t, view);
}

function dropZone(t, onFiles, label) {
  const multi = !!t.multiple;
  const el = h(`<div class="drop"><div class="big">${icon("upload")}</div><b>${label || (multi ? "Choose files" : "Choose a file")}</b>
    <small>or drag & drop ${multi ? "them" : "it"} here</small><div class="drop-btns"></div></div>`);
  const pick = async (capture) => { const f = await pickFiles(t.accept === "*" ? "" : t.accept, multi, capture); if (f.length) onFiles(f); };
  el.onclick = (e) => { if (!e.target.closest("button")) pick(); };
  if (/image/.test(t.accept || "") || t.accept === "*") {
    const cam = h(`<button class="btn sm">${icon("camera")} Take photo</button>`);
    cam.onclick = () => pick(true);
    $(".drop-btns", el).append(cam);
  }
  el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("over"); });
  el.addEventListener("dragleave", () => el.classList.remove("over"));
  el.addEventListener("drop", (e) => { e.preventDefault(); el.classList.remove("over"); const f = [...e.dataTransfer.files]; if (f.length) onFiles(multi ? f : f.slice(0, 1)); });
  return el;
}

function optionDefaults(opts) {
  const o = {};
  for (const f of opts || []) if (f.def !== undefined) o[f.k] = f.def;
  return o;
}
function buildForm(opts, values, assets, onChange) {
  const wrap = h(`<div></div>`);
  const adv = h(`<details class="adv"><summary>More options</summary></details>`);
  let row = null;
  const render = () => {
    wrap.innerHTML = ""; adv.innerHTML = "<summary>More options</summary>"; row = null;
    for (const f of opts) {
      if (f.show && !f.show(values)) continue;
      const el = fieldEl(f, values, assets, () => { onChange?.(); render(); });
      const target = f.adv ? adv : wrap;
      if (f.half) {
        if (!row || row.parentNode !== target || row.children.length === 2) { row = h(`<div class="row2"></div>`); target.append(row); }
        row.append(el);
      } else { row = null; target.append(el); }
    }
    if (adv.children.length > 1) wrap.append(adv);
  };
  render();
  return wrap;
}
function fieldEl(f, values, assets, rerender) {
  const v = values[f.k];
  const set = (val, re) => { values[f.k] = val; if (re) rerender(); };
  if (f.type === "check") {
    const el = h(`<label class="check"><input type="checkbox" ${v ? "checked" : ""}> <span>${esc(f.label)}</span></label>`);
    $("input", el).onchange = (e) => set(e.target.checked, true);
    return el;
  }
  const el = h(`<div class="field"><label>${esc(f.label)}</label></div>`);
  let inp;
  switch (f.type) {
    case "seg":
      inp = h(`<div class="seg"></div>`);
      for (const [cv, cl] of f.choices) {
        const b = h(`<button type="button" class="${String(v) === String(cv) ? "on" : ""}">${esc(cl)}</button>`);
        b.onclick = () => set(cv, true);
        inp.append(b);
      }
      break;
    case "select":
      inp = h(`<select class="inp">${f.choices.map(([cv, cl]) => `<option value="${esc(cv)}" ${String(v) === String(cv) ? "selected" : ""}>${esc(cl)}</option>`).join("")}</select>`);
      inp.onchange = () => set(inp.value, true);
      break;
    case "textarea":
      inp = h(`<textarea class="inp" rows="${f.rows || 4}" placeholder="${esc(f.ph || "")}">${esc(v || "")}</textarea>`);
      inp.oninput = () => set(inp.value);
      break;
    case "range":
      inp = h(`<div class="range"><input type="range" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${v}"><output>${v}</output></div>`);
      $("input", inp).oninput = (e) => { set(+e.target.value); $("output", inp).textContent = e.target.value; };
      break;
    case "image": {
      inp = h(`<div style="display:flex;gap:8px;align-items:center"><button class="btn sm" type="button">${icon("image")} Choose image</button><span class="muted" style="font-size:13px">${assets[f.k] ? esc(assets[f.k].name) : "none"}</span></div>`);
      $("button", inp).onclick = async () => { const [file] = await pickFiles(IMG); if (file) { assets[f.k] = file; rerender(); } };
      break;
    }
    default:
      inp = h(`<input class="inp" type="${f.type === "number" ? "number" : f.type === "password" ? "password" : f.type === "color" ? "color" : "text"}" placeholder="${esc(f.ph || "")}" value="${esc(v ?? "")}">`);
      if (f.type === "color") inp.style.cssText = "height:40px;padding:3px";
      inp.oninput = () => set(f.type === "number" ? (inp.value === "" ? "" : +inp.value) : inp.value);
  }
  el.append(inp);
  if (f.hint) el.append(h(`<small>${esc(f.hint)}</small>`));
  return el;
}

function fileList(files, t, onChange) {
  const ul = h(`<ul class="files"></ul>`);
  files.forEach((f, i) => {
    const isImg = /^image\//.test(f.type) && !/heic|heif|tif/.test(f.type);
    const li = h(`<li><div class="fi">${isImg ? "" : esc(extOf(f.name).toUpperCase().slice(0, 4))}</div><div class="fn"><div>${esc(f.name)}</div><small>${fmtSize(f.size)}</small></div></li>`);
    if (isImg) { const im = document.createElement("img"); im.src = URL.createObjectURL(f); im.onload = () => URL.revokeObjectURL(im.src); $(".fi", li).append(im); }
    if (t.sortable && files.length > 1) {
      const up = h(`<button class="mini" title="Move up">${icon("back")}</button>`); up.style.transform = "rotate(90deg)";
      const dn = h(`<button class="mini" title="Move down">${icon("next")}</button>`); dn.style.transform = "rotate(90deg)";
      up.onclick = () => { if (i > 0) { [files[i - 1], files[i]] = [files[i], files[i - 1]]; onChange(); } };
      dn.onclick = () => { if (i < files.length - 1) { [files[i + 1], files[i]] = [files[i], files[i + 1]]; onChange(); } };
      li.append(up, dn);
    }
    const rm = h(`<button class="mini" title="Remove">${icon("x")}</button>`);
    rm.onclick = () => { files.splice(i, 1); onChange(); };
    li.append(rm);
    ul.append(li);
  });
  return ul;
}

function GenericView(t, view) {
  const files = carry.length ? carry.splice(0) : [];
  const values = optionDefaults(t.opts);
  const assets = {};
  const layout = h(`<div class="layout"><div class="left"></div><div class="side"></div></div>`);
  const left = $(".left", layout), side = $(".side", layout);
  view.append(layout);

  const filesBox = h(`<div></div>`);
  const renderFiles = () => {
    filesBox.innerHTML = "";
    if (!files.length || t.multiple) filesBox.append(dropZone(t, (f) => { if (t.multiple) files.push(...f); else files.splice(0, files.length, f[0]); renderFiles(); },
      files.length ? "Add more files" : null));
    if (files.length) {
      filesBox.append(fileList(files, t, renderFiles));
      if (!t.multiple) { const ch = h(`<button class="btn sm" style="margin-top:10px">Change file</button>`); ch.onclick = async () => { const f = await pickFiles(t.accept); if (f[0]) { files[0] = f[0]; renderFiles(); } }; filesBox.append(ch); }
    }
    runBtn.disabled = !t.optionalFiles && files.length < (t.min || 1);
  };
  left.append(filesBox);

  const optsPanel = h(`<div class="panel"><h3>Options</h3></div>`);
  if (t.opts?.length) optsPanel.append(buildForm(t.opts, values, assets));
  else optsPanel.append(h(`<p class="muted" style="margin:0 0 12px;font-size:14px">No options needed — just press the button.</p>`));
  const runBtn = h(`<button class="btn primary block">${esc(t.name)}</button>`);
  const prog = h(`<div class="hide"><div class="progress"><div></div></div><div class="status"></div></div>`);
  optsPanel.append(runBtn, prog);
  side.append(optsPanel);
  const resultBox = h(`<div></div>`);
  side.append(resultBox);
  renderFiles();

  runBtn.onclick = async () => {
    if (t.id === "protect" && values.user_password !== values.confirm) return toast("Passwords do not match", true);
    if (t.id === "watermark" && values.kind === "image" && !assets.image) return toast("Choose an image for the watermark", true);
    resultBox.innerHTML = "";
    runBtn.disabled = true;
    prog.classList.remove("hide");
    const bar = $(".progress", prog), status = $(".status", prog);
    const opts = { ...values };
    for (;;) {
      const fd = new FormData();
      files.forEach(f => fd.append("files", f, f.name));
      for (const [k, f] of Object.entries(assets)) {
        const spec = (t.opts || []).find(x => x.k === k);
        if (!spec?.show || spec.show(values)) fd.append(k, f, f.name); // only send assets for visible fields
      }
      fd.append("options", JSON.stringify(opts));
      bar.classList.remove("indet"); status.textContent = "Uploading…";
      try {
        const res = await send("/api/run/" + t.id, fd, (p) => {
          if (typeof p === "string") { status.textContent = p; return; }
          $("div", bar).style.width = (p * 100).toFixed(0) + "%";
          if (p >= 1) { bar.classList.add("indet"); $("div", bar).style.width = ""; status.textContent = "Processing…"; }
        });
        resultBox.append(resultPanel(t, res));
        resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
        break;
      } catch (e) {
        if (e.code === "needs_password") {
          const pw = await askPassword(e.message);
          if (pw != null) { opts.password = pw; continue; }
        } else toast(e.message, true, 6000);
        break;
      }
    }
    runBtn.disabled = false;
    prog.classList.add("hide");
  };
}

// ------------------------------------------------------------------ results
function resultPanel(t, res) {
  const el = h(`<div class="panel result"></div>`);
  if (res.info) {
    el.append(h(`<h3>Document info</h3>`));
    el.append(h(`<table class="info-table">${Object.entries(res.info).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>`));
    return el;
  }
  el.append(h(`<div class="ok">${icon("check")} Done${res.seconds ? ` <span class="muted" style="font-weight:400;font-size:13px">in ${res.seconds}s</span>` : ""}</div>`));
  if (res.message) el.append(h(`<div class="msg">${esc(res.message)}</div>`));
  const list = h(`<div class="out-list"></div>`);
  const all = [...res.files];
  if (res.zip) list.append(outItem(res.job, res.zip, true));
  all.slice(0, 50).forEach(f => list.append(outItem(res.job, f)));
  if (all.length > 50) list.append(h(`<div class="muted" style="font-size:13px">…and ${all.length - 50} more (in the ZIP).</div>`));
  el.append(list);
  if (res.files.length) {
    const cont = h(`<button class="btn sm" style="margin-top:12px">${icon("next")} Continue with another tool</button>`);
    cont.onclick = () => continueWith(res.files);
    el.append(cont);
  }
  return el;
}
function outItem(job, f, isZip) {
  const el = h(`<div class="out-item"><div class="fn" title="${esc(f.name)}">${isZip ? "<b>Download all (ZIP)</b>" : esc(f.name)} <small>${fmtSize(f.size)}</small></div></div>`);
  const dl = h(`<button class="btn sm primary">${icon("download")} ${isDesktop() ? "Save" : "Download"}</button>`);
  dl.onclick = () => saveOutput(job, f);
  el.append(dl);
  if (!isZip && /\.(pdf|jpg|png|webp|html|txt|md)$/i.test(f.name)) {
    const op = h(`<button class="mini" title="Open">${icon("open")}</button>`);
    op.onclick = () => isDesktop() ? window.pywebview.api.open_file(job, f.name)
      : LOCAL ? LOCAL.deliver(f, "open").catch(e => toast(e.message, true))
      : ANDROID ? ANDROID.open(absUrl(f.url), f.name) : window.open(f.url + "?inline=1", "_blank");
    el.append(op);
  }
  if (ANDROID || (!isDesktop() && navigator.canShare)) { // phones: send straight to WhatsApp, Drive, Files…
    const sh = h(`<button class="mini" title="Share">${icon("share")}</button>`);
    sh.onclick = () => LOCAL && ANDROID ? LOCAL.deliver(f, "share").catch(e => toast(e.message, true)) : ANDROID ? ANDROID.share(absUrl(f.url), f.name) : shareOutput(f);
    el.append(sh);
  }
  return el;
}
async function shareOutput(f) {
  try {
    const blob = await outBlob(f);
    const file = new File([blob], f.name, { type: blob.type || "application/octet-stream" });
    if (!navigator.canShare({ files: [file] })) return toast("Sharing this file type isn't supported here — use Download", true);
    await navigator.share({ files: [file], title: f.name });
  } catch (e) { if (e.name !== "AbortError") toast("Could not share: " + e.message, true); }
}
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(() => toast("Copied"));
  const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
  document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast("Copied");
}
const isPhoneBrowser = () => !ANDROID && !isDesktop() && !["127.0.0.1", "localhost", "[::1]"].includes(location.hostname);
const isAndroidPhone = () => /Android/i.test(navigator.userAgent);
function installGuide() {
  const body = h(`<div>${isAndroidPhone() ? `
    <p style="margin-top:0">Get the <b>MyPDF Android app</b>: full screen with its own icon. Saves files to <b>Downloads</b>, lets you <b>share</b> results to WhatsApp or Drive, and lets you share PDFs <i>into</i> MyPDF from other apps.</p>
    <a class="btn primary block" href="/MyPDF.apk" download="MyPDF.apk">${icon("download")} Download MyPDF.apk</a>
    <ol class="steps" style="color:var(--text);margin-top:14px">
      <li>Open the downloaded file. If Chrome warns about the file, choose <b>Download anyway</b>.</li>
      <li>If asked, allow Chrome to <b>install unknown apps</b>, then tap <b>Install</b>.</li>
      <li>Open MyPDF and tap <b>Scan QR code</b>. On your computer, click <b>Connect phone</b> and scan its code.</li>
      <li>You can delete the old Chrome shortcut from your home screen.</li>
    </ol>` : `
    <p style="margin-top:0"><b>iPhone / iPad:</b> in Safari, tap <b>Share</b> → <b>Add to Home Screen</b>. MyPDF then opens full screen like an app.</p>`}
  </div>`);
  modal("Install MyPDF on your phone", body, [["Close", null, true]]);
}
async function saveOutput(job, f) {
  if (isDesktop()) {
    const r = await window.pywebview.api.save_file(job, f.name);
    if (r?.ok) toast("Saved to " + r.path);
    else if (r && !r.cancelled) toast(r.error || "Could not save", true);
    return;
  }
  if (LOCAL) { try { await LOCAL.deliver(f, "download"); } catch (e) { toast(e.message, true); } return; }
  if (ANDROID) { ANDROID.download(absUrl(f.url), f.name); return; }
  const a = document.createElement("a");
  a.href = f.url; a.download = f.name; document.body.append(a); a.click(); a.remove();
}
async function continueWith(outFiles) {
  const files = await Promise.all(outFiles.map(async f => new File([await outBlob(f)], f.name)));
  continueWithFiles(files);
}
function continueWithFiles(files, title = "Continue with…") {
  const exts = new Set(files.map(f => extOf(f.name)));
  const body = h(`<div class="grid"></div>`);
  const fits = TOOLS.filter(t => t.view !== "scanner" && (t.accept === "*" || [...exts].every(e => (t.accept || "").includes(e) || (/image/.test(t.accept || "") && /jpe?g|png|webp|bmp|tiff?/.test(e)))));
  const m = modal(title, body, [], "wide");
  fits.forEach(t => { const c = toolCard(t); c.onclick = () => { carry = t.multiple ? files : files.slice(0, 1); m.close(); go("#/tool/" + t.id); }; body.append(c); });
}

// ------------------------------------------------------------------ open-a-document helper (visual tools)
function openPanel(t, view, onOpen, label) {
  const box = h(`<div></div>`);
  view.append(box);
  const handle = async (files) => {
    box.innerHTML = `<div class="panel" style="display:flex;gap:12px;align-items:center"><div class="spin"></div><span>Opening ${esc(files[0].name)}…</span></div>`;
    try { const d = await openDoc(files[0]); box.remove(); onOpen(d, files[0]); }
    catch (e) { box.innerHTML = ""; box.append(dropZone(t, handle, label)); if (e.message !== "Cancelled") toast(e.message, true, 6000); }
  };
  if (carry.length) handle(carry.splice(0));
  else box.append(dropZone({ ...t, multiple: false }, handle, label));
}

// ================================================================== ORGANIZE
function OrganizeView(t, view) {
  openPanel(t, view, (d, file) => {
    const docs = { [d.doc]: { name: file.name, pages: d.pages } };
    let items = d.pages.map((_, p) => ({ d: d.doc, p, r: 0, sel: false, k: Math.random() }));
    const wrap = h(`<div></div>`);
    const bar = h(`<div class="org-bar"></div>`);
    const grid = h(`<div class="org-grid"></div>`);
    const footer = h(`<div class="panel" style="margin-top:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <input class="inp" style="max-width:280px" value="${esc(file.name.replace(/\.[^.]+$/, ""))}_organized.pdf"><button class="btn primary">${icon("download")} Save PDF</button><span class="muted cnt"></span></div>`);
    const result = h(`<div style="margin-top:14px"></div>`);
    wrap.append(bar, grid, footer, result);
    view.append(wrap);
    const btn = (ic, label, fn) => { const b = h(`<button class="btn sm">${icon(ic)} ${label}</button>`); b.onclick = fn; bar.append(b); return b; };
    btn("plus", "Add files", async () => {
      const fs = await pickFiles(PDF + "," + IMG, true);
      for (const f of fs) {
        try { const nd = await openDoc(f); docs[nd.doc] = { name: f.name, pages: nd.pages }; items.push(...nd.pages.map((_, p) => ({ d: nd.doc, p, r: 0, k: Math.random() }))); }
        catch (e) { toast(e.message, true); }
      }
      render();
    });
    btn("file", "Blank page", () => { items.push({ blank: true, k: Math.random() }); render(); });
    const selBtn = btn("check", "Select all", () => { const all = items.every(i => i.sel); items.forEach(i => i.sel = !all); render(); });
    btn("rotate", "Rotate selected", () => { sel().forEach(i => i.r = (i.r + 90) % 360); render(); });
    btn("trash", "Delete selected", () => { items = items.filter(i => !i.sel); render(); });
    btn("extract", "Keep only selected", () => { if (sel().length) { items = sel(); items.forEach(i => i.sel = false); render(); } });
    btn("swap", "Reverse", () => { items.reverse(); render(); });
    const sel = () => items.filter(i => i.sel);

    function render() {
      grid.innerHTML = "";
      items.forEach((it, idx) => {
        const card = h(`<div class="pg ${it.sel ? "sel" : ""}"><span class="num">${idx + 1}</span><div class="thumb"></div>
          <div class="lbl">${it.blank ? "Blank" : `Page ${it.p + 1}${Object.keys(docs).length > 1 ? " · " + esc(docs[it.d].name.slice(0, 14)) : ""}`}</div>
          <div class="tools"></div><button class="mini grip" title="Drag to move">${icon("grip")}</button></div>`);
        const th = $(".thumb", card);
        if (it.blank) th.append(h(`<div class="blank"></div>`));
        else { const im = h(`<img loading="lazy" ${pgAttr(it.d, it.p, 260)} alt="">`); const pg = docs[it.d].pages[it.p], k = it.r % 180 ? Math.min(pg.w / pg.h, pg.h / pg.w) : 1;
          im.style.transform = `rotate(${it.r}deg) scale(${k})`; th.append(im); }
        th.onclick = () => { it.sel = !it.sel; card.classList.toggle("sel", it.sel); updCount(); };
        const tl = $(".tools", card);
        const mk = (ic, title, fn) => { const b = h(`<button class="mini" title="${title}">${icon(ic)}</button>`); b.onclick = fn; tl.append(b); };
        mk("rotl", "Rotate left", () => { it.r = (it.r + 270) % 360; render(); });
        mk("rotate", "Rotate right", () => { it.r = (it.r + 90) % 360; render(); });
        mk("copy", "Duplicate", () => { items.splice(idx + 1, 0, { ...it, sel: false, k: Math.random() }); render(); });
        mk("trash", "Delete", () => { items.splice(idx, 1); render(); });
        dragSort($(".grip", card), card, idx);
        grid.append(card);
      });
      updCount();
    }
    function updCount() {
      $(".cnt", footer).textContent = `${items.length} page${items.length === 1 ? "" : "s"}${sel().length ? ` · ${sel().length} selected` : ""}`;
      selBtn.innerHTML = icon("check") + (items.length && items.every(i => i.sel) ? " Select none" : " Select all");
    }
    // pointer-based drag & drop (works with touch)
    function dragSort(handle, card, from) {
      handle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        const rect = card.getBoundingClientRect();
        const clone = card.cloneNode(true); clone.classList.add("drag-clone");
        clone.style.width = rect.width + "px"; clone.style.left = rect.left + "px"; clone.style.top = rect.top + "px";
        document.body.append(clone); card.classList.add("ghost");
        const dx = e.clientX - rect.left, dy = e.clientY - rect.top;
        let to = from;
        const move = (ev) => {
          clone.style.left = ev.clientX - dx + "px"; clone.style.top = ev.clientY - dy + "px";
          const cards = $$(".pg", grid);
          for (let i = 0; i < cards.length; i++) {
            const r = cards[i].getBoundingClientRect();
            if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
              to = i;
              cards.forEach((c, j) => c.style.outline = j === i && i !== from ? "2px dashed var(--accent)" : "");
            }
          }
          if (ev.clientY < 60) scrollBy(0, -12); else if (ev.clientY > innerHeight - 60) scrollBy(0, 12);
        };
        const up = () => {
          removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
          clone.remove();
          if (to !== from) { const [x] = items.splice(from, 1); items.splice(to, 0, x); }
          render();
        };
        addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
      });
    }
    $(".btn.primary", footer).onclick = async (ev) => {
      if (!items.length) return toast("No pages left", true);
      const b = ev.currentTarget; b.disabled = true;
      const fd = new FormData();
      fd.append("options", JSON.stringify({ items: items.map(i => i.blank ? { blank: true } : { d: i.d, p: i.p, r: i.r }), filename: $("input", footer).value }));
      try { const res = await send("/api/run/organize", fd); result.innerHTML = ""; result.append(resultPanel(t, res)); result.scrollIntoView({ behavior: "smooth" }); }
      catch (e) { toast(e.message, true); }
      b.disabled = false;
    };
    render();
  }, "Choose a PDF to organize");
}

// ================================================================== FORM FILL
function FormView(t, view) {
  openPanel(t, view, async (d, file) => {
    const { fields } = await getJSON(`/api/doc/${d.doc}/fields`);
    if (!fields.length) {
      view.append(h(`<div class="panel"><b>This PDF has no fillable form fields.</b><p class="muted">Use <a href="#/tool/edit">Edit PDF</a> to type text anywhere on the page instead.</p></div>`));
      return;
    }
    const values = {};
    const layout = h(`<div class="layout"><div class="panel left"></div><div class="side"><div class="panel"></div><div class="res"></div></div></div>`);
    const left = $(".left", layout);
    let lastPage = 0;
    for (const f of fields) {
      if (f.page !== lastPage) { left.append(h(`<h3 style="margin-top:${lastPage ? 18 : 0}px">Page ${f.page}</h3>`)); lastPage = f.page; }
      values[f.key] = f.value;
      let el;
      if (f.type === "checkbox" || f.type === "radiobutton") {
        el = h(`<label class="check"><input type="checkbox" ${f.value && f.value !== "Off" ? "checked" : ""}> ${esc(f.name)}</label>`);
        $("input", el).onchange = (e) => values[f.key] = e.target.checked;
      } else if (f.options.length) {
        el = h(`<div class="field"><label>${esc(f.name)}</label><select class="inp">${["", ...f.options].map(o => `<option ${o === f.value ? "selected" : ""}>${esc(Array.isArray(o) ? o[1] : o)}</option>`).join("")}</select></div>`);
        $("select", el).onchange = (e) => values[f.key] = e.target.value;
      } else {
        el = h(`<div class="field"><label>${esc(f.name)}</label><input class="inp" value="${esc(f.value || "")}"></div>`);
        $("input", el).oninput = (e) => values[f.key] = e.target.value;
      }
      left.append(el);
    }
    const side = $(".side .panel", layout);
    side.append(h(`<h3>Save</h3>`));
    const flat = h(`<label class="check"><input type="checkbox"> Flatten (make fields non-editable)</label>`);
    const btn = h(`<button class="btn primary block">Save filled PDF</button>`);
    side.append(flat, btn);
    btn.onclick = async () => {
      btn.disabled = true;
      const fd = new FormData();
      fd.append("options", JSON.stringify({ doc: d.doc, values, flatten: $("input", flat).checked, filename: file.name.replace(/\.pdf$/i, "") + "_filled.pdf" }));
      try { const res = await send("/api/run/form_fill", fd); const r = $(".res", layout); r.innerHTML = ""; r.append(resultPanel(t, res)); }
      catch (e) { toast(e.message, true); }
      btn.disabled = false;
    };
    view.append(layout);
  }, "Choose a PDF form");
}

// ================================================================== OCR TEXT
function OcrTextView(t, view) {
  const box = h(`<div class="layout"><div class="left"></div><div class="side"></div></div>`);
  view.append(box);
  const out = h(`<div class="panel hide"><h3>Recognised text</h3><textarea class="inp" rows="14"></textarea>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sm primary">${icon("copy")} Copy</button><button class="btn sm">${icon("download")} Save .txt</button></div></div>`);
  const handle = async (files) => {
    out.classList.remove("hide");
    const ta = $("textarea", out);
    ta.value = "Reading text… (the first run loads the OCR engine, ~5–10 s)";
    let all = [];
    for (const f of files) {
      const fd = new FormData(); fd.append("file", f);
      try { const r = await send("/api/ocr/image", fd); all.push(r.text || "(no text found)"); }
      catch (e) { toast(e.message, true); }
    }
    ta.value = all.join("\n\n---\n\n");
  };
  $(".left", box).append(dropZone({ ...t, multiple: true }, handle, "Choose photos or screenshots"));
  $(".side", box).append(out);
  $(".btn.primary", out).onclick = async () => { const ta = $("textarea", out); ta.select(); try { await navigator.clipboard.writeText(ta.value); } catch { document.execCommand("copy"); } toast("Copied"); };
  $$(".btn", out)[1].onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([$("textarea", out).value], { type: "text/plain" })); a.download = "text.txt"; a.click(); };
  if (carry.length) handle(carry.splice(0));
}

// ================================================================== SCANNER
function ScannerView(t, view) {
  const pages = []; // {id, preview, corners, auto, found, rotate, crop, thumb, busy}
  const settings = { filter: store.get("scan.filter", "magic"), page_size: "a4", ocr: false, output: "pdf", filename: "Scan " + new Date().toISOString().slice(0, 10) };
  const layout = h(`<div class="layout"><div class="left"></div><div class="side"></div></div>`);
  view.append(layout);
  const left = $(".left", layout), side = $(".side", layout);
  const add = h(`<div class="panel" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"></div>`);
  const mk = (ic, label, fn, primary) => { const b = h(`<button class="btn ${primary ? "primary" : ""}">${icon(ic)} ${label}</button>`); b.onclick = fn; add.append(b); return b; };
  mk("camera", "Take photo", async () => addFiles(await pickFiles("image/*", false, true)), true);
  mk("image", "From gallery / files", async () => addFiles(await pickFiles(IMG, true)));
  if (navigator.mediaDevices?.getUserMedia && window.isSecureContext) mk("scan", "Live camera", liveCamera);
  add.append(h(`<span class="muted" style="font-size:13px;flex-basis:100%">Tip: place the document on a darker, plain surface with good light. Tap a page to adjust corners, rotate or change its filter.</span>`));
  const grid = h(`<div class="scan-grid" style="margin-top:14px"></div>`);
  left.append(add, grid);

  const opt = h(`<div class="panel"><h3>Output</h3></div>`);
  opt.append(buildForm([
    { k: "filter", label: "Enhance", type: "select", choices: [["magic", "Auto (clean white paper)"], ["color", "Color boost"], ["gray", "Grayscale"], ["bw", "Black & white (text)"], ["original", "Original"]] },
    { k: "page_size", label: "Page size", type: "seg", choices: [["a4", "A4"], ["letter", "Letter"], ["fit", "Fit photo"]] },
    { k: "output", label: "Save as", type: "seg", choices: [["pdf", "PDF"], ["images", "Images"]] },
    { k: "ocr", label: "Make text searchable (OCR)", type: "check", show: o => o.output === "pdf" },
    { k: "filename", label: "File name", type: "text" },
  ], settings, {}, () => { store.set("scan.filter", settings.filter); pages.forEach(p => p.filter || refresh(p)); }));
  const go_ = h(`<button class="btn primary block" disabled>Create PDF</button>`);
  const prog = h(`<div class="hide"><div class="progress indet"><div></div></div><div class="status">Processing…</div></div>`);
  opt.append(go_, prog);
  const res = h(`<div></div>`);
  side.append(opt, res);

  async function addFiles(files) {
    for (const f of files) {
      const p = { busy: true, rotate: 0, crop: true, filter: null };
      pages.push(p); render();
      const fd = new FormData(); fd.append("file", f);
      try {
        const r = await send("/api/scan/detect", fd);
        Object.assign(p, { id: r.id, preview: r.preview, corners: r.corners, auto: r.corners, found: r.found, w: r.w, h: r.h });
        if (!r.found) toast("Couldn't find the page edges — tap the page to set the corners", false, 4000);
        await refresh(p);
      } catch (e) { toast(e.message, true); pages.splice(pages.indexOf(p), 1); render(); }
    }
  }
  async function refresh(p) {
    p.busy = true; render();
    try {
      const body = { id: p.id, corners: p.corners, filter: p.filter || settings.filter, rotate: p.rotate, crop: p.crop };
      let blob;
      if (LOCAL) blob = await LOCAL.postBlob("/api/scan/render", body);
      else {
        const r = await fetch("/api/scan/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error((await r.json()).error);
        blob = await r.blob();
      }
      if (p.thumb) URL.revokeObjectURL(p.thumb);
      p.thumb = URL.createObjectURL(blob);
    } catch (e) { toast(e.message, true); }
    p.busy = false; render();
  }
  function render() {
    grid.innerHTML = "";
    if (!pages.length) grid.append(h(`<div class="empty" style="grid-column:1/-1">No pages yet. Take a photo of a document to start.</div>`));
    pages.forEach((p, i) => {
      const c = h(`<div class="scan-card"><div class="im">${p.busy || !p.thumb ? `<div class="spin"></div>` : `<img src="${p.thumb}" alt="">`}</div><span class="n">${i + 1}</span></div>`);
      c.onclick = () => !p.busy && p.id && editPage(p);
      grid.append(c);
    });
    go_.disabled = !pages.length || pages.some(p => p.busy);
    go_.textContent = settings.output === "images" ? "Save images" : `Create PDF (${pages.length} page${pages.length === 1 ? "" : "s"})`;
  }
  function editPage(p) {
    const idx = pages.indexOf(p);
    const body = h(`<div>
      <div class="crop-wrap"><img src="${p.preview}" alt=""><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon fill="rgba(229,72,77,.15)" stroke="#e5484d" stroke-width="0.6" vector-effect="non-scaling-stroke"/></svg></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;justify-content:center">
        <button class="btn sm" data-a="auto">${icon("scan")} Auto detect</button><button class="btn sm" data-a="full">${icon("square")} Whole photo</button>
        <button class="btn sm" data-a="rl">${icon("rotl")}</button><button class="btn sm" data-a="rr">${icon("rotate")}</button>
        <button class="btn sm" data-a="up">${icon("back")} Earlier</button><button class="btn sm" data-a="down">Later ${icon("next")}</button>
        <select class="inp" style="width:auto" data-a="filter"><option value="">Filter: same as all</option><option value="magic">Auto clean</option><option value="color">Color boost</option><option value="gray">Grayscale</option><option value="bw">Black & white</option><option value="original">Original</option></select>
      </div><p class="muted" style="font-size:13px;text-align:center;margin-bottom:0">Drag the red dots onto the page corners. Rotation is applied after cropping.</p></div>`);
    const wrap = $(".crop-wrap", body), poly = $("polygon", body);
    let corners = p.corners.map(c => [...c]);
    $("select", body).value = p.filter || "";
    const handles = corners.map((_, k) => { const d = h(`<div class="hd"></div>`); wrap.append(d); return d; });
    const draw = () => {
      poly.setAttribute("points", corners.map(([x, y]) => `${x * 100},${y * 100}`).join(" "));
      handles.forEach((d, k) => { d.style.left = corners[k][0] * 100 + "%"; d.style.top = corners[k][1] * 100 + "%"; });
    };
    handles.forEach((d, k) => d.addEventListener("pointerdown", (e) => {
      e.preventDefault(); d.setPointerCapture(e.pointerId);
      const mv = (ev) => { const r = wrap.getBoundingClientRect(); corners[k] = [Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))]; draw(); };
      d.onpointermove = mv; d.onpointerup = () => { d.onpointermove = null; };
    }));
    // keep the image within the viewport height
    const img = $("img", body); img.onload = () => { wrap.style.width = Math.min(img.naturalWidth, (innerHeight * 0.58) * img.naturalWidth / img.naturalHeight) + "px"; draw(); };
    draw();
    body.onclick = (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "auto") { corners = p.auto.map(c => [...c]); p.crop = true; draw(); }
      if (a === "full") { corners = [[0, 0], [1, 0], [1, 1], [0, 1]]; draw(); }
      if (a === "rl") p.rotate = (p.rotate + 270) % 360;
      if (a === "rr") p.rotate = (p.rotate + 90) % 360;
      if (a === "up" && idx > 0) { pages.splice(idx, 1); pages.splice(idx - 1, 0, p); m.close(); render(); }
      if (a === "down" && idx < pages.length - 1) { pages.splice(idx, 1); pages.splice(idx + 1, 0, p); m.close(); render(); }
      if (a === "rl" || a === "rr") toast(`Rotation: ${p.rotate}°`, false, 1200);
    };
    const m = modal(`Page ${idx + 1}`, body, [
      [`${icon("trash")} Delete page`, () => { pages.splice(pages.indexOf(p), 1); render(); }],
      ["Apply", () => { p.corners = corners; p.filter = $("select", body).value || null; refresh(p); }, true],
    ], "wide");
  }
  async function liveCamera() {
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 3840 }, height: { ideal: 2160 } } }); }
    catch (e) { return toast("Camera not available: " + e.message, true); }
    const ui = h(`<div class="cam"><video autoplay playsinline muted></video><div class="cam-bar"><button class="btn">Done</button><button class="shutter" title="Capture"></button><span class="cnt">0</span></div></div>`);
    document.body.append(ui);
    const v = $("video", ui); v.srcObject = stream;
    let n = 0;
    $(".shutter", ui).onclick = () => {
      const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0);
      c.toBlob(b => addFiles([new File([b], `photo${Date.now()}.jpg`, { type: "image/jpeg" })]), "image/jpeg", 0.92);
      $(".cnt", ui).textContent = ++n; ui.style.opacity = .4; setTimeout(() => ui.style.opacity = 1, 120);
    };
    const stop = () => { stream.getTracks().forEach(tr => tr.stop()); ui.remove(); };
    $(".btn", ui).onclick = stop;
    cleanupView = stop;
  }
  go_.onclick = async () => {
    go_.disabled = true; prog.classList.remove("hide"); res.innerHTML = "";
    const fd = new FormData();
    fd.append("options", JSON.stringify({ ...settings, pages: pages.map(p => ({ id: p.id, corners: p.corners, rotate: p.rotate, filter: p.filter, crop: p.crop })) }));
    try { const r = await send("/api/run/scan", fd); res.append(resultPanel(t, r)); res.scrollIntoView({ behavior: "smooth" }); }
    catch (e) { toast(e.message, true); }
    go_.disabled = false; prog.classList.add("hide");
  };
  render();
  if (carry.length) addFiles(carry.splice(0));
}

// ================================================================== EDITOR
const FONT_CSS = { helv: "Helvetica, Arial, sans-serif", tiro: "'Times New Roman', Times, serif", cour: "'Courier New', monospace", arial: "Arial, sans-serif",
  georgia: "Georgia, serif", verdana: "Verdana, sans-serif", script: "'Segoe Script', 'Brush Script MT', cursive", handwriting: "'Ink Free', 'Segoe Print', cursive", indic: "'Nirmala UI', sans-serif" };

function EditorView(t, view) {
  openPanel(t, view, (d, file) => startEditor(t, view, d, file), "Choose a PDF to edit");
}
function startEditor(t, view, d, file) {
  const S = { cur: 0, tool: "select", sel: null, objs: [], color: store.get("ed.color", "#000000"), size: 14, font: "helv", stroke: 2, zoom: 1, history: [], linesCache: {}, assets: {} };
  const TOOLBAR = [
    ["select", "pointer", "Select"], ["text", "text", "Add text"], ["edittext", "edittext", "Edit text"], ["sep"],
    ["sign", "sign", "Sign"], ["image", "image", "Image"], ["draw", "draw", "Draw"], ["sep"],
    ["highlight", "highlight", "Highlight"], ["whiteout", "eraser", "White-out"], ["redact", "redact", "Redact"], ["sep"],
    ["rect", "square", "Rectangle"], ["ellipse", "circle", "Ellipse"], ["line", "line", "Line"], ["check", "tick", "Check"], ["link", "link", "Link"],
  ];
  const root = h(`<div class="ed">
    <div class="ed-top"><div class="ed-bar"></div><div class="ed-props"></div></div>
    <div class="ed-main"><div class="ed-thumbs"></div><div class="ed-stage">
      <div class="ed-nav"><button class="btn sm" data-nav="-1">${icon("back")}</button><span class="pnum"></span><button class="btn sm" data-nav="1">${icon("next")}</button>
        <button class="btn sm" data-z="-1" title="Zoom out">${icon("zoomout")}</button><button class="btn sm" data-z="1" title="Zoom in">${icon("zoomin")}</button></div>
      <div class="page-wrap"><div class="overlay"></div></div>
    </div></div>
    <div class="panel" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn sm" data-undo>${icon("undo")} Undo</button>
      <input class="inp fname" style="max-width:280px" value="${esc(file.name.replace(/\.[^.]+$/, ""))}_edited.pdf">
      <button class="btn primary save">${icon("download")} Save PDF</button><span class="muted ocount" style="font-size:13px"></span></div>
    <div class="res"></div></div>`);
  view.append(root);
  const bar = $(".ed-bar", root), props = $(".ed-props", root), wrap = $(".page-wrap", root), ov = $(".overlay", root);
  const img = new Image(); img.className = "pimg"; img.alt = ""; wrap.prepend(img);
  for (const [id, ic, label] of TOOLBAR) {
    if (id === "sep") { bar.append(h(`<div class="sep"></div>`)); continue; }
    const b = h(`<button class="tb" data-tool="${id}">${icon(ic)}<span>${label}</span></button>`);
    b.onclick = () => setTool(id);
    bar.append(b);
  }
  // thumbnails
  const thumbs = $(".ed-thumbs", root);
  d.pages.forEach((_, i) => { const b = h(`<button><img loading="lazy" ${pgAttr(d.doc, i, 180)} alt=""><div>${i + 1}</div></button>`); b.onclick = () => showPage(i); thumbs.append(b); });

  const page = () => d.pages[S.cur];
  const scale = () => wrap.clientWidth / page().w; // px per pt

  function snapshot() { S.history.push(JSON.stringify(S.objs)); if (S.history.length > 60) S.history.shift(); }
  function undo() { if (!S.history.length) return; S.objs = JSON.parse(S.history.pop()); S.sel = null; renderObjs(); renderProps(); }
  $("[data-undo]", root).onclick = undo;
  const onKey = (e) => {
    if (e.target.closest("[contenteditable], input, textarea, select")) return;
    if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
    if ((e.key === "Delete" || e.key === "Backspace") && S.sel) { deleteSel(); }
    if (e.key === "ArrowRight" && !S.sel) showPage(S.cur + 1);
    if (e.key === "ArrowLeft" && !S.sel) showPage(S.cur - 1);
  };
  document.addEventListener("keydown", onKey);
  cleanupView = () => document.removeEventListener("keydown", onKey);

  function layoutPage() {
    const stage = $(".ed-stage", root);
    const top = $(".ed-top", root).getBoundingClientRect().height + 150;
    const fitH = (innerHeight - top) * page().w / page().h; // whole page visible at zoom 100%
    const avail = Math.min(stage.clientWidth - 4, 1000, innerWidth > 700 ? Math.max(420, fitH) : 1e9) * S.zoom;
    const w = Math.max(200, avail);
    wrap.style.width = w + "px";
    wrap.style.height = w * page().h / page().w + "px";
  }
  function showPage(i) {
    if (i < 0 || i >= d.pages.length) return;
    S.cur = i; S.sel = null;
    layoutPage();
    setPg(img, d.doc, i, Math.min(2400, Math.round(wrap.clientWidth * (devicePixelRatio || 1) / 100) * 100 || 1200));
    $(".pnum", root).textContent = `Page ${i + 1} / ${d.pages.length}`;
    $$("button", thumbs).forEach((b, k) => b.classList.toggle("on", k === i));
    $$("button", thumbs)[i]?.scrollIntoView({ block: "nearest" });
    renderObjs(); renderProps();
    if (S.tool === "edittext") showLines();
  }
  $$("[data-nav]", root).forEach(b => b.onclick = () => showPage(S.cur + +b.dataset.nav));
  $$("[data-z]", root).forEach(b => b.onclick = () => { S.zoom = Math.min(3, Math.max(0.5, S.zoom * (b.dataset.z > 0 ? 1.25 : 0.8))); layoutPage(); renderObjs(); if (S.tool === "edittext") showLines(); });
  const ro = new ResizeObserver(() => { layoutPage(); renderObjs(); });
  ro.observe($(".ed-stage", root));

  function setTool(id) {
    if (id === "sign") { signatureDialog((blob, w, hgt) => placeImage(blob, w, hgt, true)); id = "select"; }
    if (id === "image") { pickFiles(IMG).then(([f]) => { if (!f) return; const im = new Image(); im.onload = () => placeImage(f, im.naturalWidth, im.naturalHeight); im.src = URL.createObjectURL(f); }); id = "select"; }
    S.tool = id;
    if (!["select", "edittext"].includes(id) && S.sel) select(null);
    $$(".tb", bar).forEach(b => b.classList.toggle("on", b.dataset.tool === id));
    ov.classList.toggle("drawing", !["select", "edittext"].includes(id));
    $$(".ln", ov).forEach(e => e.remove());
    if (id === "edittext") showLines();
    renderProps();
  }

  // -------- objects
  function newObj(o) { snapshot(); o.page = S.cur; o.id = Math.random().toString(36).slice(2); S.objs.push(o); S.sel = o.id; renderObjs(); renderProps(); return o; }
  function placeImage(blob, iw, ih, isSig) {
    const key = "a" + Math.random().toString(36).slice(2, 8);
    S.assets[key] = blob;
    const pw = page().w, ph = page().h;
    let w = isSig ? 0.28 : 0.4, hgt = w * pw * ih / iw / ph;
    if (hgt > 0.6) { hgt = 0.6; w = hgt * ph * iw / ih / pw; }
    newObj({ type: "image", asset: key, x: 0.5 - w / 2, y: 0.5 - hgt / 2, w, h: hgt, url: URL.createObjectURL(blob) });
    setTool("select");
    toast("Drag to position · use the blue dot to resize");
  }
  const selObj = () => S.objs.find(o => o.id === S.sel);
  function deleteSel() { if (!S.sel) return; snapshot(); S.objs = S.objs.filter(o => o.id !== S.sel); S.sel = null; renderObjs(); renderProps(); }

  function renderObjs() {
    $$(".obj", ov).forEach(e => e.remove());
    const sc = scale();
    for (const o of S.objs.filter(o => o.page === S.cur)) ov.append(objEl(o, sc));
    $(".ocount", root).textContent = S.objs.length ? `${S.objs.length} change${S.objs.length === 1 ? "" : "s"}` : "";
  }
  function objEl(o, sc) {
    const el = h(`<div class="obj t-${o.type} ${o.replace ? "replace" : ""} ${S.sel === o.id ? "sel" : ""}"></div>`);
    Object.assign(el.style, { left: o.x * 100 + "%", top: o.y * 100 + "%", width: o.w * 100 + "%", height: o.type === "text" ? "auto" : o.h * 100 + "%" });
    const op = o.opacity ?? 1;
    if (o.type === "text") {
      const tx = h(`<div class="txt" contenteditable="${S.sel === o.id}" spellcheck="false"></div>`);
      tx.textContent = o.text;
      Object.assign(tx.style, { fontSize: o.size * sc + "px", color: o.color, fontFamily: FONT_CSS[o.font] || FONT_CSS.helv, fontWeight: o.bold ? "700" : "400", opacity: op, textAlign: o.align || "left" });
      tx.addEventListener("focus", () => snapshot(), { once: true });
      tx.oninput = () => { o.text = tx.innerText.replace(/\n$/, ""); fitText(o, el); };
      el.append(tx);
      el.style.width = "auto"; el.style.minWidth = o.w * 100 + "%";
      requestAnimationFrame(() => fitText(o, el));
    } else if (o.type === "image") {
      el.append(h(`<img src="${o.url}" alt="">`));
    } else if (["whiteout", "highlight", "rect", "ellipse", "redact", "link"].includes(o.type)) {
      const s = { whiteout: `background:${o.color || "#fff"};`, highlight: `background:${o.color || "#ffeb33"};opacity:.45;`, redact: "background:#000;",
        rect: `border:${o.stroke * sc}px solid ${o.color};${o.fill ? "background:" + o.fill : ""};opacity:${op}`, ellipse: `border:${o.stroke * sc}px solid ${o.color};border-radius:50%;opacity:${op}`,
        link: "border:1.5px dashed #2563eb;background:rgba(37,99,235,.08)" }[o.type];
      el.append(h(`<div style="width:100%;height:100%;box-sizing:border-box;${s}"></div>`));
      if (o.type === "whiteout") el.firstChild.style.outline = "1px dashed #bbb";
    } else if (o.type === "line" || o.type === "ink") {
      const paths = o.type === "line" ? [o.pts] : o.paths;
      el.append(h(`<svg viewBox="0 0 1 1" preserveAspectRatio="none">${paths.map(p => `<polyline fill="none" stroke="${o.color}" stroke-width="${Math.max(1, o.stroke * sc)}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" opacity="${op}" points="${p.map(q => q.join(",")).join(" ")}"/>`).join("")}</svg>`));
    } else if (o.type === "check") {
      el.append(h(`<svg viewBox="0 0 24 24" style="stroke:${o.color};stroke-width:3;fill:none;stroke-linecap:round"><path d="${o.mark === "x" ? IC.x : IC.tick}"/></svg>`));
    }
    const hd = h(`<div class="h"></div>`); el.append(hd);
    if (o.type === "text") { const mv = h(`<div class="mv">${icon("move")}</div>`); el.append(mv); dragMove(mv, o, el); el.onpointerdown = (e) => {
        if (!["select", "edittext"].includes(S.tool)) return; // drawing tools draw over text too
        e.stopPropagation();
        if (S.sel !== o.id) select(o);
      }; }
    else dragMove(el, o, el);
    dragResize(hd, o, el);
    return el;
  }
  function fitText(o, el) { const r = el.getBoundingClientRect(), wr = wrap.getBoundingClientRect(); if (wr.width) { o.h = r.height / wr.height; o.w = Math.max(o.w, r.width / wr.width); } }
  function select(o) {
    S.objs = S.objs.filter(x => x === o || x.type !== "text" || x.text.trim() || x.replace); // drop empty text boxes
    S.sel = o?.id || null;
    renderObjs(); renderProps();
    if (o?.type === "text") { const tx = $(".obj.sel .txt", ov); if (tx) { tx.focus(); placeCaretEnd(tx); } }
  }
  function placeCaretEnd(el) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  function dragMove(handle, o, el) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.classList.contains("h")) return;
      if (S.tool !== "select" && S.tool !== "edittext" && handle === el) return; // drawing mode: let overlay handle it
      e.stopPropagation(); e.preventDefault();
      if (S.sel !== o.id) select(o);
      const r = wrap.getBoundingClientRect(), x0 = o.x, y0 = o.y, sx = e.clientX, sy = e.clientY;
      let moved = false;
      const mv = (ev) => {
        if (!moved) { snapshot(); moved = true; }
        o.x = Math.min(1 - 0.01, Math.max(-o.w + 0.01, x0 + (ev.clientX - sx) / r.width));
        o.y = Math.min(1 - 0.01, Math.max(-0.01, y0 + (ev.clientY - sy) / r.height));
        const cur = $(".obj.sel", ov); if (cur) { cur.style.left = o.x * 100 + "%"; cur.style.top = o.y * 100 + "%"; }
      };
      const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); };
      addEventListener("pointermove", mv); addEventListener("pointerup", up);
    });
  }
  function dragResize(hd, o, el) {
    hd.addEventListener("pointerdown", (e) => {
      e.stopPropagation(); e.preventDefault(); snapshot();
      const r = wrap.getBoundingClientRect(), w0 = o.w, h0 = o.h, s0 = o.size, sx = e.clientX, sy = e.clientY;
      const keep = o.type === "image" || o.type === "check";
      const mv = (ev) => {
        const dw = (ev.clientX - sx) / r.width, dh = (ev.clientY - sy) / r.height;
        if (o.type === "text") { o.size = Math.max(4, Math.round(s0 * (1 + dh / Math.max(h0, 0.01)) * 2) / 2); renderObjs(); renderProps(); return; }
        o.w = Math.max(0.01, w0 + dw);
        o.h = keep ? h0 * o.w / w0 : Math.max(0.005, h0 + dh);
        const cur = $(".obj.sel", ov); if (cur) { cur.style.width = o.w * 100 + "%"; cur.style.height = o.h * 100 + "%"; }
      };
      const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); renderObjs(); };
      addEventListener("pointermove", mv); addEventListener("pointerup", up);
    });
  }

  // -------- drawing on the overlay
  ov.addEventListener("pointerdown", (e) => {
    const r = wrap.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    if (S.tool === "select" || S.tool === "edittext") { if (S.sel) select(null); return; }
    e.preventDefault();
    if (S.tool === "text") {
      const o = newObj({ type: "text", text: "", x: px, y: py - (S.size * scale() * 0.6) / r.height, w: 0.05, h: 0.03, size: S.size, color: S.color, font: S.font, bold: false });
      setTool("select"); select(o); return;
    }
    if (S.tool === "check") { const s = 0.035; newObj({ type: "check", x: px - s / 2, y: py - s * r.width / r.height / 2, w: s, h: s * r.width / r.height, color: S.color }); return; }
    ov.setPointerCapture(e.pointerId);
    const rub = h(`<div class="rubber"></div>`); ov.append(rub);
    const pts = [[px, py]];
    let svg;
    if (S.tool === "draw" || S.tool === "line") {
      svg = h(`<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" viewBox="0 0 1 1" preserveAspectRatio="none"><polyline fill="none" stroke="${S.color}" stroke-width="${Math.max(1, S.stroke * scale())}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`);
      ov.append(svg); rub.remove();
    }
    const mv = (ev) => {
      const x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
      if (S.tool === "draw") pts.push([x, y]); else pts[1] = [x, y];
      if (svg) $("polyline", svg).setAttribute("points", pts.map(p => p.join(",")).join(" "));
      else { const [a, b] = [pts[0], pts[1]]; Object.assign(rub.style, { left: Math.min(a[0], b[0]) * 100 + "%", top: Math.min(a[1], b[1]) * 100 + "%", width: Math.abs(b[0] - a[0]) * 100 + "%", height: Math.abs(b[1] - a[1]) * 100 + "%" }); }
    };
    const up = () => {
      ov.removeEventListener("pointermove", mv); ov.removeEventListener("pointerup", up); ov.removeEventListener("pointercancel", up);
      rub.remove(); svg?.remove();
      if (pts.length < 2) return;
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      let x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, hh = Math.max(...ys) - y0;
      if (S.tool === "draw" || S.tool === "line") {
        if (w < 0.002 && hh < 0.002) return;
        w = Math.max(w, 0.002); hh = Math.max(hh, 0.002);
        const norm = pts.map(([x, y]) => [(x - x0) / w, (y - y0) / hh]);
        if (S.tool === "draw") newObj({ type: "ink", x: x0, y: y0, w, h: hh, paths: [norm], color: S.color, stroke: S.stroke });
        else newObj({ type: "line", x: x0, y: y0, w, h: hh, pts: norm, color: S.color, stroke: S.stroke });
        return;
      }
      if (w < 0.01 || hh < 0.005) return;
      const base = { x: x0, y: y0, w, h: hh };
      if (S.tool === "highlight") newObj({ type: "highlight", ...base, color: "#ffeb33" });
      else if (S.tool === "whiteout") newObj({ type: "whiteout", ...base, color: "#ffffff" });
      else if (S.tool === "redact") newObj({ type: "redact", ...base });
      else if (S.tool === "link") { const url = prompt("Link address (https://…)", "https://"); if (url && url.length > 8) newObj({ type: "link", ...base, url }); }
      else newObj({ type: S.tool, ...base, color: S.color, stroke: S.stroke, fill: "" });
    };
    ov.addEventListener("pointermove", mv); ov.addEventListener("pointerup", up); ov.addEventListener("pointercancel", up);
  });

  // -------- edit existing text
  async function showLines() {
    $$(".ln", ov).forEach(e => e.remove());
    const pno = S.cur;
    if (!S.linesCache[pno]) {
      try { S.linesCache[pno] = (await getJSON(`/api/doc/${d.doc}/lines/${pno}`)).lines; } catch { S.linesCache[pno] = []; }
    }
    if (S.tool !== "edittext" || S.cur !== pno) return;
    const used = new Set(S.objs.filter(o => o.replace && o.page === pno).map(o => o.replace.k));
    const lines = S.linesCache[pno];
    if (!lines.length) toast("No editable text on this page (it may be a scanned image — use OCR first, or white-out + Add text).", false, 5000);
    lines.forEach((l, k) => {
      if (used.has(k)) return;
      const el = h(`<div class="ln" title="Click to edit"></div>`);
      Object.assign(el.style, { left: l.x * 100 + "%", top: l.y * 100 + "%", width: l.w * 100 + "%", height: l.h * 100 + "%" });
      el.onpointerdown = (e) => {
        e.stopPropagation(); e.preventDefault();
        const o = newObj({ type: "text", text: l.text, x: l.x, y: l.y, w: l.w, h: l.h, size: l.size, color: l.color, font: l.font, bold: l.bold, replace: { ...l, k } });
        el.remove(); select(o);
      };
      ov.append(el);
    });
  }

  // -------- property bar
  function renderProps() {
    props.innerHTML = "";
    const o = selObj();
    const tool = S.tool;
    const add = (el) => props.append(el);
    const colorInp = (val, fn) => { const c = h(`<input type="color" value="${val}">`); c.oninput = () => fn(c.value); return c; };
    if (!o) {
      const hints = { select: "Tap an item to select it. Pick a tool above to add something.", text: "Tap where you want the text.", edittext: "Tap any outlined line of text to change it.",
        draw: "Draw with your mouse, finger or pen.", highlight: "Drag over the text to highlight.", whiteout: "Drag over anything to cover it with white.", redact: "Drag over content to permanently black it out.",
        rect: "Drag to draw a rectangle.", ellipse: "Drag to draw an ellipse.", line: "Drag to draw a line.", check: "Tap to place a check mark.", link: "Drag over an area to make it a clickable link." };
      add(h(`<span class="hint">${hints[tool] || ""}</span>`));
      if (["text", "draw", "rect", "ellipse", "line", "check"].includes(tool)) {
        add(h(`<span style="margin-left:auto">Color</span>`)); add(colorInp(S.color, v => { S.color = v; store.set("ed.color", v); }));
        if (tool === "text") { const s = h(`<input class="inp" type="number" min="4" max="200" value="${S.size}" style="width:70px" title="Font size">`); s.oninput = () => S.size = +s.value || 14; add(s); }
        if (["draw", "rect", "ellipse", "line"].includes(tool)) { const s = h(`<select class="inp" title="Thickness">${[1, 2, 3, 5, 8].map(v => `<option ${v === S.stroke ? "selected" : ""}>${v}</option>`).join("")}</select>`); s.onchange = () => S.stroke = +s.value; add(s); }
      }
      return;
    }
    const upd = (fn) => { snapshot(); fn(); renderObjs(); };
    if (o.type === "text") {
      const f = h(`<select class="inp" title="Font">${FONTS.map(([v, l]) => `<option value="${v}" ${o.font === v ? "selected" : ""}>${l}</option>`).join("")}</select>`);
      f.onchange = () => upd(() => o.font = f.value);
      const s = h(`<input class="inp" type="number" min="4" max="300" step="0.5" value="${o.size}" style="width:72px" title="Size">`);
      s.oninput = () => { o.size = +s.value || o.size; renderObjs(); };
      const b = h(`<button class="btn sm ${o.bold ? "primary" : ""}" title="Bold"><b>B</b></button>`);
      b.onclick = () => upd(() => { o.bold = !o.bold; renderProps(); });
      add(f); add(s); add(b); add(colorInp(o.color, v => { o.color = v; renderObjs(); }));
      if (o.replace) add(h(`<span class="hint">Replacing original text</span>`));
    } else if (["rect", "ellipse", "line", "ink", "check"].includes(o.type)) {
      add(h(`<span>Color</span>`)); add(colorInp(o.color, v => { o.color = v; renderObjs(); }));
      if (o.type !== "check") { const s = h(`<select class="inp">${[1, 2, 3, 5, 8].map(v => `<option ${v === o.stroke ? "selected" : ""}>${v}</option>`).join("")}</select>`); s.onchange = () => upd(() => o.stroke = +s.value); add(s); }
      if (o.type === "rect" || o.type === "ellipse") {
        const fl = h(`<label class="check" style="margin:0"><input type="checkbox" ${o.fill ? "checked" : ""}> Fill</label>`);
        $("input", fl).onchange = (e) => upd(() => o.fill = e.target.checked ? o.color : "");
        add(fl);
      }
      if (o.type === "check") { const m = h(`<button class="btn sm">${o.mark === "x" ? "✗ → ✓" : "✓ → ✗"}</button>`); m.onclick = () => upd(() => { o.mark = o.mark === "x" ? "" : "x"; renderProps(); }); add(m); }
    } else if (o.type === "whiteout" || o.type === "highlight") {
      add(h(`<span>Color</span>`)); add(colorInp(o.color, v => { o.color = v; renderObjs(); }));
    } else if (o.type === "link") {
      const u = h(`<input class="inp" style="min-width:220px" value="${esc(o.url)}">`); u.oninput = () => o.url = u.value; add(u);
    } else if (o.type === "image") {
      const op = h(`<label style="display:flex;gap:6px;align-items:center">Opacity <input type="range" min="0.1" max="1" step="0.05" value="${o.opacity ?? 1}"></label>`);
      $("input", op).oninput = (e) => { o.opacity = +e.target.value; $(".obj.sel img", ov).style.opacity = o.opacity; };
      add(op);
    }
    const dup = h(`<button class="btn sm" style="margin-left:auto" title="Duplicate">${icon("copy")}</button>`);
    dup.onclick = () => { const c = JSON.parse(JSON.stringify(o)); c.x += 0.02; c.y += 0.02; delete c.id; if (o.url) c.url = o.url; newObj(c); };
    const allPages = h(`<button class="btn sm" title="Copy to all pages">All pages</button>`);
    allPages.onclick = () => { snapshot(); d.pages.forEach((_, i) => { if (i !== o.page) { const c = JSON.parse(JSON.stringify(o)); c.page = i; c.id = Math.random().toString(36).slice(2); delete c.replace; S.objs.push(c); } }); toast(`Copied to ${d.pages.length - 1} pages`); renderObjs(); };
    const del = h(`<button class="btn sm" title="Delete">${icon("trash")}</button>`);
    del.onclick = deleteSel;
    add(dup); if (!o.replace) add(allPages); add(del);
  }

  // -------- save
  $(".save", root).onclick = async (ev) => {
    const b = ev.currentTarget;
    if (!S.objs.length) return toast("Nothing changed yet — add something first", true);
    b.disabled = true;
    const fd = new FormData();
    const ops = S.objs.map(o => {
      const c = { ...o };
      delete c.url; delete c.id;
      if (o.type === "ink") { c.paths = o.paths.map(p => p.map(([u, v]) => [o.x + u * o.w, o.y + v * o.h])); }
      if (o.type === "line") { const [[u1, v1], [u2, v2]] = o.pts; Object.assign(c, { x1: o.x + u1 * o.w, y1: o.y + v1 * o.h, x2: o.x + u2 * o.w, y2: o.y + v2 * o.h }); }
      if (o.type === "text" && o.replace) c.replace = { x: o.replace.x, y: o.replace.y, w: o.replace.w, h: o.replace.h };
      return c;
    }).filter(o => o.type !== "text" || o.text.trim() || o.replace);
    const used = new Set(ops.map(o => o.asset).filter(Boolean));
    for (const k of used) fd.append(k, S.assets[k], k + ".png");
    fd.append("options", JSON.stringify({ doc: d.doc, ops, filename: $(".fname", root).value || "edited.pdf" }));
    try { const res = await send("/api/run/edit", fd); const r = $(".res", root); r.innerHTML = ""; r.append(resultPanel(t, res)); r.scrollIntoView({ behavior: "smooth" }); }
    catch (e) { toast(e.message, true); }
    b.disabled = false;
  };

  img.onload = () => renderObjs();
  showPage(0);
  setTool(t.startTool === "sign" ? "sign" : "select");
}

// ------------------------------------------------------------------ signature dialog
function signatureDialog(onDone) {
  const saved = store.get("signatures", []);
  const body = h(`<div>
    <div class="seg" style="margin-bottom:12px"><button class="on" data-m="draw">Draw</button><button data-m="type">Type</button><button data-m="upload">Upload</button></div>
    <div data-p="draw"><canvas class="sigpad"></canvas>
      <div style="display:flex;gap:8px;margin-top:8px;align-items:center"><span class="muted" style="font-size:13px">Color</span>
        <button class="btn sm" data-c="#000000">Black</button><button class="btn sm" data-c="#1d3fbb">Blue</button><button class="btn sm" data-c="#b01818">Red</button>
        <button class="btn sm" data-clear style="margin-left:auto">Clear</button></div></div>
    <div data-p="type" class="hide"><input class="inp" placeholder="Type your name" style="font-size:18px">
      <div class="saved-sigs fonts" style="margin-top:10px"></div></div>
    <div data-p="upload" class="hide"><button class="btn">${icon("image")} Choose image of signature</button>
      <label class="check" style="margin-top:10px"><input type="checkbox" checked> Remove white background</label><div class="up-prev" style="margin-top:8px"></div></div>
    <label class="check" style="margin-top:12px"><input type="checkbox" class="keep" checked> Remember this signature on this device</label>
    ${saved.length ? `<div class="muted" style="font-size:13px;margin-top:6px">Saved signatures (tap to use)</div><div class="saved-sigs saved"></div>` : ""}
  </div>`);
  let mode = "draw", color = "#000000", typed = { font: "'Segoe Script', cursive" }, uploaded = null;
  const cv = $(".sigpad", body);
  const ctx = cv.getContext("2d");
  let drawn = false;
  const fit = () => { const r = cv.getBoundingClientRect(); cv.width = r.width * 2; cv.height = r.height * 2; ctx.lineWidth = 5; ctx.lineCap = ctx.lineJoin = "round"; };
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId); drawn = true;
    const r = cv.getBoundingClientRect(); ctx.strokeStyle = color; ctx.beginPath();
    let lx = (e.clientX - r.left) * 2, ly = (e.clientY - r.top) * 2; ctx.moveTo(lx, ly);
    cv.onpointermove = (ev) => {
      const x = (ev.clientX - r.left) * 2, y = (ev.clientY - r.top) * 2;
      ctx.quadraticCurveTo(lx, ly, (x + lx) / 2, (y + ly) / 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo((x + lx) / 2, (y + ly) / 2); lx = x; ly = y;
    };
    cv.onpointerup = () => { cv.onpointermove = null; };
  });
  $$("[data-c]", body).forEach(b => b.onclick = () => { color = b.dataset.c; });
  $("[data-clear]", body).onclick = () => { ctx.clearRect(0, 0, cv.width, cv.height); drawn = false; };
  $$("[data-m]", body).forEach(b => b.onclick = () => {
    mode = b.dataset.m;
    $$("[data-m]", body).forEach(x => x.classList.toggle("on", x === b));
    $$("[data-p]", body).forEach(p => p.classList.toggle("hide", p.dataset.p !== mode));
  });
  const fonts = [["'Segoe Script', cursive", "Script"], ["'Ink Free', cursive", "Hand"], ["'Brush Script MT', 'Segoe Script', cursive", "Brush"], ["'Lucida Handwriting', cursive", "Lucida"]];
  const fbox = $(".fonts", body), tinp = $("[data-p=type] input", body);
  const renderFonts = () => {
    fbox.innerHTML = "";
    for (const [ff, label] of fonts) {
      const b = h(`<button class="s" style="font-family:${ff};font-size:22px;padding:6px 14px;color:${color};${typed.font === ff ? "outline:2px solid var(--accent)" : ""}" title="${label}">${esc(tinp.value || "Your name")}</button>`);
      b.onclick = () => { typed.font = ff; renderFonts(); };
      fbox.append(b);
    }
  };
  tinp.oninput = renderFonts; renderFonts();
  $("[data-p=upload] .btn", body).onclick = async () => { const [f] = await pickFiles(IMG); if (f) { uploaded = f; $(".up-prev", body).innerHTML = `<img src="${URL.createObjectURL(f)}" style="max-height:90px">`; } };
  const savedBox = $(".saved", body);
  const renderSaved = () => {
    if (!savedBox) return;
    savedBox.innerHTML = "";
    saved.forEach((u, i) => {
      const s = h(`<div class="s"><img src="${u}"><button class="x" title="Remove">×</button></div>`);
      s.onclick = async (e) => {
        if (e.target.classList.contains("x")) { saved.splice(i, 1); store.set("signatures", saved); renderSaved(); return; }
        const blob = await (await fetch(u)).blob(); const im = new Image(); im.onload = () => { onDone(blob, im.width, im.height); m.close(); }; im.src = u;
      };
      savedBox.append(s);
    });
  };
  renderSaved();

  const finish = async () => {
    let canvas;
    if (mode === "draw") { if (!drawn) { toast("Draw your signature first", true); return false; } canvas = cv; }
    else if (mode === "type") {
      const name = tinp.value.trim(); if (!name) { toast("Type your name", true); return false; }
      canvas = document.createElement("canvas"); canvas.width = 1400; canvas.height = 360;
      const c = canvas.getContext("2d"); c.fillStyle = color; c.font = `150px ${typed.font}`; c.textBaseline = "middle"; c.fillText(name, 30, 180);
    } else {
      if (!uploaded) { toast("Choose an image", true); return false; }
      const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = URL.createObjectURL(uploaded); });
      canvas = document.createElement("canvas"); canvas.width = im.naturalWidth; canvas.height = im.naturalHeight;
      const c = canvas.getContext("2d"); c.drawImage(im, 0, 0);
      if ($("[data-p=upload] input[type=checkbox]", body).checked) {
        const id = c.getImageData(0, 0, canvas.width, canvas.height), px = id.data;
        for (let i = 0; i < px.length; i += 4) { const l = (px[i] + px[i + 1] + px[i + 2]) / 3; if (l > 200) px[i + 3] = 0; else if (l > 140) px[i + 3] = Math.round(255 * (200 - l) / 60); }
        c.putImageData(id, 0, 0);
      }
    }
    const trimmed = trimCanvas(canvas);
    if (!trimmed) { toast("Signature is empty", true); return false; }
    const url = trimmed.toDataURL("image/png");
    if ($(".keep", body).checked && !saved.includes(url)) { saved.unshift(url); store.set("signatures", saved.slice(0, 6)); }
    const blob = await new Promise(r => trimmed.toBlob(r, "image/png"));
    onDone(blob, trimmed.width, trimmed.height);
  };
  const m = modal("Your signature", body, [["Cancel"], ["Use signature", finish, true]]);
  requestAnimationFrame(fit);
}
function trimCanvas(c) {
  const ctx = c.getContext("2d"), { width: w, height: hh } = c, d = ctx.getImageData(0, 0, w, hh).data;
  let x0 = w, y0 = hh, x1 = -1, y1 = -1;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const pad = 6, out = document.createElement("canvas");
  out.width = x1 - x0 + pad * 2; out.height = y1 - y0 + pad * 2;
  out.getContext("2d").drawImage(c, x0 - pad, y0 - pad, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// ------------------------------------------------------------------ connect phone
$("#btn-phone").onclick = async () => {
  let info;
  try { info = await getJSON("/api/connect"); } catch (e) { return toast(e.message, true); }
  const body = h(`<div class="qr"></div>`);
  if (!info.local) {
    if (ANDROID) {
      body.innerHTML = `<p>You're using the MyPDF app, connected to <code>${esc(ANDROID.server())}</code>.</p>`;
      return modal("Connected", body, [["Connect to a different computer", () => ANDROID.reset()], ["Close", null, true]]);
    }
    return installGuide();
  }
  if (!info.urls.length) {
    body.innerHTML = `<p>No Wi-Fi network found. Connect this computer and your phone to the same Wi-Fi, then try again.</p>`;
    return modal("Use on your phone", body);
  }
  body.innerHTML = `${info.qrs[0]}<code>${esc(info.urls[0])}</code>
    <ol class="steps"><li>Connect your phone to the <b>same Wi-Fi</b> as this computer.</li>
    <li>Scan this QR code with your phone camera (or type the address).</li>
    <li><b>Android:</b> on the page that opens, tap <b>Get the app</b> to install the MyPDF app, then scan this code again from inside the app. <b>iPhone:</b> Safari → Share → <b>Add to Home Screen</b>.</li>
    <li>Keep MyPDF running on this computer while you use it on the phone. If Windows asks, allow access on <b>Private networks</b>.</li></ol>`;
  if (info.urls.length > 1) body.append(h(`<details><summary class="muted">Other addresses</summary>${info.urls.slice(1).map(u => `<code style="display:block;margin-top:6px">${esc(u)}</code>`).join("")}</details>`));
  modal("Use MyPDF on your phone", body, [["New key (log out other devices)", async () => { await fetch("/api/connect/reset", { method: "POST" }); toast("Key changed — scan the new code"); $("#btn-phone").click(); }], ["Close", null, true]]);
};

// ------------------------------------------------------------------ boot
if (LOCAL) $("#btn-phone")?.remove();
if (!LOCAL && "serviceWorker" in navigator && window.isSecureContext) navigator.serviceWorker.register("sw.js").catch(() => {});
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => {
  if (e.target.closest(".drop")) return;
  e.preventDefault();
  const files = [...(e.dataTransfer?.files || [])];
  if (files.length) openIncoming(files, location.hash.startsWith("#/tool/"));
});
// Files dropped on the page or shared into the Android app: open the most likely tool
function openIncoming(files, stayOnTool) {
  carry = files;
  if (stayOnTool) { route(); return; }
  const allPdf = files.every(f => /\.pdf$/i.test(f.name)), allImg = files.every(f => /^image\//.test(f.type));
  const target = "#/tool/" + (allPdf ? (files.length > 1 ? "merge" : "edit") : allImg ? "images_to_pdf" : "to_pdf");
  if (location.hash === target) route(); else go(target);
}
window.receiveShared = () => {
  const n = ANDROID?.sharedCount?.() || 0;
  if (!n) return;
  const files = [];
  for (let i = 0; i < n; i++) {
    try {
      const o = JSON.parse(ANDROID.sharedFile(i));
      if (!o.data) continue;
      const bin = atob(o.data), bytes = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
      files.push(new File([bytes], o.name, { type: o.type }));
    } catch { /* skip unreadable file */ }
  }
  if (!files.length) return;
  toast(`${files.length} file${files.length > 1 ? "s" : ""} received`);
  // a single PDF: let the user pick what to do with it
  if (files.length === 1 && /\.pdf$/i.test(files[0].name)) { carry = []; continueWithFiles(files, `What do you want to do with ${files[0].name}?`); return; }
  openIncoming(files, false);
};
route();
receiveShared();
