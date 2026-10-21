"""Radicle — app icon renderer.

Draws every icon concept procedurally so each one can be emitted at any size
with identical geometry. Everything is rendered at 4x and downsampled with
LANCZOS, which is what keeps the curves and letter edges clean at 192px.

    python tools/make_icons.py --previews --out design/icon-concepts
    python tools/make_icons.py --concept 2 --set --out web/icons

Icon treatments follow platform conventions:
  icon-192 / icon-512        rounded corners, transparent outside
  icon-512-maskable          full bleed, artwork inside the 80% safe circle
  apple-touch-icon-180       full bleed and opaque (iOS applies its own mask)
"""

import argparse
import os

from PIL import Image, ImageDraw, ImageFont

SUPERSAMPLE = 4

BLUE = (0, 113, 227)
BLUE_BRIGHT = (10, 132, 255)
INK = (29, 29, 31)
WHITE = (255, 255, 255)
HAIRLINE = (156, 156, 166)

FONT_BOLD = r"C:\Windows\Fonts\arialbd.ttf"


def load_font(size):
    try:
        return ImageFont.truetype(FONT_BOLD, size)
    except OSError:
        return ImageFont.load_default()


def rounded_background(size, colour, radius_ratio=0.2237):
    """iOS-style squircle approximation on a transparent canvas."""
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    radius = int(size * radius_ratio)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=colour)
    return image


def square_background(size, colour):
    return Image.new("RGBA", (size, size), colour)


def taper(draw, start, end, r_start, r_end, colour, steps=64):
    """Filled stroke of varying width — a line with a hand-drawn taper."""
    for step in range(steps + 1):
        t = step / steps
        x = start[0] + (end[0] - start[0]) * t
        y = start[1] + (end[1] - start[1]) * t
        radius = r_start + (r_end - r_start) * t
        draw.ellipse([x - radius, y - radius, x + radius, y + radius], fill=colour)


def draw_letter(image, text, size, centre, colour, scale):
    draw = ImageDraw.Draw(image)
    font = load_font(int(size * scale))
    draw.text(centre, text, font=font, fill=colour, anchor="mm")


def draw_root(draw, size, colour, top_ratio=0.26, bottom_ratio=0.86, weight=0.032,
              branch_specs=None, ground=None):
    """A single descending root with paired side roots: the radicle metaphor.

    branch_specs is a list of (position along the root, horizontal reach, tip
    radius). Reach shrinks towards the tip and every side root drops as far as
    it reaches, which is what keeps the silhouette reading as a root instead of
    a crossbar or a paper plane.
    """
    cx = size / 2
    top = size * top_ratio
    bottom = size * bottom_ratio
    taper(draw, (cx, top), (cx, bottom), size * weight, size * weight * 0.22, colour)

    if ground is not None:
        taper(draw, (size * 0.355, size * ground), (size * 0.645, size * ground),
              size * 0.0055, size * 0.0055, colour)

    if branch_specs is None:
        branch_specs = [(0.30, 0.150, 0.0055), (0.54, 0.125, 0.0045), (0.75, 0.100, 0.0035)]

    span = bottom - top
    for position, reach_ratio, tip_ratio in branch_specs:
        y = top + span * position
        reach = size * reach_ratio
        # Dropping as far as we reach gives roughly a 45 degree side root.
        drop = reach * 0.92
        r_start = size * tip_ratio * 2.1
        for direction in (-1, 1):
            taper(draw, (cx, y), (cx + direction * reach, y + drop),
                  r_start, size * tip_ratio, colour)


def draw_node_tree(draw, size, node_colour, edge_colour, node_scale=1.0):
    """Branching node graph: shared roots fanning out into related words."""
    def point(x, y):
        return (size * x, size * y)

    # One etymon at the top descending into its descendants, so the mark reads
    # as genealogy rather than as a molecule.
    level0 = [point(0.50, 0.195)]
    level1 = [point(0.295, 0.475), point(0.705, 0.475)]
    # Deliberately uneven heights so the crown does not read as a flat row.
    level2 = [point(0.185, 0.755), point(0.405, 0.795), point(0.595, 0.760), point(0.815, 0.795)]

    edges = [
        (level0[0], level1[0]), (level0[0], level1[1]),
        (level1[0], level2[0]), (level1[0], level2[1]),
        (level1[1], level2[2]), (level1[1], level2[3])
    ]
    for start, end in edges:
        draw.line([start, end], fill=edge_colour, width=int(size * 0.013), joint="curve")

    radii = [(level0[0], 0.048), (level1[0], 0.040), (level1[1], 0.040)]
    radii += [(node, 0.028) for node in level2]
    for centre, radius in radii:
        r = size * radius * node_scale
        draw.ellipse([centre[0] - r, centre[1] - r, centre[0] + r, centre[1] + r], fill=node_colour)


def render_concept(concept, size, maskable=False):
    """Returns an RGBA image of the given concept at the given pixel size."""
    scale = SUPERSAMPLE
    big = size * scale
    content_scale = 0.88 if maskable else 1.0

    if concept == 1:
        image = square_background(big, BLUE) if maskable else rounded_background(big, BLUE)
        draw_letter(image, "R", big, (big / 2, big / 2 + big * 0.012), WHITE, 0.62 * content_scale)

    elif concept == 2:
        image = square_background(big, BLUE) if maskable else rounded_background(big, BLUE)
        draw_letter(image, "R", big, (big / 2, big * 0.365), WHITE, 0.43 * content_scale)
        draw = ImageDraw.Draw(image)
        draw_root(
            draw, big, WHITE,
            top_ratio=0.590,
            bottom_ratio=0.590 + 0.285 * content_scale,
            weight=0.023 * content_scale,
            branch_specs=[(0.33, 0.125, 0.0048), (0.67, 0.098, 0.0036)]
        )

    elif concept == 3:
        image = square_background(big, BLUE) if maskable else rounded_background(big, BLUE)
        draw = ImageDraw.Draw(image)
        draw_root(
            draw, big, WHITE,
            top_ratio=0.275,
            bottom_ratio=0.275 + 0.615 * content_scale,
            weight=0.030 * content_scale,
            ground=0.245
        )

    elif concept == 4:
        image = square_background(big, INK) if maskable else rounded_background(big, INK)
        draw = ImageDraw.Draw(image)
        draw_node_tree(draw, big, BLUE_BRIGHT, HAIRLINE, node_scale=content_scale)

    else:
        raise ValueError("unknown concept: %r" % concept)

    return image.resize((size, size), Image.LANCZOS)


def save(image, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    image.save(path, "PNG")
    return path


def emit_previews(out_dir):
    written = []
    for concept in (1, 2, 3, 4):
        image = render_concept(concept, 512, maskable=False)
        written.append(save(image, os.path.join(out_dir, "concept-%d.png" % concept)))
    return written


def emit_set(concept, out_dir):
    written = []
    for name, size, maskable in (
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-512-maskable.png", 512, True),
        ("apple-touch-icon-180.png", 180, True),
    ):
        image = render_concept(concept, size, maskable=maskable)
        if maskable:
            # iOS and maskable slots must never receive transparency.
            flattened = Image.new("RGB", (size, size), BLUE if concept != 4 else INK)
            flattened.paste(image, (0, 0), image)
            image = flattened
        written.append(save(image, os.path.join(out_dir, name)))
    return written


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--concept", type=int, default=1, choices=[1, 2, 3, 4])
    parser.add_argument("--out", default="web/icons")
    parser.add_argument("--previews", action="store_true")
    parser.add_argument("--set", action="store_true")
    args = parser.parse_args()

    if args.previews:
        for path in emit_previews(args.out):
            print("preview  " + path)
    if args.set or not args.previews:
        for path in emit_set(args.concept, args.out):
            print("icon     " + path)


if __name__ == "__main__":
    main()
