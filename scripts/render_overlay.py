#!/usr/bin/env python3
"""
Genera un PNG transparente 1280x720 con el faldón inferior cinematográfico
y un pergamino navideño ornamental en la esquina superior derecha listo para
el desplazamiento vertical (scroll) de la carta completa en el vídeo.
"""

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT_DIR / "assets"
FONT_HANDWRITING = ASSETS_DIR / "handwriting.ttf"
WAX_SEAL_PATH = ASSETS_DIR / "wax_seal.png"

FONT_SERIF_BOLD = "/System/Library/Fonts/NewYork.ttf"
FONT_SERIF_ITALIC = "/System/Library/Fonts/NewYorkItalic.ttf"
FONT_SANS = "/System/Library/Fonts/Avenir Next.ttc"

# Coordenadas compartidas con render_synced_video.py para la ventana de lectura del pergamino
SCROLL_VIEWPORT = (896, 78, 1224, 252)  # (x1, y1, x2, y2) -> 328 x 174 px


def load_font(path: str | Path, size: int, index: int = 0, weight: int | None = None) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path_str = str(path)
    candidates = [path_str]
    if "handwriting" in path_str:
        candidates.extend([
            "/System/Library/Fonts/NewYorkItalic.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf",
        ])
    elif "Italic" in path_str:
        candidates.extend([
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        ])
    elif "NewYork" in path_str:
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
            font = ImageFont.truetype(cand, size=size, index=index if cand == path_str else 0)
            if weight is not None and hasattr(font, "set_variation_by_axes"):
                try:
                    font.set_variation_by_axes([weight])
                except Exception:
                    pass
            return font
        except Exception:
            continue
    return ImageFont.load_default()


def load_wax_seal(size: int) -> Image.Image | None:
    if not WAX_SEAL_PATH.exists():
        return None
    seal = Image.open(WAX_SEAL_PATH).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    return seal


def paste_with_shadow(base: Image.Image, overlay: Image.Image, xy: tuple[int, int], offset=(3, 4), blur=5, shadow_alpha=125) -> None:
    alpha = overlay.getchannel("A")
    shadow_layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    solid_shadow = Image.new("RGBA", overlay.size, (18, 10, 6, shadow_alpha))
    solid_shadow.putalpha(alpha.point(lambda a: int(a * (shadow_alpha / 255.0))))
    shadow_layer.paste(solid_shadow, (xy[0] + offset[0], xy[1] + offset[1]))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(shadow_layer)
    base.alpha_composite(overlay, xy)


def draw_rounded_box(draw: ImageDraw.ImageDraw, xy, radius: int, fill, outline=None, width: int = 1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def build_parchment_sheet(w: int, h: int) -> Image.Image:
    """Crea una lámina de pergamino envejecido con sombreado de curvatura bajo los rodillos."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx / max(1.0, w - 1)) * 2.0 - 1.0
    ny = (yy / max(1.0, h - 1)) * 2.0 - 1.0

    # Viñeta cálida en bordes horizontales
    edge_darken = np.clip(0.32 * (nx ** 4) + 0.14 * (nx ** 2), 0.0, 0.45)

    # Sombra de curvatura del papel enrollándose en la parte superior e inferior
    top_curl = np.exp(-yy / 7.5) * 0.24
    bot_curl = np.exp(-(h - 1 - yy) / 7.5) * 0.26
    curl_darken = top_curl + bot_curl

    # Sutil textura orgánica de fibra de papel + ligera pauta horizontal casi imperceptible
    rng = np.random.default_rng(2512)
    grain = rng.normal(0.0, 2.4, size=(h, w)).astype(np.float32)
    fiber = np.sin(xx * 0.22 + yy * 0.05) * 1.2

    shade = np.clip(1.0 - edge_darken - curl_darken, 0.52, 1.04)

    r = np.clip(250.0 * shade + grain + fiber, 0, 255).astype(np.uint8)
    g = np.clip(236.0 * shade + grain * 0.9 + fiber, 0, 255).astype(np.uint8)
    b = np.clip(202.0 * (shade - 0.04 * edge_darken) + grain * 0.75, 0, 255).astype(np.uint8)

    # Opacidad rica (244) para contraste perfecto sin perder el tacto flotante
    a = np.full((h, w), 244, dtype=np.uint8)
    # Bordes laterales ligeramente suavizados (1 px)
    a[:, 0] = 190
    a[:, -1] = 190

    rgba = np.dstack([r, g, b, a])
    return Image.fromarray(rgba, mode="RGBA")


def draw_wooden_roller(canvas: Image.Image, x1: int, y1: int, x2: int, y2: int) -> None:
    """Dibuja un rodillo cilíndrico de madera noble con remates dorados 3D."""
    w = x2 - x1
    h = y2 - y1
    roller = np.zeros((h, w, 4), dtype=np.uint8)

    cap_w = 22
    collar_w = 8
    tip_radius_zone = 6

    for y in range(h):
        t = y / max(1.0, h - 1)
        # Curvatura cilíndrica con brillo superior en ~34% de la altura
        cyl = math.sin(t * math.pi)
        spec = max(0.0, 1.0 - abs(t - 0.33) / 0.36) ** 1.8

        # Color madera caoba cálida
        wr = int(np.clip(56 + 78 * cyl + 58 * spec, 0, 255))
        wg = int(np.clip(28 + 44 * cyl + 42 * spec, 0, 255))
        wb = int(np.clip(14 + 20 * cyl + 22 * spec, 0, 255))

        # Color latón / oro antiguo para remates y anillas
        gr = int(np.clip(102 + 102 * cyl + 50 * spec, 0, 255))
        gg = int(np.clip(72 + 86 * cyl + 48 * spec, 0, 255))
        gb = int(np.clip(20 + 36 * cyl + 36 * spec, 0, 255))

        # Barra central de madera
        roller[y, cap_w : w - cap_w] = (wr, wg, wb, 255)
        # Remates dorados en los extremos
        roller[y, tip_radius_zone:cap_w] = (gr, gg, gb, 255)
        roller[y, w - cap_w : w - tip_radius_zone] = (gr, gg, gb, 255)

        # Anilla oscura separadora madera/oro y perfil en los pomos
        roller[y, cap_w - 2 : cap_w] = (68, 42, 12, 255)
        roller[y, w - cap_w : w - cap_w + 2] = (68, 42, 12, 255)

        # Pomo redondeado en los dos extremos exteriores
        dy = abs((y - (h - 1) / 2.0) / max(1.0, (h - 1) / 2.0))
        if dy <= 0.85:
            reach = int(round(tip_radius_zone * math.sqrt(max(0.0, 1.0 - (dy / 0.88) ** 2))))
            lx_start = max(0, tip_radius_zone - reach)
            rx_end = min(w, w - tip_radius_zone + reach)
            roller[y, lx_start:tip_radius_zone] = (gr, gg, gb, 255)
            roller[y, w - tip_radius_zone : rx_end] = (gr, gg, gb, 255)

    roller_img = Image.fromarray(roller, mode="RGBA")
    canvas.alpha_composite(roller_img, (x1, y1))


def wrap_text_px(draw: ImageDraw.ImageDraw, text: str, font, max_w: int) -> list[str]:
    lines: list[str] = []
    for raw_para in (text or "").replace("\r\n", "\n").split("\n"):
        para = " ".join(raw_para.strip().split())
        if not para:
            continue
        words = para.split(" ")
        cur = ""
        for word in words:
            cand = f"{cur} {word}".strip()
            if draw.textlength(cand, font=font) <= max_w:
                cur = cand
            else:
                if cur:
                    lines.append(cur)
                if draw.textlength(word, font=font) <= max_w:
                    cur = word
                else:
                    chunk = ""
                    for ch in word:
                        if draw.textlength(chunk + ch, font=font) <= max_w:
                            chunk += ch
                        else:
                            if chunk:
                                lines.append(chunk)
                            chunk = ch
                    cur = chunk
        if cur:
            lines.append(cur)
    return lines


def draw_scroll_card(img: Image.Image, name: str, letter_excerpt: str, static_letter: bool) -> None:
    """Dibuja el pergamino real en la esquina superior derecha con rodillos, cenefa dorada y lacre."""
    px1, py1, px2, py2 = 882, 34, 1238, 264  # 356 x 230
    rx1, rx2 = 860, 1260
    top_ry1, top_ry2 = 20, 36
    bot_ry1, bot_ry2 = 260, 276

    # 1. Sombra proyectada de conjunto
    shadow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow_layer)
    sdraw.rectangle((px1 + 5, py1 + 7, px2 + 5, py2 + 7), fill=(12, 6, 4, 135))
    sdraw.rounded_rectangle((rx1 + 5, top_ry1 + 6, rx2 + 5, top_ry2 + 6), radius=7, fill=(12, 6, 4, 150))
    sdraw.rounded_rectangle((rx1 + 5, bot_ry1 + 6, rx2 + 5, bot_ry2 + 6), radius=7, fill=(12, 6, 4, 150))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(9))
    img.alpha_composite(shadow_layer)

    # 2. Lámina de pergamino envejecido
    sheet = build_parchment_sheet(px2 - px1, py2 - py1)
    img.alpha_composite(sheet, (px1, py1))

    draw = ImageDraw.Draw(img)
    # Filete exterior bronce + doble cenefa interior dorada
    draw.rectangle((px1, py1, px2 - 1, py2 - 1), outline=(142, 98, 42, 230), width=1)
    draw.rectangle((px1 + 8, py1 + 8, px2 - 9, py2 - 9), outline=(186, 138, 48, 235), width=2)
    draw.rectangle((px1 + 12, py1 + 12, px2 - 13, py2 - 13), outline=(212, 174, 84, 170), width=1)

    # Remates ornamentales en las esquinas libres de la cenefa (evitando la esquina del sello)
    for cx, cy in ((px1 + 12, py1 + 12), (px1 + 12, py2 - 13), (px2 - 13, py2 - 13)):
        draw.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill=(186, 138, 48, 235))

    # 3. Rodillos superior e inferior de madera y latón dorado
    draw_wooden_roller(img, rx1, top_ry1, rx2, top_ry2)
    draw_wooden_roller(img, rx1, bot_ry1, rx2, bot_ry2)

    # 4. Cabecera del pergamino ("CARTA DE <NOMBRE>") sin glifos Unicode frágiles
    draw = ImageDraw.Draw(img)
    upper_name = (name or "").strip().upper()
    header_text = f"CARTA DE {upper_name}" if upper_name else "CARTA AL POLO NORTE"
    hdr_size = 18
    font_hdr = load_font(FONT_SERIF_BOLD, hdr_size)
    max_hdr_w = 250
    while hdr_size > 12 and draw.textlength(header_text, font=font_hdr) > max_hdr_w:
        hdr_size -= 1
        font_hdr = load_font(FONT_SERIF_BOLD, hdr_size)

    hdr_w = draw.textlength(header_text, font=font_hdr)
    center_x = 1042
    hdr_x = center_x - hdr_w / 2.0
    hdr_y = 48 + max(0, (18 - hdr_size) // 2)
    draw.text((hdr_x + 1, hdr_y + 1), header_text, font=font_hdr, fill=(255, 246, 224, 185))
    draw.text((hdr_x, hdr_y), header_text, font=font_hdr, fill=(136, 24, 30, 255))

    # Estrellas/rombos dorados a ambos lados del título
    star_y = int(hdr_y + hdr_size * 0.55)
    for sx in (int(hdr_x - 12), int(hdr_x + hdr_w + 12)):
        draw.polygon([(sx, star_y - 5), (sx + 4, star_y), (sx, star_y + 5), (sx - 4, star_y)], fill=(184, 132, 42, 235))

    # Línea divisoria dorada bajo el título
    draw.line((904, 73, 1184, 73), fill=(192, 146, 56, 210), width=1)
    draw.polygon([(1044, 70), (1048, 73), (1044, 76), (1040, 73)], fill=(192, 146, 56, 240))

    # 5. Sello real de lacre en la esquina superior derecha del pergamino
    small_seal = load_wax_seal(44)
    if small_seal is not None:
        paste_with_shadow(img, small_seal, (1188, 36), offset=(2, 3), blur=4, shadow_alpha=115)

    # 6. Modo fallback estático (solo si render_synced_video no anima fotograma a fotograma)
    if static_letter and letter_excerpt:
        vx1, vy1, vx2, vy2 = SCROLL_VIEWPORT
        font_body = load_font(FONT_HANDWRITING, 22, weight=580)
        lines = wrap_text_px(draw, letter_excerpt, font_body, (vx2 - vx1) - 24)
        y_cur = vy1 + 6
        for idx, line in enumerate(lines[:5]):
            if idx == 4 and len(lines) > 5:
                line = line[: max(0, len(line) - 3)].rstrip() + "..."
            draw.text((vx1 + 12, y_cur), line, font=font_body, fill=(54, 31, 16, 250))
            y_cur += 29


def render_overlay(
    name: str,
    age: str,
    achievement_label: str,
    letter_excerpt: str,
    output_path: Path,
    static_letter: bool = False,
) -> None:
    width, height = 1280, 720
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))

    font_title = load_font(FONT_SERIF_BOLD, 34)
    font_sub = load_font(FONT_SANS, 19)
    font_seal = load_font(FONT_SANS, 13)

    # 1. Pergamino real en esquina superior derecha
    draw_scroll_card(img, name=name, letter_excerpt=letter_excerpt, static_letter=static_letter)

    # 2. Banda inferior cinematográfica (tercio inferior)
    draw = ImageDraw.Draw(img)
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
        fill=(62, 12, 18, 212),
        outline=(226, 184, 96, 230),
        width=2,
    )

    # Línea decorativa dorada interior
    draw.line((bar_x1 + 22, bar_y1 + 10, bar_x2 - 140, bar_y1 + 10), fill=(235, 198, 118, 130), width=1)

    age_suffix = f" ({age} años)" if age and str(age).strip().isdigit() else ""
    headline = f"Mensaje especial de Papá Noel para {name}{age_suffix}"
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

    # 3. Sello de lacre real del Polo Norte en el extremo derecho del faldón
    bar_seal = load_wax_seal(78)
    if bar_seal is not None:
        paste_with_shadow(img, bar_seal, (1152, 603), offset=(2, 3), blur=5, shadow_alpha=135)
    else:
        seal_cx, seal_cy, seal_r = 1184, 642, 38
        draw.ellipse(
            (seal_cx - seal_r, seal_cy - seal_r, seal_cx + seal_r, seal_cy + seal_r),
            fill=(180, 32, 36, 245),
            outline=(236, 195, 102, 255),
            width=3,
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
    parser.add_argument("--static-letter", action="store_true")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    render_overlay(
        name=args.name.strip(),
        age=args.age.strip(),
        achievement_label=args.achievement_label.strip(),
        letter_excerpt=args.letter_excerpt.strip(),
        output_path=Path(args.output),
        static_letter=args.static_letter,
    )


if __name__ == "__main__":
    main()
