"""Linguist — application-icon concepts.

Five directions for the icon that goes with the name, drawn procedurally on the
same rounded-square canvas the shipped icon uses, so the sheet can be judged
against the real thing rather than against a mock-up.

The product's angle is that a word is understood through its root. Every
candidate says that in one glyph: something branching from a single source, or
the act of looking one up, or the two together. What is deliberately absent is
the dictionary-with-a-bookmark cliché and any letter that only works in one
language — the name is the same everywhere, so the mark has to be too.

    python design/icon-concepts/make_app_icons.py --previews
    python design/icon-concepts/make_app_icons.py --concept 3 --set

`--set` writes the four shipped sizes into web/icons and prints the data URI for
the inline favicon in index.html.
"""

import argparse
import math
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
ICON_DIR = os.path.join(REPO, "web", "icons")
PREVIEW = os.path.join(HERE, "app-icon-options.png")

SUPERSAMPLE = 4

# One accent, one ground. The app's blue in light mode, with the deep charcoal
# the dark theme is built on as the alternative ground — both are already in
# tokens.css, so the icon cannot disagree with the interface.
ACCENT = (0, 113, 227)
ACCENT_BRIGHT = (10, 132, 255)
INK = (29, 29, 31)
SLATE = (43, 43, 49)
WHITE = (255, 255, 255)

FONT_CJK = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_LATIN = r"C:\Windows\Fonts\arialbd.ttf"
FONT_FALLBACKS = (r"C:\Windows\Fonts\simhei.ttf", r"C:\Windows\Fonts\arialbd.ttf")


def font(path, size):
    for candidate in (path,) + FONT_FALLBACKS:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def squircle(size, colour, radius_ratio=0.2237):
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle([0, 0, size - 1, size - 1],
                           radius=int(size * radius_ratio), fill=colour)
    return image, draw


def stroke(draw, points, width, colour):
    draw.line(points, fill=colour, width=width, joint="curve")
    for point in (points[0], points[-1]):
        draw.ellipse([point[0] - width / 2, point[1] - width / 2,
                      point[0] + width / 2, point[1] + width / 2], fill=colour)


def node(draw, centre, radius, colour):
    draw.ellipse([centre[0] - radius, centre[1] - radius,
                  centre[0] + radius, centre[1] + radius], fill=colour)


def root_tree(draw, size, colour, top=0.27, bottom=0.78, spread=0.19, weight=0.034):
    """Three branches off one stem: the shape of a root, a family, a tree."""
    cx = size / 2
    w = max(2, int(size * weight))
    stem_top = size * top
    stem_bottom = size * bottom
    stroke(draw, [(cx, stem_top), (cx, stem_bottom)], w, colour)
    for i, (along, side) in enumerate(((0.18, -1), (0.42, 1), (0.66, -1))):
        y = stem_top + (stem_bottom - stem_top) * along
        end = (cx + side * size * spread, stem_top + (stem_bottom - stem_top) * (along + 0.16))
        stroke(draw, [(cx, y), end], int(w * 0.85), colour)
        node(draw, end, int(size * 0.038), colour)
    node(draw, (cx, stem_bottom), int(size * 0.044), colour)


def concept_root_tree(image, draw, size, ground, ink):
    """1 — a root with three branches: the product's own claim, one glyph."""
    root_tree(draw, size, ink)


def concept_root_lens(image, draw, size, ground, ink):
    """2 — a lens whose handle is a root: looking a word up *and* the root idea."""
    # A thin ring, high and left, with a lot of air around it.
    ring = [size * 0.20, size * 0.18, size * 0.62, size * 0.60]
    draw.ellipse(ring, outline=ink, width=max(3, int(size * 0.036)))
    # The handle, from the ring's lower right towards the lower right corner,
    # with one branch leaving it — the root reading of the same stroke.
    start = (size * 0.545, size * 0.545)
    mid = (size * 0.70, size * 0.70)
    end = (size * 0.80, size * 0.80)
    stroke(draw, [start, mid, end], max(3, int(size * 0.040)), ink)
    stroke(draw, [mid, (size * 0.66, size * 0.80)], max(2, int(size * 0.028)), ink)
    node(draw, end, int(size * 0.026), ink)


def concept_han_latin(image, draw, size, ground, ink):
    """3 — 语 alone, large: the name's meaning, as one confident glyph."""
    draw.text((size * 0.50, size * 0.52), "语", font=font(FONT_CJK, int(size * 0.62)),
              fill=ink, anchor="mm")


def concept_folded_page(image, draw, size, ground, ink):
    """4 — a folded page with a root growing out of the fold."""
    left = size * 0.24
    right = size * 0.76
    top = size * 0.22
    bottom = size * 0.78
    fold = size * 0.14
    draw.line([(left, top), (right - fold, top), (right, top + fold), (right, bottom),
               (left, bottom), (left, top)],
              fill=ink, width=max(3, int(size * 0.038)), joint="curve")
    stroke(draw, [(right - fold, top), (right - fold, top + fold), (right, top + fold)],
           max(2, int(size * 0.030)), ink)
    stem = size * 0.62
    stroke(draw, [(size * 0.50, size * 0.44), (size * 0.50, stem)], max(2, int(size * 0.024)), ink)
    for along, side in ((0.0, -1), (0.34, 1)):
        y = size * 0.44 + (stem - size * 0.44) * along
        end = (size * 0.50 + side * size * 0.11, y + size * 0.05)
        stroke(draw, [(size * 0.50, y), end], max(2, int(size * 0.019)), ink)


def concept_stem_letter(image, draw, size, ground, ink):
    """5 — the letter L drawn as a stem with one branch: a name, and a root."""
    draw.line([(size * 0.34, size * 0.24), (size * 0.34, size * 0.74)],
              fill=ink, width=max(4, int(size * 0.058)))
    stroke(draw, [(size * 0.34, size * 0.54), (size * 0.74, size * 0.34)],
           max(3, int(size * 0.044)), ink)
    node(draw, (size * 0.74, size * 0.34), int(size * 0.036), ink)
    stroke(draw, [(size * 0.34, size * 0.44), (size * 0.58, size * 0.20)],
           max(3, int(size * 0.034)), ink)


CONCEPTS = [
    ("1 · 词根三分", concept_root_tree),
    ("2 · 词根＋放大镜", concept_root_lens),
    ("3 · 汉字「语」", concept_han_latin),
    ("4 · 折页词典＋词根", concept_folded_page),
    ("5 · L 即词根", concept_stem_letter),
]


def render(index, size=512, ground=ACCENT, ink=WHITE, supersample=SUPERSAMPLE):
    big = size * supersample
    image, draw = squircle(big, ground)
    CONCEPTS[index - 1][1](image, draw, big, ground, ink)
    return image.resize((size, size), Image.LANCZOS)


def render_flat(index, size=512, ground=ACCENT, ink=WHITE):
    """Full bleed and opaque — what iOS and Android want for a maskable icon."""
    big = size * SUPERSAMPLE
    image = Image.new("RGBA", (big, big), ground)
    draw = ImageDraw.Draw(image)
    # Artwork inside the middle 80%: a maskable icon may be cropped to a circle
    # or a squircle, and anything near the edge can be cut off.
    inset = int(big * 0.10)
    cropped = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    inner = Image.new("RGBA", (big - inset * 2, big - inset * 2), (0, 0, 0, 0))
    CONCEPTS[index - 1][1](inner, ImageDraw.Draw(inner), big - inset * 2, ground, ink)
    cropped.paste(inner, (inset, inset))
    image.alpha_composite(cropped)
    return image.resize((size, size), Image.LANCZOS)


def contact_sheet(path=PREVIEW, cell=200, columns=5):
    pad = 24
    label = 30
    width = columns * (cell + pad) + pad
    height = cell + pad * 2 + label
    sheet = Image.new("RGB", (width, height), (245, 245, 247))
    draw = ImageDraw.Draw(sheet)
    face = font(FONT_CJK, 17)

    for i, (caption, _) in enumerate(CONCEPTS):
        x = pad + i * (cell + pad)
        icon = render(i + 1, cell)
        sheet.paste(icon, (x, pad), icon)
        draw.text((x + cell / 2, pad + cell + 14), caption, font=face,
                  fill=(60, 60, 67), anchor="mm")

    sheet.save(path)
    return path


def write_set(index, ground=ACCENT):
    os.makedirs(ICON_DIR, exist_ok=True)
    shipped = {
        "icon-192.png": render(index, 192, ground),
        "icon-512.png": render(index, 512, ground),
        "icon-512-maskable.png": render_flat(index, 512),
        "apple-touch-icon-180.png": render_flat(index, 180),
    }
    for name, image in shipped.items():
        image.save(os.path.join(ICON_DIR, name))
    return sorted(shipped)


def favicon_uri(index, ground=SLATE):
    """The 24px inline favicon, as the data URI index.html carries."""
    from urllib.parse import quote

    image = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle([0, 0, 23, 23], radius=6, fill=ground)
    CONCEPTS[index - 1][1](image, draw, 24, ground, WHITE)
    import io

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + __import__("base64").b64encode(buffer.getvalue()).decode("ascii")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--previews", action="store_true", help="write the contact sheet")
    parser.add_argument("--concept", type=int, default=0, help="1..5, the one to ship")
    parser.add_argument("--set", action="store_true", help="write web/icons from --concept")
    parser.add_argument("--ground", choices=["blue", "slate"], default="blue")
    args = parser.parse_args()

    if args.previews or not (args.concept and args.set):
        print("wrote " + contact_sheet())
    if args.concept and args.set:
        ground = SLATE if args.ground == "slate" else ACCENT
        for name in write_set(args.concept, ground):
            print("wrote web/icons/" + name)
        print("")
        print("inline favicon (paste into index.html):")
        print(favicon_uri(args.concept))


if __name__ == "__main__":
    main()
