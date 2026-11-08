"""One-off patch: teach static/app.js to use the on-device engine (window.MyPDFLocal) in the Android app."""
from pathlib import Path

p = Path(__file__).resolve().parent.parent / "static" / "app.js"
s = p.read_text(encoding="utf-8")
if "window.MyPDFLocal" in s:
    raise SystemExit("already patched")


def rep(old, new):
    global s
    n = s.count(old)
    assert n == 1, ("expected exactly one match", n, old[:90])
    s = s.replace(old, new)


rep("const ANDROID = window.MyPDFAndroid || null; // the MyPDF Android app's native bridge",
    "const ANDROID = window.MyPDFAndroid || null; // the MyPDF Android app's native bridge\n"
    "const LOCAL = window.MyPDFLocal || null;     // on-device engine (Android app): no computer needed")
rep("function send(url, fd, onProgress) {\n  return new Promise(",
    'function send(url, fd, onProgress) {\n  if (LOCAL && url.startsWith("/api/")) return LOCAL.post(url, fd, onProgress);\n  return new Promise(')
rep("async function getJSON(url) {\n  const r = await fetch(url);",
    "async function getJSON(url) {\n  if (LOCAL) return LOCAL.get(url);\n  const r = await fetch(url);")
rep("async function openDoc(file, onProgress) {",
    "// page images: rendered by the server, or on the phone by the local engine (lazy, via data-pg)\n"
    "const pgAttr = (doc, p, w) => LOCAL ? `data-pg=\"${doc}/${p}/${w}\"` : `src=\"/api/doc/${doc}/page/${p}?w=${w}\"`;\n"
    "function setPg(img, doc, p, w) { if (LOCAL) { img.dataset.pg = `${doc}/${p}/${w}`; LOCAL.hydrate(img); } else img.src = `/api/doc/${doc}/page/${p}?w=${w}`; }\n"
    "const outBlob = async (f) => LOCAL ? LOCAL.blobOf(f.url) : (await fetch(f.url + \"?inline=1\")).blob();\n"
    "async function openDoc(file, onProgress) {")
rep('<img loading="lazy" src="/api/doc/${it.d}/page/${it.p}?w=260" alt="">', '<img loading="lazy" ${pgAttr(it.d, it.p, 260)} alt="">')
rep('<img loading="lazy" src="/api/doc/${d.doc}/page/${i}?w=180">', '<img loading="lazy" ${pgAttr(d.doc, i, 180)} alt="">')
rep("    img.src = `/api/doc/${d.doc}/page/${i}?w=${Math.min(2400, Math.round(wrap.clientWidth * (devicePixelRatio || 1) / 100) * 100 || 1200)}`;",
    "    setPg(img, d.doc, i, Math.min(2400, Math.round(wrap.clientWidth * (devicePixelRatio || 1) / 100) * 100 || 1200));")
rep('''      const r = await fetch("/api/scan/render", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, corners: p.corners, filter: p.filter || settings.filter, rotate: p.rotate, crop: p.crop }) });
      if (!r.ok) throw new Error((await r.json()).error);
      if (p.thumb) URL.revokeObjectURL(p.thumb);
      p.thumb = URL.createObjectURL(await r.blob());''',
    '''      const body = { id: p.id, corners: p.corners, filter: p.filter || settings.filter, rotate: p.rotate, crop: p.crop };
      let blob;
      if (LOCAL) blob = await LOCAL.postBlob("/api/scan/render", body);
      else {
        const r = await fetch("/api/scan/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error((await r.json()).error);
        blob = await r.blob();
      }
      if (p.thumb) URL.revokeObjectURL(p.thumb);
      p.thumb = URL.createObjectURL(blob);''')
rep('''    op.onclick = () => isDesktop() ? window.pywebview.api.open_file(job, f.name)
      : ANDROID ? ANDROID.open(absUrl(f.url), f.name) : window.open(f.url + "?inline=1", "_blank");''',
    '''    op.onclick = () => isDesktop() ? window.pywebview.api.open_file(job, f.name)
      : LOCAL ? LOCAL.deliver(f, "open").catch(e => toast(e.message, true))
      : ANDROID ? ANDROID.open(absUrl(f.url), f.name) : window.open(f.url + "?inline=1", "_blank");''')
rep("    sh.onclick = () => ANDROID ? ANDROID.share(absUrl(f.url), f.name) : shareOutput(f);",
    '    sh.onclick = () => LOCAL && ANDROID ? LOCAL.deliver(f, "share").catch(e => toast(e.message, true)) : ANDROID ? ANDROID.share(absUrl(f.url), f.name) : shareOutput(f);')
rep('''    const blob = await (await fetch(f.url + "?inline=1")).blob();''', "    const blob = await outBlob(f);")
rep("  if (ANDROID) { ANDROID.download(absUrl(f.url), f.name); return; }",
    '  if (LOCAL) { try { await LOCAL.deliver(f, "download"); } catch (e) { toast(e.message, true); } return; }\n'
    "  if (ANDROID) { ANDROID.download(absUrl(f.url), f.name); return; }")
rep('''new File([await (await fetch(f.url + "?inline=1")).blob()], f.name)''', "new File([await outBlob(f)], f.name)")
rep('''        const res = await send("/api/run/" + t.id, fd, (p) => {
          $("div", bar).style.width''',
    '''        const res = await send("/api/run/" + t.id, fd, (p) => {
          if (typeof p === "string") { status.textContent = p; return; }
          $("div", bar).style.width''')
rep("<p>Every PDF & document tool in one place — private, on your own computer.</p>",
    '<p>Every PDF & document tool in one place — ${LOCAL ? "private: everything runs on this phone, even offline." : "private, on your own computer."}</p>')
rep('if ("serviceWorker" in navigator && window.isSecureContext) navigator.serviceWorker.register',
    'if (LOCAL) $("#btn-phone")?.remove();\nif (!LOCAL && "serviceWorker" in navigator && window.isSecureContext) navigator.serviceWorker.register')
rep("const T = Object.fromEntries(TOOLS.map(t => [t.id, t]));",
    '''if (LOCAL) { // on the phone: built-in engine only
  const tw = (id, fn) => { const t = TOOLS.find(x => x.id === id); if (t) fn(t); };
  tw("pdf_to_word", t => { t.opts = t.opts.filter(o => o.k !== "engine"); });
  tw("pdf_to_pptx", t => { t.opts = t.opts.filter(o => o.k !== "notes"); t.desc = "Each page becomes a slide."; });
  tw("office_to_pdf", t => { t.desc = "Convert Word, Excel and PowerPoint files (DOCX, XLSX, PPTX) with the built-in engine."; t.accept = ".docx,.xlsx,.pptx,.csv"; });
  tw("to_pdf", t => { t.desc = "Word, Excel, PowerPoint (DOCX/XLSX/PPTX), images, text, Markdown, HTML, EPUB… to PDF."; });
}
const T = Object.fromEntries(TOOLS.map(t => [t.id, t]));''')
p.write_text(s, encoding="utf-8")
print("patched", p)
