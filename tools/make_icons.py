"""Generates the app icons (PNG + ICO + SVG). Run once: venv\\Scripts\\python tools\\make_icons.py"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "static" / "icons"
OUT.mkdir(parents=True, exist_ok=True)
RED = (207, 51, 57)


def font(size):
    for f in ("segoeuib.ttf", "arialbd.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            continue
    return ImageFont.load_default()


def make(size, maskable=False):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if maskable:
        d.rectangle([0, 0, size, size], fill=RED)
        pad = size * 0.2
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=size * 0.22, fill=RED)
        pad = size * 0.14
    # document sheet with folded corner
    x0, y0, x1, y1 = pad + size * 0.06, pad, size - pad - size * 0.06, size - pad
    fold = (x1 - x0) * 0.3
    d.polygon([(x0, y0), (x1 - fold, y0), (x1, y0 + fold), (x1, y1), (x0, y1)], fill="white")
    d.polygon([(x1 - fold, y0), (x1 - fold, y0 + fold), (x1, y0 + fold)], fill=(245, 190, 192))
    f = font(int(size * 0.2))
    text = "PDF"
    tw = d.textlength(text, font=f)
    d.text(((size - tw) / 2, y0 + (y1 - y0) * 0.5), text, font=f, fill=RED)
    return im


for s in (192, 512):
    make(s).save(OUT / f"icon-{s}.png")
make(512, maskable=True).save(OUT / "maskable-512.png")
make(256).save(OUT / "icon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
(OUT / "icon.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#cf3339"/>'
    '<path d="M16 9h22l10 10v36H16z" fill="#fff"/><path d="M38 9v10h10z" fill="#f5bec0"/>'
    '<text x="32" y="45" font-family="Segoe UI,Arial" font-weight="700" font-size="13" text-anchor="middle" fill="#cf3339">PDF</text></svg>')
print("icons written to", OUT)

# Android launcher icons
RES = OUT.parent.parent / "android" / "app" / "src" / "main" / "res"
if RES.parent.exists():
    for density, px in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
        d = RES / f"mipmap-{density}"
        d.mkdir(parents=True, exist_ok=True)
        make(512).resize((px, px), Image.LANCZOS).save(d / "ic_launcher.png")
    print("android icons written to", RES)
