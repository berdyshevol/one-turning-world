"""
Turn chroma-key landmark renders (assets-src/sprites/*.png) into clean
transparent WebP sprites in public/sprites.

For each image the background colour is sampled from the border, alpha is
derived from how strongly a pixel leans toward that key colour, and the
foreground colour is un-mixed from the background so edges carry no fringe.
Optional per-asset edge fades hide renders that were cropped by the frame.

Usage: python3 scripts/key-sprites.py
Requires Pillow, NumPy and the `cwebp` binary.
"""

import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src" / "sprites"
OUT = ROOT / "public" / "sprites"
TMP = ROOT / "node_modules" / ".cache" / "sprites"

# Fade edges (fraction of the trimmed size) where the render was cropped.
FADES = {
    "empire-state": {"bottom": 0.12},
    "brooklyn-bridge": {"left": 0.07, "right": 0.07},
}
MAX_SIDE = 1100


def keyness(rgb, key):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    if key == "green":
        return g - np.maximum(r, b)
    return np.minimum(r, b) - g  # magenta


def process(path: Path):
    img = np.asarray(Image.open(path).convert("RGB")).astype(np.float32) / 255
    border = np.concatenate([img[:6].reshape(-1, 3), img[-6:].reshape(-1, 3), img[:, :6].reshape(-1, 3), img[:, -6:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    key = "green" if bg[1] > max(bg[0], bg[2]) else "magenta"
    k_bg = float(keyness(bg[None, None], key)[0, 0])

    k = keyness(img, key) / k_bg
    # Pixels at or beyond 0.82 of the key strength are background; below 0.18 opaque.
    alpha = 1 - np.clip((k - 0.18) / (0.82 - 0.18), 0, 1)

    # Un-mix: observed = a * fg + (1 - a) * bg.
    a = np.maximum(alpha, 1e-3)[..., None]
    fg = np.clip((img - (1 - a) * bg) / a, 0, 1)

    # Spill suppression: no pixel may lean toward the key colour.
    r, g, b = fg[..., 0], fg[..., 1], fg[..., 2]
    if key == "green":
        fg[..., 1] = np.minimum(g, (r + b) / 2 + 0.03)
    else:
        excess = np.maximum(0, np.minimum(r, b) - g - 0.015)
        fg[..., 0] = r - excess
        fg[..., 2] = b - excess

    # Remove speckles and soften the matte by a fraction of a pixel.
    a_img = Image.fromarray((alpha * 255).astype(np.uint8), "L")
    a_img = a_img.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    alpha = np.asarray(a_img).astype(np.float32) / 255
    alpha[alpha < 0.03] = 0

    # Trim to content with a small margin.
    ys, xs = np.where(alpha > 0.05)
    pad = 6
    y0, y1 = max(0, ys.min() - pad), min(alpha.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(alpha.shape[1], xs.max() + pad + 1)
    fg, alpha = fg[y0:y1, x0:x1], alpha[y0:y1, x0:x1]

    h, w = alpha.shape
    fades = FADES.get(path.stem, {})
    if "bottom" in fades:
        n = int(h * fades["bottom"])
        alpha[h - n :] *= np.linspace(1, 0, n)[:, None] ** 1.5
    for side in ("left", "right"):
        if side in fades:
            n = int(w * fades[side])
            ramp = np.linspace(0, 1, n)[None, :] ** 1.5
            if side == "left":
                alpha[:, :n] *= ramp
            else:
                alpha[:, w - n :] *= ramp[:, ::-1]

    # Zero the colour where fully transparent so mip filtering cannot bleed.
    fg[alpha <= 0] = 0
    rgba = np.dstack([fg, alpha])
    im = Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA")
    scale = min(1, MAX_SIDE / max(im.size))
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)

    TMP.mkdir(parents=True, exist_ok=True)
    tmp = TMP / f"{path.stem}.png"
    im.save(tmp)
    out = OUT / f"{path.stem}.webp"
    subprocess.run(["cwebp", "-quiet", "-q", "90", "-alpha_q", "100", "-exact", str(tmp), "-o", str(out)], check=True)

    # Preview on a dark ground for inspection.
    ground = Image.new("RGBA", im.size, (14, 12, 18, 255))
    ground.alpha_composite(im)
    ground.convert("RGB").save(TMP / f"{path.stem}-preview.jpg", quality=88)
    return {"id": path.stem, "width": im.width, "height": im.height, "key": key}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    meta = [process(p) for p in sorted(SRC.glob("*.png"))]
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
