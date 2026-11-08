// Reading-order text blocks with styling, used by PDF -> Word / Markdown / HTML / EPUB / Excel.
import { colorHex, escHtml as esc } from "./core.js";

export function pageBlocks(page, { images = true } = {}) {
  const st = page.toStructuredText(images ? "preserve-images,preserve-whitespace" : "preserve-whitespace");
  const blocks = [];
  let block = null, line = null, span = null;
  st.walk({
    onImageBlock(bbox, transform, image) { if (images) blocks.push({ type: "image", bbox, image }); },
    beginTextBlock(bbox) { block = { type: "text", bbox, lines: [] }; },
    beginLine(bbox, wmode, dir) { line = { bbox, dir, spans: [] }; span = null; },
    onChar(c, origin, font, size, quad, color) {
      const name = font.getName();
      const bold = font.isBold() || /bold|black|heavy|semibold|demi/i.test(name);
      const italic = font.isItalic() || /italic|oblique/i.test(name);
      const col = colorHex(color || [0]);
      const key = `${bold}|${italic}|${size.toFixed(1)}|${col}`;
      const x0 = Math.min(quad[0], quad[4]), x1 = Math.max(quad[2], quad[6]);
      if (span && span.key === key && x0 - span.x1 > size * 0.9 && c !== " ") span.text += " "; // visual gap = space
      if (!span || span.key !== key) {
        span = { key, text: "", size, font: name, bold, italic, color: col, mono: font.isMono() || /mono|courier|consol/i.test(name),
          serif: font.isSerif() && !/sans|arial|helv|calibri|verdana|segoe|roboto/i.test(name), x0, x1 };
        line.spans.push(span);
      }
      span.text += c;
      span.x1 = x1;
    },
    endLine() { if (line?.spans.length && block) block.lines.push(line); line = null; },
    endTextBlock() { if (block?.lines.length) blocks.push(block); block = null; },
  });
  st.destroy?.();
  return blocks;
}

export const blockText = (b) => b.lines.map(l => l.spans.map(s => s.text).join("")).join("\n");

/** Most common font size on the page(s), weighted by characters. */
export function bodySize(allBlocks) {
  const count = new Map();
  for (const b of allBlocks) if (b.type === "text") for (const l of b.lines) for (const s of l.spans) {
    const k = Math.round(s.size * 2) / 2;
    count.set(k, (count.get(k) || 0) + s.text.trim().length);
  }
  let best = 11, n = -1;
  for (const [k, v] of count) if (v > n) { best = k; n = v; }
  return best;
}

const BULLET = /^\s*([•◦▪▫●○■□–\-*·‣⁃])\s+/;
const NUMBERED = /^\s*(\d{1,3}[.)]|[a-z][.)])\s+/i;

/** Turn a text block into paragraphs: [{kind:"h1|h2|h3|p|li|oli", spans:[...] }] */
export function blockParagraphs(b, body) {
  const maxSize = Math.max(...b.lines.flatMap(l => l.spans.map(s => s.size)));
  const text = blockText(b).trim();
  if (!text) return [];
  const allBold = b.lines.every(l => l.spans.every(s => s.bold || !s.text.trim()));
  let head = null;
  if (text.length < 200) {
    if (maxSize >= body * 1.6) head = "h1";
    else if (maxSize >= body * 1.3) head = "h2";
    else if (maxSize >= body * 1.12 || (allBold && text.length < 90 && b.lines.length <= 2)) head = "h3";
  }
  if (head) return [{ kind: head, spans: joinLines(b.lines) }];
  // split into list items / paragraphs
  const paras = [];
  let cur = null;
  const bw = Math.max(1, b.bbox[2] - b.bbox[0]);
  let prev = null;
  for (const l of b.lines) {
    const t = l.spans.map(s => s.text).join("");
    const isBullet = BULLET.test(t), isNum = NUMBERED.test(t);
    // short lines and table-like rows (wide gaps) stay on their own line
    const breakHere = prev && ((prev.bbox[2] - prev.bbox[0]) < bw * 0.7 || /\S\s{3,}\S/.test(t) || /\S\s{3,}\S/.test(prev.t));
    prev = { bbox: l.bbox, t };
    if (isBullet || isNum || !cur || breakHere) {
      cur = { kind: isBullet ? "li" : isNum ? "oli" : "p", lines: [] };
      paras.push(cur);
      if (isBullet) l.spans[0] = { ...l.spans[0], text: l.spans[0].text.replace(BULLET, "") };
    }
    cur.lines.push(l);
  }
  return paras.map(p => ({ kind: p.kind, spans: joinLines(p.lines) }));
}

function joinLines(lines) {
  const out = [];
  lines.forEach((l, i) => {
    l.spans.forEach(s => out.push({ ...s }));
    if (i < lines.length - 1 && out.length) {
      const last = out[out.length - 1];
      if (/[-‐]$/.test(last.text) && !/\s[-‐]$/.test(last.text)) last.text = last.text.slice(0, -1);
      else if (!/\s$/.test(last.text)) last.text += " ";
    }
  });
  // merge neighbours with the same style
  const merged = [];
  for (const s of out) {
    const p = merged[merged.length - 1];
    if (p && p.bold === s.bold && p.italic === s.italic && p.color === s.color && Math.abs(p.size - s.size) < 0.6) p.text += s.text;
    else merged.push(s);
  }
  return merged;
}

/** Blocks -> simple XHTML (used for HTML and EPUB). imgSrc(block) returns a src or null. */
export function blocksToHtml(blocks, body, imgSrc) {
  const parts = [];
  let list = null;
  const closeList = () => { if (list) { parts.push(`</${list}>`); list = null; } };
  const spanHtml = (s) => {
    let t = esc(s.text);
    if (s.bold) t = `<b>${t}</b>`;
    if (s.italic) t = `<i>${t}</i>`;
    if (s.color && s.color !== "#000000") t = `<span style="color:${s.color}">${t}</span>`;
    return t;
  };
  for (const b of blocks) {
    if (b.type === "image") {
      const src = imgSrc?.(b);
      if (src) { closeList(); parts.push(`<p><img src="${src}" alt=""/></p>`); }
      continue;
    }
    for (const p of blockParagraphs(b, body)) {
      const inner = p.spans.map(spanHtml).join("").trim();
      if (!inner) continue;
      if (p.kind === "li" || p.kind === "oli") {
        const want = p.kind === "li" ? "ul" : "ol";
        if (list !== want) { closeList(); parts.push(`<${want}>`); list = want; }
        parts.push(`<li>${inner}</li>`);
      } else {
        closeList();
        parts.push(p.kind === "p" ? `<p>${inner}</p>` : `<${p.kind}>${p.spans.map(s => esc(s.text)).join("").trim()}</${p.kind}>`);
      }
    }
  }
  closeList();
  return parts.join("\n");
}

export function blocksToMarkdown(blocks, body) {
  const out = [];
  const md = (s) => {
    let t = s.text.replace(/([*_`\\])/g, "\\$1");
    const lead = t.match(/^\s*/)[0], trail = t.match(/\s*$/)[0];
    let core = t.trim();
    if (!core) return t;
    if (s.bold && s.italic) core = `***${core}***`; else if (s.bold) core = `**${core}**`; else if (s.italic) core = `*${core}*`;
    return lead + core + trail;
  };
  let n = 0;
  for (const b of blocks) {
    if (b.type !== "text") continue;
    for (const p of blockParagraphs(b, body)) {
      const plain = p.spans.map(s => s.text).join("").trim();
      if (!plain) continue;
      if (p.kind[0] === "h") { out.push(`${"#".repeat(+p.kind[1])} ${plain}`, ""); n = 0; }
      else if (p.kind === "li") { out.push(`- ${p.spans.map(md).join("").trim()}`); }
      else if (p.kind === "oli") { out.push(p.spans.map(md).join("").trim()); }
      else { if (out.length && out[out.length - 1] !== "") out.push(""); out.push(p.spans.map(md).join("").trim(), ""); n++; }
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}
