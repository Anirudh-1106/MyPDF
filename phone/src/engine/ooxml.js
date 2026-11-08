// Tiny writers for DOCX, XLSX, PPTX and EPUB (no external libraries).
import { makeZip } from "./zip.js";

const X = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, ""); // characters XML forbids
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const REL = (id, type, target) => `<Relationship Id="${id}" Type="${NS_R}/${type}" Target="${target}"/>`;
const RELS = (items) => `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.join("")}</Relationships>`;
const types = (overrides) => `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="jpg" ContentType="image/jpeg"/>
${overrides.map(([p, t]) => `<Override PartName="${p}" ContentType="${t}"/>`).join("")}</Types>`;
const EMU = 12700; // per point

// ================================================================ DOCX
/** pages: [{w, h, items:[{type:"p", runs:[{text,size,bold,italic,color,font}], before, indent, align} | {type:"img", data, ext, w, h}]}] */
export async function buildDocx(pages) {
  const media = [];
  let pid = 1;
  const body = [];
  pages.forEach((pg, pi) => {
    if (pi > 0) body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    for (const it of pg.items) {
      if (it.type === "img") {
        const id = `rIdImg${media.length + 1}`, name = `image${media.length + 1}.${it.ext}`;
        media.push({ id, name, data: it.data });
        const cx = Math.round(it.w * EMU), cy = Math.round(it.h * EMU), n = pid++;
        body.push(`<w:p><w:pPr><w:spacing w:before="${Math.round((it.before || 0) * 20)}" w:after="0"/>${it.indent ? `<w:ind w:left="${Math.round(it.indent * 20)}"/>` : ""}</w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Picture ${n}"/>`
          + `<a:graphic xmlns:a="${NS_A}"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">`
          + `<pic:nvPicPr><pic:cNvPr id="${n}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
          + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`);
        continue;
      }
      const ppr = `<w:pPr>${it.style ? `<w:pStyle w:val="${it.style}"/>` : ""}<w:spacing w:before="${Math.round(Math.min(it.before || 0, 40) * 20)}" w:after="0"/>`
        + `${it.indent > 0 ? `<w:ind w:left="${Math.round(it.indent * 20)}"/>` : ""}${it.align ? `<w:jc w:val="${it.align}"/>` : ""}</w:pPr>`;
      const runs = it.runs.map(r => {
        const sz = Math.max(2, Math.round(r.size * 2));
        const font = r.font || "Calibri";
        return `<w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>${r.bold ? "<w:b/>" : ""}${r.italic ? "<w:i/>" : ""}`
          + `${r.color && r.color !== "#000000" ? `<w:color w:val="${r.color.slice(1).toUpperCase()}"/>` : ""}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`
          + `<w:t xml:space="preserve">${X(r.text)}</w:t></w:r>`;
      }).join("");
      body.push(`<w:p>${ppr}${runs}</w:p>`);
    }
  });
  const first = pages[0] || { w: 595, h: 842, margins: [36, 36, 36, 36] };
  const [mt, mr, mb, ml] = (first.margins || [36, 36, 36, 36]).map(v => Math.round(v * 20));
  const doc = `${HEAD}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="${NS_R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">`
    + `<w:body>${body.join("")}<w:sectPr><w:pgSz w:w="${Math.round(first.w * 20)}" w:h="${Math.round(first.h * 20)}"/>`
    + `<w:pgMar w:top="${mt}" w:right="${mr}" w:bottom="${mb}" w:left="${ml}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `${HEAD}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
    + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>`
    + [1, 2, 3].map(i => `<w:style w:type="paragraph" w:styleId="Heading${i}"><w:name w:val="heading ${i}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="${i - 1}"/></w:pPr></w:style>`).join("")
    + `</w:styles>`;
  return makeZip([
    { name: "[Content_Types].xml", data: types([["/word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"], ["/word/styles.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"]]) },
    { name: "_rels/.rels", data: RELS([REL("rId1", "officeDocument", "word/document.xml")]) },
    { name: "word/document.xml", data: doc },
    { name: "word/styles.xml", data: styles },
    { name: "word/_rels/document.xml.rels", data: RELS([REL("rIdStyles", "styles", "styles.xml"), ...media.map(m => REL(m.id, "image", "media/" + m.name))]) },
    ...media.map(m => ({ name: "word/media/" + m.name, data: m.data, store: true })),
  ]);
}

/** Plain paragraphs -> DOCX (OCR output). */
export const textToDocx = (text) => buildDocx([{ w: 595, h: 842, margins: [72, 72, 72, 72], items: String(text).split("\n").map(t => ({ type: "p", runs: [{ text: t, size: 11 }] })) }]);

// ================================================================ XLSX
const colName = (i) => { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

/** sheets: [{name, rows: [[value...]], boldFirst}] */
export async function buildXlsx(sheets) {
  const used = new Set();
  const names = sheets.map((s, i) => {
    let n = String(s.name || `Sheet${i + 1}`).replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || `Sheet${i + 1}`;
    let k = 2; const base = n.slice(0, 28);
    while (used.has(n.toLowerCase())) n = `${base} ${k++}`;
    used.add(n.toLowerCase());
    return n;
  });
  const files = [];
  sheets.forEach((s, si) => {
    const widths = [];
    const rows = s.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      if (v === null || v === undefined || v === "") return "";
      widths[ci] = Math.max(widths[ci] || 8, Math.min(60, String(v).length + 2));
      const ref = colName(ci) + (ri + 1), st = s.boldFirst && ri === 0 ? ' s="1"' : "";
      return typeof v === "number" && Number.isFinite(v) ? `<c r="${ref}"${st}><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${X(v)}</t></is></c>`;
    }).join("")}</row>`).join("");
    const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w || 8}" customWidth="1"/>`).join("")}</cols>` : "";
    files.push({ name: `xl/worksheets/sheet${si + 1}.xml`, data: `${HEAD}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rows}</sheetData></worksheet>` });
  });
  const wb = `${HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${NS_R}"><sheets>${names.map((n, i) => `<sheet name="${X(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`;
  const styles = `${HEAD}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>`
    + `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>`
    + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return makeZip([
    { name: "[Content_Types].xml", data: types([["/xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"], ["/xl/styles.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"],
      ...sheets.map((_, i) => [`/xl/worksheets/sheet${i + 1}.xml`, "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"])]) },
    { name: "_rels/.rels", data: RELS([REL("rId1", "officeDocument", "xl/workbook.xml")]) },
    { name: "xl/workbook.xml", data: wb },
    { name: "xl/styles.xml", data: styles },
    { name: "xl/_rels/workbook.xml.rels", data: RELS([...sheets.map((_, i) => REL(`rId${i + 1}`, "worksheet", `worksheets/sheet${i + 1}.xml`)), REL(`rId${sheets.length + 1}`, "styles", "styles.xml")]) },
    ...files,
  ]);
}

// ================================================================ PPTX
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const P_NS = `xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"`;
const EMPTY_TREE = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>';
const THEME = (() => {
  const c = (n, v) => `<a:${n}><a:srgbClr val="${v}"/></a:${n}>`;
  const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  const font = '<a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/>';
  return `${HEAD}<a:theme xmlns:a="${NS_A}" name="MyPDF"><a:themeElements><a:clrScheme name="MyPDF">${c("dk1", "000000")}${c("lt1", "FFFFFF")}${c("dk2", "44546A")}${c("lt2", "E7E6E6")}`
    + `${c("accent1", "4472C4")}${c("accent2", "ED7D31")}${c("accent3", "A5A5A5")}${c("accent4", "FFC000")}${c("accent5", "5B9BD5")}${c("accent6", "70AD47")}${c("hlink", "0563C1")}${c("folHlink", "954F72")}</a:clrScheme>`
    + `<a:fontScheme name="MyPDF"><a:majorFont>${font}</a:majorFont><a:minorFont>${font}</a:minorFont></a:fontScheme>`
    + `<a:fmtScheme name="MyPDF"><a:fillStyleLst>${fill}${fill}${fill}</a:fillStyleLst><a:lnStyleLst>${`<a:ln w="6350">${fill}</a:ln>`.repeat(3)}</a:lnStyleLst>`
    + `<a:effectStyleLst>${"<a:effectStyle><a:effectLst/></a:effectStyle>".repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${fill}${fill}${fill}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
})();

/** slides: [{data (jpeg bytes), ext}], size [wPt, hPt] */
export async function buildPptx(slides, [wPt, hPt]) {
  const cx = Math.min(51206400, Math.max(914400, Math.round(wPt * EMU))), cy = Math.min(51206400, Math.max(914400, Math.round(hPt * EMU)));
  const files = [
    { name: "[Content_Types].xml", data: types([["/ppt/presentation.xml", "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"],
      ["/ppt/slideMasters/slideMaster1.xml", "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"],
      ["/ppt/slideLayouts/slideLayout1.xml", "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"],
      ["/ppt/theme/theme1.xml", "application/vnd.openxmlformats-officedocument.theme+xml"],
      ...slides.map((_, i) => [`/ppt/slides/slide${i + 1}.xml`, "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"])]) },
    { name: "_rels/.rels", data: RELS([REL("rId1", "officeDocument", "ppt/presentation.xml")]) },
    { name: "ppt/presentation.xml", data: `${HEAD}<p:presentation ${P_NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>`
      + `<p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 3}"/>`).join("")}</p:sldIdLst><p:sldSz cx="${cx}" cy="${cy}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` },
    { name: "ppt/_rels/presentation.xml.rels", data: RELS([REL("rId1", "slideMaster", "slideMasters/slideMaster1.xml"), REL("rId2", "theme", "theme/theme1.xml"),
      ...slides.map((_, i) => REL(`rId${i + 3}`, "slide", `slides/slide${i + 1}.xml`))]) },
    { name: "ppt/slideMasters/slideMaster1.xml", data: `${HEAD}<p:sldMaster ${P_NS}><p:cSld>${EMPTY_TREE}</p:spTree></p:cSld>`
      + `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>`
      + `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>` },
    { name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: RELS([REL("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"), REL("rId2", "theme", "../theme/theme1.xml")]) },
    { name: "ppt/slideLayouts/slideLayout1.xml", data: `${HEAD}<p:sldLayout ${P_NS} type="blank" preserve="1"><p:cSld name="Blank">${EMPTY_TREE}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` },
    { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: RELS([REL("rId1", "slideMaster", "../slideMasters/slideMaster1.xml")]) },
    { name: "ppt/theme/theme1.xml", data: THEME },
  ];
  slides.forEach((s, i) => {
    files.push({ name: `ppt/slides/slide${i + 1}.xml`, data: `${HEAD}<p:sld ${P_NS}><p:cSld>${EMPTY_TREE}<p:pic><p:nvPicPr><p:cNvPr id="2" name="Page ${i + 1}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>`
      + `<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
      + `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>` });
    files.push({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: RELS([REL("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"), REL("rId2", "image", `../media/page${i + 1}.${s.ext}`)]) });
    files.push({ name: `ppt/media/page${i + 1}.${s.ext}`, data: s.data, store: true });
  });
  return makeZip(files);
}

// ================================================================ EPUB
/** chapters: [{title, html}], images: [{name, data, type}] */
export async function buildEpub(title, chapters, images = []) {
  const uid = "urn:uuid:" + (globalThis.crypto?.randomUUID?.() || String(Date.now()));
  const files = [
    { name: "mimetype", data: "application/epub+zip", store: true },
    { name: "META-INF/container.xml", data: `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>` },
  ];
  const manifest = chapters.map((_, i) => `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`).join("")
    + images.map((im, i) => `<item id="img${i}" href="${im.name}" media-type="${im.type}"/>`).join("");
  const spine = chapters.map((_, i) => `<itemref idref="c${i}"/>`).join("");
  files.push({ name: "OEBPS/content.opf", data: `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${X(title)}</dc:title><dc:identifier id="id">${uid}</dc:identifier><dc:language>en</dc:language></metadata><manifest>${manifest}<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest><spine toc="ncx">${spine}</spine></package>` });
  files.push({ name: "OEBPS/toc.ncx", data: `<?xml version="1.0" encoding="utf-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${uid}"/></head><docTitle><text>${X(title)}</text></docTitle><navMap>${chapters.map((c, i) => `<navPoint id="n${i}" playOrder="${i + 1}"><navLabel><text>${X(c.title)}</text></navLabel><content src="c${i}.xhtml"/></navPoint>`).join("")}</navMap></ncx>` });
  chapters.forEach((c, i) => files.push({ name: `OEBPS/c${i}.xhtml`, data: `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${X(c.title)}</title></head><body>${c.html}</body></html>` }));
  images.forEach(im => files.push({ name: "OEBPS/" + im.name, data: im.data, store: true }));
  return makeZip(files);
}
