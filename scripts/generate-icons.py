"""Regenerate PWA PNGs from the existing favicon geometry (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

OUTPUT = Path(__file__).resolve().parents[1] / 'public' / 'icons'
OUTPUT.mkdir(parents=True, exist_ok=True)


def cubic(start, a, b, end):
    result = []
    for step in range(33):
        t = step / 32
        result.append(tuple((1-t)**3*start[i] + 3*(1-t)**2*t*a[i] +
                            3*(1-t)*t*t*b[i] + t**3*end[i] for i in (0, 1)))
    return result


def render(size, maskable=False):
    scale = 4
    image = Image.new('RGB', (size*scale, size*scale), '#25245c')
    draw = ImageDraw.Draw(image)
    inset = .12 if maskable else 0

    def points(values):
        return [((inset + x/64*(1-2*inset))*size*scale,
                 (inset + y/64*(1-2*inset))*size*scale) for x, y in values]

    draw.polygon(points([(13,18.5),(32,9),(51,18.5),(32,28.2)]), fill='#f7c873')
    body = [(19.5,25.2),(19.5,35.3)]
    body += cubic((19.5,35.3),(19.5,41.9),(25,47.2),(32,47.2))
    body += cubic((32,47.2),(39,47.2),(44.5,41.9),(44.5,35.3))
    body += [(44.5,25.2),(32,31.4)]
    draw.polygon(points(body), fill='#fff9eb')
    stroke = points([(27.2,38.6),(30.8,42),(37.8,35)])
    width = max(1,round(2.8/64*(1-2*inset)*size*scale))
    draw.line(stroke, fill='#25245c', width=width, joint='curve')
    radius = width/2
    for x,y in stroke:
        draw.ellipse((x-radius,y-radius,x+radius,y+radius),fill='#25245c')
    return image.resize((size,size), Image.Resampling.LANCZOS)


for filename, size, maskable in [
    ('icon-192.png',192,False), ('icon-512.png',512,False),
    ('apple-touch-icon.png',180,False), ('icon-maskable-512.png',512,True),
]:
    render(size, maskable).save(OUTPUT / filename, optimize=True)
    print(f'{filename}: {size} x {size}')
