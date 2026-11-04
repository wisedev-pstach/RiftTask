"""Generate native assets and a size-proof sheet from public/icon.svg.

python -m pip install -r scripts/icon-requirements.txt
python scripts/generate-icons.py
"""
from io import BytesIO
from pathlib import Path
import shutil
import cairosvg
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'public/icon.svg'
build = ROOT / 'build'
build.mkdir(exist_ok=True)
shutil.copyfile(source, build / 'icon.svg')
image = Image.open(BytesIO(cairosvg.svg2png(url=str(source), output_width=1024, output_height=1024))).convert('RGBA')
image.save(build / 'icon.png')
image.save(build / 'icon.ico', sizes=[(n, n) for n in (16, 24, 32, 48, 64, 128, 256)])
image.save(build / 'icon.icns', sizes=[(n, n) for n in (16, 32, 64, 128, 256, 512, 1024)])

sheet = Image.new('RGB', (1000, 500), '#f4f5f2')
draw = ImageDraw.Draw(sheet)
sizes = (16, 24, 32, 64, 128)
for row, (background, foreground) in enumerate([('#f4f5f2', '#24282d'), ('#0b0d10', '#e7e9e5')]):
    y = row * 250
    draw.rectangle((0, y, 1000, y + 250), fill=background)
    draw.text((24, y + 20), 'RiftTask / actual pixel sizes / ' + ('light' if row == 0 else 'dark'), fill=foreground)
    for column, size in enumerate(sizes):
        x = 50 + column * 195
        small = Image.open(BytesIO(cairosvg.svg2png(url=str(source), output_width=size, output_height=size))).convert('RGBA')
        sheet.paste(small, (x + (128 - size) // 2, y + 70 + (128 - size) // 2), small)
        draw.text((x + 42, y + 215), f'{size}px', fill=foreground)
preview = ROOT / 'docs/icon-preview.png'
sheet.save(preview)
print(f'Generated SVG, PNG (1024), ICO (16–256), ICNS (1024), and {preview}')
