"""Tile screenshots 2x2 into contact sheets with their names stamped on (needs Pillow).

usage: python sheet.py SRC_DIR OUT_DIR [PER_SHEET]
"""
import os
import sys

from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
per = int(sys.argv[3]) if len(sys.argv) > 3 else 4
os.makedirs(out, exist_ok=True)
files = sorted(f for f in os.listdir(src) if f.endswith(".png"))
W, H, cols = 960, 540, 2
for k in range(0, len(files), per):
    group = files[k : k + per]
    rows = (len(group) + cols - 1) // cols
    sheet = Image.new("RGB", (W * cols, H * rows), "white")
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(group):
        im = Image.open(os.path.join(src, f)).convert("RGB").resize((W, H), Image.LANCZOS)
        x, y = (i % cols) * W, (i // cols) * H
        sheet.paste(im, (x, y))
        d.rectangle([x, y, x + W - 1, y + H - 1], outline="black", width=2)
        d.rectangle([x, y, x + 260, y + 26], fill="black")
        d.text((x + 6, y + 6), f[:-4], fill="yellow")
    name = f"sheet_{k // per + 1:02d}_{group[0][:4]}-{group[-1][:4]}.png"
    sheet.save(os.path.join(out, name))
    print(name)
