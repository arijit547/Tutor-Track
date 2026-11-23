"""Regenerate flat TutorTrack PWA icons (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

OUTPUT = Path(__file__).resolve().parents[1] / 'public' / 'icons'
OUTPUT.mkdir(parents=True, exist_ok=True)
BG = '#e5ece2'
INK = '#285944'


def cubic(start, a, b, end):
    result = []
    for step in range(33):
        t = step / 32
        result.append(tuple((1-t)**3 * start[i] + 3*(1-t)**2 * t*a[i] +
                            3*(1-t)*t*t * b[i] + t**3 * end[i] for i in (0, 1)))
    return result


def render(size, maskable=False):
    scale = 4
    image = Image.new('RGB', (size*scale, size*scale), BG)
    draw = ImageDraw.Draw(image)
    inset = .14 if maskable else 0

    def points(values):
        return [((inset + x/64*(1-2*inset))*size*scale,
                 (inset + y/64*(1-2*inset))*size*scale) for x, y in values]

    draw.polygon(points([(10,21),(32,10),(54,21),(32,32)]), fill=INK)
    body = [(19.5,29),(19.5,38)]
    body += cubic((19.5,38),(19.5,45),(25,50),(32,50))
    body += cubic((32,50),(39,50),(44.5,45),(44.5,38))
    body += [(44.5,29),(32,35)]
    draw.polygon(points(body), fill=INK)
    width = max(2, round(3/64*(1-2*inset)*size*scale))
    draw.line(points([(52,23),(52,40)]), fill=INK, width=width)
    x, y = points([(52,44)])[0]
    radius = width * 1.1
    draw.ellipse((x-radius,y-radius,x+radius,y+radius), fill=INK)
    check = points([(26,40),(30,44),(38,35)])
    draw.line(check, fill=BG, width=width, joint='curve')
    for x, y in check:
        r = width/2
        draw.ellipse((x-r,y-r,x+r,y+r),fill=BG)
    return image.resize((size,size), Image.Resampling.LANCZOS)


for filename, size, maskable in [
    ('icon-192.png',192,False), ('icon-512.png',512,False),
    ('apple-touch-icon.png',180,False), ('icon-maskable-512.png',512,True),
]:
    render(size, maskable).save(OUTPUT / filename, optimize=True)
    print(f'{filename}: {size} x {size}')
