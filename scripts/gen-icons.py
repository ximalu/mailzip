#!/usr/bin/env python3
"""Generate MailZip extension icons: 128 / 96 / 48 px."""
from PIL import Image, ImageDraw
import os

SIZE = 128
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

BLUE = "#1a73e8"

# rounded blue background
d.rounded_rectangle([4, 4, SIZE - 4, SIZE - 4], radius=28, fill=BLUE)

# white ZIP archive body
fx0, fy0, fx1, fy1 = 32, 34, 96, 96
d.rounded_rectangle([fx0, fy0, fx1, fy1], radius=10, fill="white")

# zipper: three horizontal tracks with teeth
for y in (50, 60, 70):
    x0, x1 = fx0 + 9, fx1 - 9
    d.line([x0, y, x1, y], fill=BLUE, width=4)
    for xx in (x0, x1):
        d.rectangle([xx - 3, y - 6, xx + 3, y + 6], fill=BLUE)

# zipper pull (bottom)
d.rounded_rectangle([54, 78, 74, 86], radius=4, fill=BLUE)
d.ellipse([60, 86, 68, 94], outline=BLUE, width=3)

out = "/home/ximalu/src/mailzip/src/icons"
os.makedirs(out, exist_ok=True)
img.save(f"{out}/icon-128.png")
for s in (48, 96):
    img.resize((s, s), Image.LANCZOS).save(f"{out}/icon-{s}.png")
print("icons written:", os.listdir(out))
