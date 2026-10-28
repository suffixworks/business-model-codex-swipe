"""Cut the Business Model Codex wordmark out of the artwork logo and build favicons / app icons.

Run once whenever scripts/assets/logo-source.jpg changes:  python3 scripts/make-brand-assets.py
Needs Pillow.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts/assets/logo-source.jpg"
OUT = ROOT / "public"
BRAND = (0xDD, 0x49, 0x2F)

# Bounds of the white wordmark inside the 1200x1200 source (found by thresholding)
WORDMARK = (36, 555, 1164, 640)
CODEX = (878, 555, 1164, 640)


def white_on_alpha(img):
    """White text on brand orange -> pure white with alpha (keeps the anti-aliasing)."""
    rgb = img.convert("RGB")
    out = Image.new("RGBA", rgb.size)
    bg_g = BRAND[1]
    out.putdata([(255, 255, 255, max(0, min(255, round((g - bg_g) * 255 / (255 - bg_g))))) for _, g, _ in rgb.getdata()])
    return out


def icon(size, mark, width_ratio, radius=0):
    canvas = Image.new("RGBA", (size, size), BRAND + (255,))
    w = round(size * width_ratio)
    h = round(mark.height * w / mark.width)
    m = mark.resize((w, h), Image.LANCZOS)
    canvas.alpha_composite(m, ((size - w) // 2, (size - h) // 2))
    return canvas


src = Image.open(SRC)
wordmark = white_on_alpha(src.crop(WORDMARK))
codex = white_on_alpha(src.crop(CODEX))
wordmark.save(OUT / "img/wordmark.png", optimize=True)

icon(512, codex, 0.70).save(OUT / "icons/icon-512.png", optimize=True)
icon(192, codex, 0.70).save(OUT / "icons/icon-192.png", optimize=True)
icon(512, codex, 0.56).save(OUT / "icons/maskable-512.png", optimize=True)
icon(180, codex, 0.66).convert("RGB").save(OUT / "icons/apple-touch-icon.png", optimize=True)
icon(48, codex, 0.86).save(OUT / "icons/favicon-48.png", optimize=True)
icon(48, codex, 0.86).save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("brand assets written to", OUT)
