"""Build ST-6 Codex icons from the official logo.

Only crops, resizes, and keys out the solid black background.
Does not redraw, restyle, or recolor the mark.

Requires Pillow. Run from the repo root: python3 scripts/make-icons.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "logo-source.jpg"
PUBLIC = ROOT / "public"

# Pixels at or below this max-channel value are the black field, including
# JPEG noise. The gold strokes sit well above it.
BLACK_MAX = 18
# Strokes at or above this are fully opaque. Values in between are the
# anti-aliased edge and become partial alpha.
SOLID_MAX = 110
# Longer side of the mark occupies this fraction of the square. The rest is padding.
MARK_FRACTION = 0.84
# Maskable icons keep the mark inside the center 80% safe zone.
MASKABLE_SCALE = 0.90


def content_box(image: Image.Image) -> tuple[int, int, int, int]:
    pixels = image.load()
    width, height = image.size
    min_x, min_y, max_x, max_y = width, height, 0, 0
    for y in range(height):
        for x in range(width):
            if max(pixels[x, y]) > BLACK_MAX:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if max_x < min_x:
        raise SystemExit("No logo pixels found in the source image.")
    return min_x, min_y, max_x, max_y


def square_crop(image: Image.Image) -> Image.Image:
    min_x, min_y, max_x, max_y = content_box(image)
    # Keep the faint anti-aliased pixels just outside the threshold.
    min_x = max(0, min_x - 2)
    min_y = max(0, min_y - 2)
    max_x = min(image.width - 1, max_x + 2)
    max_y = min(image.height - 1, max_y + 2)
    mark_w = max_x - min_x + 1
    mark_h = max_y - min_y + 1
    side = int(round(max(mark_w, mark_h) / MARK_FRACTION))
    if side % 2:
        side += 1
    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2
    left = int(round(center_x - side / 2))
    top = int(round(center_y - side / 2))
    canvas = Image.new("RGB", (side, side), (0, 0, 0))
    src_left = max(0, left)
    src_top = max(0, top)
    src_right = min(image.width, left + side)
    src_bottom = min(image.height, top + side)
    crop = image.crop((src_left, src_top, src_right, src_bottom))
    canvas.paste(crop, (src_left - left, src_top - top))
    return canvas


def key_black(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            red, green, blue, _alpha = pixels[x, y]
            level = max(red, green, blue)
            if level <= BLACK_MAX:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            if level >= SOLID_MAX:
                pixels[x, y] = (red, green, blue, 255)
                continue
            alpha = int(round((level - BLACK_MAX) * 255 / (SOLID_MAX - BLACK_MAX)))
            scale = 255 / alpha
            pixels[x, y] = (
                min(255, int(round(red * scale))),
                min(255, int(round(green * scale))),
                min(255, int(round(blue * scale))),
                alpha,
            )
    return rgba


def resize(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)


def save_png(image: Image.Image, path: Path) -> None:
    image.save(path, format="PNG", optimize=True)


def maskable(master: Image.Image, size: int) -> Image.Image:
    icon = Image.new("RGB", (size, size), (0, 0, 0))
    mark = resize(master, max(1, int(round(size * MASKABLE_SCALE))))
    offset = (size - mark.width) // 2
    icon.paste(mark, (offset, offset))
    return icon


def main() -> None:
    source = Image.open(SOURCE).convert("RGB")
    master = square_crop(source)
    transparent = key_black(master)
    PUBLIC.mkdir(exist_ok=True)

    save_png(resize(transparent, 512), PUBLIC / "logo.png")

    icon16 = resize(master, 16)
    icon32 = resize(master, 32)
    save_png(icon16, PUBLIC / "favicon-16.png")
    save_png(icon32, PUBLIC / "favicon-32.png")
    master.save(
        PUBLIC / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32)],
    )

    save_png(resize(master, 180), PUBLIC / "apple-touch-icon.png")
    save_png(resize(master, 192), PUBLIC / "icon-192.png")
    save_png(resize(master, 512), PUBLIC / "icon-512.png")
    save_png(maskable(master, 192), PUBLIC / "icon-maskable-192.png")
    save_png(maskable(master, 512), PUBLIC / "icon-maskable-512.png")
    print(f"master {master.size[0]}px from {source.size[0]}x{source.size[1]}")


if __name__ == "__main__":
    main()
