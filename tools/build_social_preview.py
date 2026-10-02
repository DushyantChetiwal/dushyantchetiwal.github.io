"""Render the public share card; Pillow is a development-only dependency."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONTS = Path('C:/Windows/Fonts')


def main():
    image = Image.new('RGB', (1200, 630), '#f5f4ee')
    draw = ImageDraw.Draw(image)
    heading = ImageFont.truetype(str(FONTS / 'segoeuib.ttf'), 72)
    sans = ImageFont.truetype(str(FONTS / 'segoeui.ttf'), 24)
    small = ImageFont.truetype(str(FONTS / 'segoeui.ttf'), 18)
    draw.line((64, 102, 1136, 102), fill='#d9ddd1', width=2)
    draw.text((64, 48), 'DUSHYANT CHETIWAL', fill='#253a32', font=sans)
    draw.text((880, 54), 'LLM & PYTHON ENGINEER', fill='#626960', font=small)
    draw.text((64, 170), 'Reliable AI.', font=heading, fill='#253a32')
    draw.text((64, 274), 'Measurable impact.', font=heading, fill='#375c46')
    draw.text((69, 421), 'Agent evaluations. Python platforms. Data systems.', fill='#626960', font=sans)
    draw.rounded_rectangle((70, 507, 276, 550), radius=5, fill='#253a32')
    draw.text((88, 515), 'SELECTED WORK  →', fill='#f5f4ee', font=small)
    draw.text((828, 525), 'dushyantchetiwal.github.io', fill='#626960', font=small)
    image.save(ROOT / 'site/assets/social-preview.png', optimize=True)
    print('Generated site/assets/social-preview.png (1200 × 630)')


if __name__ == '__main__':
    main()
