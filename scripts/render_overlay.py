#!/usr/bin/env python3
"""
Genera un PNG transparente 1280x720 con el nombre del niño, un sello dorado del Polo Norte
y un pequeño pergamino lateral con el extracto de su carta para superponerlo con FFmpeg.
"""

import argparse
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT_SERIF_BOLD = "/System/Library/Fonts/NewYork.ttf"
FONT_SERIF_ITALIC = "/System/Library/Fonts/NewYorkItalic.ttf"
FONT_SANS = "/System/Library/Fonts/Avenir Next.ttc"


def load_font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [path]
    if "Italic" in path:
        candidates.extend([
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        ])
    elif "NewYork" in path:
        candidates.extend([
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        ])
    else:
        candidates.extend([
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ])
    candidates.extend([
        "/System/Library/Fonts/Palatino.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    ])
    for cand in candidates:
        try:
            return ImageFont.truetype(cand, size=size, index=index if cand == path else 0)
        except Exception:
            continue
    return ImageFont.load_default()


def draw_rounded_box(draw: ImageDraw.ImageDraw, xy, radius: int, fill, outline=None, width: int = 1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def render_overlay(
    name: str,
    age: str,
    achievement_label: str,
    letter_excerpt: str,
    output_path: Path,
) -> None:
    width, height = 1280, 720
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    font_title = load_font(FONT_SERIF_BOLD, 34)
    font_sub = load_font(FONT_SANS, 19)
    font_small = load_font(FONT_SANS, 15)
    font_letter_hdr = load_font(FONT_SERIF_ITALIC, 20)
    font_letter_body = load_font(FONT_SERIF_ITALIC, 17)
    font_seal = load_font(FONT_SANS, 13)

    # 1. Pequeña tarjeta pergamino superior derecha con el extracto de la carta del niño
    clean_excerpt = " ".join((letter_excerpt or "").strip().split())
    if clean_excerpt:
        card_x1, card_y1, card_x2, card_y2 = 918, 28, 1246, 174
        # Sombra suave
        draw_rounded_box(
            draw,
            (card_x1 + 4, card_y1 + 5, card_x2 + 4, card_y2 + 5),
            radius=16,
            fill=(15, 10, 8, 95),
        )
        # Pergamino cálido semitransparente
        draw_rounded_box(
            draw,
            (card_x1, card_y1, card_x2, card_y2),
            radius=16,
            fill=(252, 243, 224, 222),
            outline=(212, 168, 79, 235),
            width=2,
        )
        draw.text((card_x1 + 16, card_y1 + 12), "Carta recibida:", font=font_letter_hdr, fill=(135, 32, 32, 255))
        all_lines = textwrap.wrap(clean_excerpt, width=30)
        wrapped = all_lines[:3]
        if len(all_lines) > 3:
            wrapped[-1] = wrapped[-1][: max(0, len(wrapped[-1]) - 3)].rstrip() + "..."
        y_cursor = card_y1 + 44
        for line in wrapped:
            draw.text((card_x1 + 16, y_cursor), line, font=font_letter_body, fill=(65, 42, 26, 245))
            y_cursor += 25

    # 2. Banda inferior cinematográfica (tercio inferior)
    bar_x1, bar_y1, bar_x2, bar_y2 = 34, 592, 1246, 692
    draw_rounded_box(
        draw,
        (bar_x1 + 3, bar_y1 + 4, bar_x2 + 3, bar_y2 + 4),
        radius=20,
        fill=(10, 6, 8, 120),
    )
    draw_rounded_box(
        draw,
        (bar_x1, bar_y1, bar_x2, bar_y2),
        radius=20,
        fill=(62, 12, 18, 208),
        outline=(226, 184, 96, 230),
        width=2,
    )

    # Línea decorativa dorada interior
    draw.line((bar_x1 + 22, bar_y1 + 10, bar_x2 - 140, bar_y1 + 10), fill=(235, 198, 118, 130), width=1)

    age_suffix = f" ({age} años)" if age and str(age).strip().isdigit() else ""
    headline = f"Mensaje especial de Papá Noel para {name}{age_suffix}"
    # Ajustar fuente si el nombre es muy largo
    if len(headline) > 46:
        font_title = load_font(FONT_SERIF_BOLD, 28)

    draw.text((bar_x1 + 26, bar_y1 + 17), headline, font=font_title, fill=(255, 236, 179, 255))

    badge_text = achievement_label.strip() if achievement_label else "En directo desde el taller de Laponia"
    draw.text(
        (bar_x1 + 26, bar_y1 + 61),
        f"{badge_text}  •  Taller del Polo Norte",
        font=font_sub,
        fill=(248, 240, 228, 235),
    )

    # 3. Sello dorado oficial en el extremo derecho de la barra
    seal_cx, seal_cy, seal_r = 1184, 642, 38
    draw.ellipse(
        (seal_cx - seal_r, seal_cy - seal_r, seal_cx + seal_r, seal_cy + seal_r),
        fill=(180, 32, 36, 245),
        outline=(236, 195, 102, 255),
        width=3,
    )
    draw.ellipse(
        (seal_cx - seal_r + 6, seal_cy - seal_r + 6, seal_cx + seal_r - 6, seal_cy + seal_r - 6),
        outline=(248, 224, 155, 200),
        width=1,
    )
    draw.text((seal_cx - 21, seal_cy - 17), "POLO\nNORTE", font=font_seal, fill=(255, 238, 185, 255), align="center")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(output_path), format="PNG")


def main():
    parser = argparse.ArgumentParser(description="Genera overlay PNG transparente para el vídeo de Papá Noel.")
    parser.add_argument("--name", required=True)
    parser.add_argument("--age", default="")
    parser.add_argument("--achievement-label", default="")
    parser.add_argument("--letter-excerpt", default="")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    render_overlay(
        name=args.name.strip(),
        age=args.age.strip(),
        achievement_label=args.achievement_label.strip(),
        letter_excerpt=args.letter_excerpt.strip(),
        output_path=Path(args.output),
    )


if __name__ == "__main__":
    main()
