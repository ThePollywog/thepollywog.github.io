#!/usr/bin/env python3
"""
Generates every binary asset in ../assets from two committed sources:

  assets/logo-512.png    the patch artwork, already trimmed to a transparent circle
  assets/favicon.svg     the simplified mark, hand-authored

Nothing here reaches outside the homepage/ folder, which is the point: this
directory is meant to be lifted out of the saltdog repo intact, and a build step
that depends on a file two levels up would break silently the moment it moves.

  python3 tools/build-assets.py                    # rebuild from the committed master
  python3 tools/build-assets.py --from PATH.png    # re-derive the master from the original

Requires Pillow and ImageMagick's `convert` (only for rasterizing the SVG).

WHY A 512px MASTER IS COMMITTED rather than the 1254px original. The original is
a megabyte of pixels with a white background sitting in a sibling directory;
committing it here would ship most of them unused, and NOT committing anything
would mean this script cannot run at all once the folder is moved. 512 is the
smallest size every emitted asset can be derived from with no upscaling — the
largest consumer is icon-512 at an 0.88 inset, i.e. 450px of artwork — so it is
the source of record, and `--from` exists only to regenerate it.
"""

import argparse
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, "..", "assets"))

MASTER = os.path.join(ASSETS, "logo-512.png")
MASTER_PX = 512
FAVICON_SVG = os.path.join(ASSETS, "favicon.svg")

# Kept in sync with the custom properties at the top of ../index.html. Literals
# rather than parsed out of the CSS: a parser here would be more code than the
# duplication saves, and check.mjs asserts the two agree.
BG = (0x0E, 0x13, 0x0F)
ACCENT = (0xA9, 0xB0, 0x63)
TEXT = (0xE6, 0xE9, 0xE0)
MUTED = (0xA9, 0xAF, 0x9F)

SANS_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def build_master(src):
    """Trim the original patch to a transparent circle at 512px.

    The artwork is a full-bleed circle inscribed in a square canvas — verified by
    scanning the centre row and column, which are non-white edge to edge — so the
    mask is the inscribed circle, SHRUNK BY `BLEED` px. Without the shrink the
    mask keeps the original's own antialiased outer edge, which is a blend
    toward the white page it was drawn on, and the result is a pale rim around
    the circle that is invisible on white and obvious on the dark card. Caught by
    looking at the rendered og-image, not by reading the code.

    The mask is drawn at 4x and downsampled rather than relying on
    `ImageDraw.ellipse`, which has hard edges: a hard-edged circle stair-steps
    visibly once it is scaled down to the 160px the page displays it at.
    """
    im = Image.open(src).convert("RGB")
    w, h = im.size
    if w != h:
        sys.exit(f"expected a square source, got {w}x{h}")
    BLEED = max(3, round(w * 0.004))
    ss = 4
    mask = Image.new("L", (w * ss, h * ss), 0)
    ImageDraw.Draw(mask).ellipse(
        (BLEED * ss, BLEED * ss, (w - BLEED) * ss - 1, (h - BLEED) * ss - 1), fill=255
    )
    mask = mask.resize((w, h), Image.LANCZOS)
    im.putalpha(mask)
    im = im.resize((MASTER_PX, MASTER_PX), Image.LANCZOS)
    im.save(MASTER, optimize=True)
    return im


def load_master():
    if not os.path.exists(MASTER):
        sys.exit(f"missing {MASTER} — run with --from PATH to create it")
    return Image.open(MASTER).convert("RGBA")


def on_tile(logo, size, inset):
    """The logo centred on an opaque tile, occupying `inset` of the width.

    Opaque, not transparent, for the icon sizes: iOS composites an apple-touch
    icon onto white and Android onto whatever the launcher feels like, so a
    transparent dark-green tadpole lands on a white field roughly half the time.
    """
    tile = Image.new("RGBA", (size, size), BG + (255,))
    d = int(size * inset)
    art = logo.resize((d, d), Image.LANCZOS)
    tile.alpha_composite(art, (((size - d) // 2), ((size - d) // 2)))
    return tile.convert("RGB")


def svg_to_png(size):
    out = f"/tmp/pollywog-favicon-{size}.png"
    subprocess.run(
        ["convert", "-background", "none", FAVICON_SVG, "-resize", f"{size}x{size}", out],
        check=True,
    )
    return Image.open(out).convert("RGBA")


def tracked_text(d, xy, text, font, fill, tracking):
    """Draw `text` with letter-spacing, which PIL has no notion of."""
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += d.textlength(ch, font=font) + tracking
    return x


def tracked_width(d, text, font, tracking):
    return sum(d.textlength(c, font=font) + tracking for c in text) - tracking


def build_og(logo):
    """The 1200x630 link-preview card.

    1200x630 because that is the size every consumer of it — Facebook, LinkedIn,
    Slack, iMessage, Discord, Twitter's summary_large_image — crops toward, and
    the 1.91:1 ratio is what avoids a centre crop eating the wordmark.

    The disclaimer is ON the card and not only on the page. A link preview is
    frequently the whole of what someone sees before they decide whether this is
    an official Navy resource, and it gets pasted into group chats stripped of
    every other bit of context this site provides.
    """
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)

    art = 360
    scaled = logo.resize((art, art), Image.LANCZOS)
    im.paste(scaled, (78, (H - art) // 2), scaled)

    x = 78 + art + 66
    title = ImageFont.truetype(SANS_BOLD, 68)
    sub = ImageFont.truetype(SANS_BOLD, 34)
    body = ImageFont.truetype(SANS, 27)
    small = ImageFont.truetype(SANS, 22)

    tracked_text(d, (x, 142), "THE POLLYWOG", title, ACCENT, 3.5)
    d.text((x, 236), "Navy reference tools", font=sub, fill=TEXT)
    d.text((x, 280), "that run in your browser", font=sub, fill=TEXT)
    d.text((x, 342), "SALTDOG  ·  WEBNAVFIT", font=body, fill=MUTED)
    d.text((x, 382), "No accounts. No server. Nothing uploaded.", font=body, fill=MUTED)

    d.line([(x, 444), (x + 300, 444)], fill=ACCENT, width=3)
    d.text((x, 466), "Unofficial — not a Department of the Navy publication", font=small, fill=MUTED)

    im.save(os.path.join(ASSETS, "og-image.png"), optimize=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="src", help="original patch artwork; re-derives logo-1024.png")
    args = ap.parse_args()

    logo = build_master(args.src) if args.src else load_master()
    logo = logo.convert("RGBA")

    # Page artwork. 320 is the 2x of the 160px the header renders it at; 160 is
    # the 1x. Both are emitted so `srcset` has something honest to point at
    # rather than shipping one file and lying about the density.
    for size in (160, 320):
        out = logo.resize((size, size), Image.LANCZOS)
        out.save(os.path.join(ASSETS, f"logo-{size}.png"), optimize=True)
        out.save(os.path.join(ASSETS, f"logo-{size}.webp"), quality=88, method=6)

    # PWA icons. `any` gets a small inset so the circle is not clipped by a
    # square crop; `maskable` gets a large one because Android may crop to a
    # circle inscribed in 80% of the tile and will happily shave the artwork.
    on_tile(logo, 192, 0.88).save(os.path.join(ASSETS, "icon-192.png"), optimize=True)
    on_tile(logo, 512, 0.88).save(os.path.join(ASSETS, "icon-512.png"), optimize=True)
    on_tile(logo, 512, 0.62).save(os.path.join(ASSETS, "icon-maskable-512.png"), optimize=True)
    on_tile(logo, 180, 0.90).save(os.path.join(ASSETS, "apple-touch-icon.png"), optimize=True)

    # The .ico comes from favicon.svg, not from the patch: see the comment in
    # that file for why the detailed artwork is not the tab icon.
    ico = svg_to_png(64)
    ico.convert("RGB").save(
        os.path.join(ASSETS, "favicon.ico"), sizes=[(48, 48), (32, 32), (16, 16)]
    )

    build_og(logo)

    for name in sorted(os.listdir(ASSETS)):
        p = os.path.join(ASSETS, name)
        print(f"{os.path.getsize(p):>8,}  {name}")


if __name__ == "__main__":
    main()
