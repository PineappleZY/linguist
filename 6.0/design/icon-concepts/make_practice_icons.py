"""Radicle — practice-icon concepts.

The practice button used to borrow the pencil, which at 22px reads as "new
folder" rather than "practise this word". This draws candidate glyphs on the
same 24x24 grid, at the same 1.6 stroke weight, as every other icon in the app,
so the sheet can be judged against the real thing.

The chosen candidate is 6 — a keycap spelling out `prac`, wired into
web/js/ui.js as the `write` glyph. The variants beside it are what it was
chosen from; the keycap box, the weight and the text metrics are identical
between this sheet and the shipped icon, so what is judged here is what ships.

Everything here is strokes: a closed polygon, an ellipse, a rounded rectangle,
or a line of text on the same coordinate grid. The geometry is printed as SVG
alongside, so the two cannot drift apart.

    python design/icon-concepts/make_practice_icons.py
    -> design/icon-concepts/practice-options.png
"""

import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "practice-options.png")

# The captions are Chinese, so the label font needs CJK coverage; the Latin
# part of the sheet is small enough that one face is simpler than two.
# Captions are Chinese; the text drawn inside an icon is Latin and wants a
# Latin face, so the sheet carries both.
FONT = r"C:\Windows\Fonts\msyhbd.ttc"
FALLBACK_FONTS = (r"C:\Windows\Fonts\simhei.ttf", r"C:\Windows\Fonts\arialbd.ttf")
ICON_FONT = r"C:\Windows\Fonts\arialbd.ttf"

SCALE = 18            # 24 units -> 432px, then downsampled
CELL = 132            # the size an icon is actually judged at
STROKE = 1.6

LIGHT_INK = (29, 29, 31)
LIGHT_BG = (245, 245, 247)
DARK_INK = (245, 245, 247)
DARK_BG = (28, 28, 30)
LIGHT_MUTED = (110, 110, 115)
DARK_MUTED = (152, 152, 157)
ACCENT = (0, 113, 227)
ACCENT_DARK = (10, 132, 255)


def poly(*points):
    return ("poly", list(points))


def ellipse(cx, cy, r):
    return ("ellipse", cx, cy, r)


def rrect(x0, y0, x1, y1, r):
    return ("rrect", x0, y0, x1, y1, r)


def text(value, x, baseline, size, tracking=-0.3):
    return ("text", value, x, baseline, size, tracking)


def keycap(value, size=6.2, baseline=13.0):
    return [rrect(3.0, 6.6, 21.0, 17.4, 3.2), text(value, 12.0, baseline, size)]


def pencil(offset_y=0.0, scale=1.0):
    """The pencil already in the app, optionally nudged and shrunk."""
    def p(x, y):
        return ((x - 12) * scale + 12, (y - 12) * scale + 12 + offset_y)

    body = [p(4.6, 19.4), p(8.8, 18.4), p(18.0, 9.2), p(15.1, 6.3), p(5.9, 15.4)]
    ferrule = poly(p(13.4, 7.8), p(16.6, 11.0))
    return poly(*body), ferrule


CANDIDATES = [
    ("1 · pencil (current)", "现在用的铅笔；被说像“新建文件夹”", [
        *pencil(),
    ]),
    ("2 · pencil on a line", "铅笔 + 底线：最直接的“写”", [
        *pencil(offset_y=-1.8, scale=0.92),
        poly((4.5, 20.6), (19.5, 20.6)),
    ]),
    ("3 · pen nib", "钢笔尖：写作、落笔", [
        poly((12.0, 3.6), (15.0, 8.2), (16.4, 12.4)),
        poly((12.0, 3.6), (9.0, 8.2), (7.6, 12.4)),
        ("arc", 12.0, 12.4, 4.4, 0, 180),
        poly((12.0, 7.4), (12.0, 12.6)),
        ellipse(12.0, 14.4, 1.0),
    ]),
    ("4 · keycap P", "单个大写字母最清楚，但看不出是 practice", keycap("P", 7.0)),
    ("5 · keycap pr", "两个字母，22px 下清楚", keycap("pr", 6.6)),
    ("6 · keycap prac", "选中的这个：键帽里写全缩写，字最小", keycap("prac")),
    ("7 · A on a line", "大 A + 底线：拼写练习", [
        poly((8.6, 17.0), (12.0, 5.2), (15.4, 17.0)),
        poly((10.2, 12.2), (13.8, 12.2)),
        poly((5.2, 19.8), (18.8, 19.8)),
    ]),
    ("8 · keyboard", "键盘：默写、输入", [
        rrect(2.8, 8.2, 21.2, 15.8, 2.2),
        poly((6.0, 10.8), (7.4, 10.8)),
        poly((9.3, 10.8), (10.7, 10.8)),
        poly((12.6, 10.8), (14.0, 10.8)),
        poly((15.9, 10.8), (17.3, 10.8)),
        poly((8.0, 13.6), (16.0, 13.6)),
    ]),
    ("9 · pencil in a circle", "圈里的铅笔：作为一个动作的“练”", [
        ellipse(12.0, 12.0, 8.4),
        *pencil(offset_y=0.0, scale=0.62),
    ]),
    ("10 · hand and a line", "手写曲线 + 底线：书写动作", [
        poly((4.6, 15.2), (6.4, 10.4), (8.2, 15.2), (10.0, 10.4), (11.8, 15.2),
             (13.6, 10.4), (15.4, 15.2), (17.2, 11.0), (18.8, 14.0)),
        poly((4.5, 19.4), (19.5, 19.4)),
    ]),
]


def draw_unit(draw, ops, ink, origin, scale, width, font_path=None):
    """One icon, drawn at `scale` device pixels per 24-unit grid unit."""
    ox, oy = origin

    def pt(x, y):
        return (ox + x * scale, oy + y * scale)

    for op in ops:
        kind = op[0]
        if kind == "poly":
            draw.line([pt(x, y) for x, y in op[1]], fill=ink, width=width,
                      joint="curve")
        elif kind == "ellipse":
            _, cx, cy, r = op
            x, y = pt(cx, cy)
            rr = r * scale
            draw.ellipse([x - rr, y - rr, x + rr, y + rr], outline=ink, width=width)
        elif kind == "rrect":
            _, x0, y0, x1, y1, r = op
            a, b = pt(x0, y0)
            c, d = pt(x1, y1)
            draw.rounded_rectangle([a, b, c, d], radius=r * scale, outline=ink, width=width)
        elif kind == "arc":
            _, cx, cy, r, start, end = op
            x, y = pt(cx, cy)
            rr = r * scale
            draw.arc([x - rr, y - rr, x + rr, y + rr], start=start, end=end,
                     fill=ink, width=width)
        elif kind == "text":
            _, value, cx, baseline, size, tracking = op
            font = ImageFont.truetype(font_path, max(1, round(size * scale)))
            widths = [draw.textlength(char, font=font) for char in value]
            total = sum(widths) + tracking * scale * (len(value) - 1)
            x = ox + cx * scale - total / 2
            y = oy + baseline * scale
            for char, advance in zip(value, widths):
                draw.text((x, y), char, font=font, fill=ink, anchor="ls")
                x += advance + tracking * scale


def draw_icon(ops, ink, bg, font_path=None):
    size = 24 * SCALE
    image = Image.new("RGB", (size, size), bg)
    draw = ImageDraw.Draw(image)
    draw_unit(draw, ops, ink, (0, 0), SCALE, max(2, round(STROKE * SCALE)), font_path)
    return image.resize((CELL, CELL), Image.LANCZOS)


def svg_path(ops):
    """The same geometry as an SVG path, for pasting into ui.js."""
    parts = []
    for op in ops:
        kind = op[0]
        if kind == "poly":
            points = op[1]
            parts.append("M" + " ".join(("%g %g" % (x, y)).strip() for x, y in points))
        elif kind == "ellipse":
            _, cx, cy, r = op
            parts.append("M%g %ga%g %g 0 1 0 %g 0a%g %g 0 1 0 %g 0" %
                         (cx - r, cy, r, r, 2 * r, r, r, -2 * r))
        elif kind == "rrect":
            _, x0, y0, x1, y1, r = op
            parts.append("M%g %gh%g a%g %g 0 0 1 %g %g v%g a%g %g 0 0 1 %g %g h%g "
                         "a%g %g 0 0 1 %g %g v%g a%g %g 0 0 1 %g %g z" %
                         (x0 + r, y0, x1 - x0 - 2 * r, r, r, r, r, y1 - y0 - 2 * r,
                          r, r, -r, r, -(x1 - x0 - 2 * r), r, r, -r, -r,
                          -(y1 - y0 - 2 * r), r, r, r, -r))
        elif kind == "arc":
            _, cx, cy, r, start, end = op
            parts.append("arc(%g,%g,%g)" % (cx, cy, r))
        elif kind == "text":
            _, value, cx, baseline, size, tracking = op
            parts.append('<text x="%g" y="%g" text-anchor="middle" font-size="%g" ' %
                         (cx, baseline, size) +
                         'letter-spacing="%g">%s</text>' % (tracking, value))
    return " ".join(parts)


def main():
    """Eight candidates across, once in light and once in dark. The glyphs are
    strokes on the app's own surfaces, at the size they are actually used."""
    columns = len(CANDIDATES)
    gap = 30
    caption = 34
    pad = 26
    cell_w = CELL + gap
    cell_h = CELL + caption
    width = pad * 2 + cell_w * columns
    height = pad * 2 + cell_h * 2

    sheet = Image.new("RGB", (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    font = small = ImageFont.load_default()
    for path in (FONT,) + FALLBACK_FONTS:
        try:
            font = ImageFont.truetype(path, 14)
            small = ImageFont.truetype(path, 11)
            break
        except OSError:
            continue
    try:
        ImageFont.truetype(ICON_FONT, 12)
        icon_font = ICON_FONT
    except OSError:
        icon_font = FALLBACK_FONTS[-1]

    rows = (
        (LIGHT_BG, LIGHT_INK, (20, 20, 22), (120, 120, 126)),
        (DARK_BG, DARK_INK, (240, 240, 245), (150, 150, 156)),
    )

    for row, (bg, ink, title_ink, note_ink) in enumerate(rows):
        y = pad + row * cell_h
        if row == 1:
            draw.rectangle([0, y - pad // 2, width, height], fill=(0, 0, 0))
        for column, (title, note, ops) in enumerate(CANDIDATES):
            x = pad + column * cell_w
            sheet.paste(draw_icon(ops, ink, bg, icon_font), (x, y))
            draw.text((x, y + CELL + 4), title, font=font, fill=title_ink)
            draw.text((x, y + CELL + 20), note, font=small, fill=note_ink)

    sheet.save(OUT)
    print("wrote " + OUT)
    print("")
    for title, _, ops in CANDIDATES:
        print(title)
        print("  " + svg_path(ops))


if __name__ == "__main__":
    main()
