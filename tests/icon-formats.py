"""Optional developer check: python tests/icon-formats.py (Pillow required)."""
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET
from PIL import Image, IcoImagePlugin

ROOT = Path(__file__).resolve().parents[1]


class IconFormats(unittest.TestCase):
    def test_native_formats(self):
        with Image.open(ROOT / 'build/icon.png') as png:
            self.assertEqual(png.size, (1024, 1024))
            self.assertEqual(png.mode, 'RGBA')
            pixel = png.getpixel((0, 0))
            assert isinstance(pixel, tuple)
            self.assertEqual(pixel[3], 0)
        with Image.open(ROOT / 'build/icon.ico') as ico:
            assert isinstance(ico, IcoImagePlugin.IcoImageFile)
            self.assertEqual(ico.format, 'ICO')
            self.assertEqual(ico.ico.sizes(), {(n, n) for n in [16, 24, 32, 48, 64, 128, 256]})
            for size in ico.ico.sizes():
                self.assertEqual(ico.ico.getimage(size).size, size)
        icns_path = ROOT / 'build/icon.icns'
        self.assertEqual(icns_path.read_bytes()[:4], b'icns')
        with Image.open(icns_path) as icns:
            self.assertEqual(icns.format, 'ICNS')
            self.assertEqual(icns.size, (1024, 1024))
            icns.load()
        public = ROOT / 'public/icon.svg'
        self.assertEqual(public.read_bytes(), (ROOT / 'build/icon.svg').read_bytes())
        self.assertEqual(ET.fromstring(public.read_text()).attrib['viewBox'], '0 0 1024 1024')


if __name__ == '__main__':
    unittest.main()
