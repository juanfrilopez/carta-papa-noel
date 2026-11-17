#!/usr/bin/env python3
"""
Genera los activos base del motor de vídeo:
1. assets/bgm_christmas.wav (~22s): melodía cálida de caja de música navideña + chimenea suave.
2. assets/santa_base.mp4 (~18s, 1280x720, 25fps): animación fluida a partir de assets/santa_base.png
   con movimiento Ken Burns, destellos de chimenea, polvo mágico dorado y micro-movimiento en barba/bigote.
"""

import argparse
import math
import os
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT_DIR / "assets"
FFMPEG_BIN = "/opt/homebrew/bin/ffmpeg"


def build_bgm_wav(output_path: Path, duration: float = 22.0, sample_rate: int = 44100) -> None:
    """Sintetiza música navideña suave de caja de música + chimenea crepitando."""
    n_samples = int(duration * sample_rate)
    t = np.linspace(0.0, duration, n_samples, endpoint=False, dtype=np.float64)

    left = np.zeros(n_samples, dtype=np.float64)
    right = np.zeros(n_samples, dtype=np.float64)

    # Progresión cálida navideña en Fa mayor (F - C/E - Dm - Bb - Gm7 - C7 - F)
    chords = [
        (0.0, 3.0, [174.61, 220.00, 261.63, 349.23]),   # Fmaj
        (3.0, 6.0, [164.81, 196.00, 261.63, 392.00]),   # C/E
        (6.0, 9.0, [146.83, 220.00, 261.63, 349.23]),   # Dm7
        (9.0, 12.0, [116.54, 174.61, 233.08, 293.66]),  # Bbmaj
        (12.0, 15.0, [196.00, 233.08, 293.66, 349.23]), # Gm7
        (15.0, 18.0, [130.81, 196.00, 233.08, 329.63]), # C7
        (18.0, 22.0, [174.61, 220.00, 261.63, 349.23]), # Fmaj cierre
    ]

    # Colchón armónico cálido (pad suave)
    for start, end, freqs in chords:
        i0 = int(start * sample_rate)
        i1 = min(n_samples, int(end * sample_rate))
        seg_t = t[i0:i1] - start
        seg_len = i1 - i0
        if seg_len <= 0:
            continue
        fade_len = min(int(0.35 * sample_rate), seg_len // 3)
        env = np.ones(seg_len, dtype=np.float64)
        if fade_len > 0:
            env[:fade_len] = np.linspace(0.0, 1.0, fade_len)
            env[-fade_len:] = np.linspace(1.0, 0.0, fade_len)

        pad = np.zeros(seg_len, dtype=np.float64)
        for idx, f in enumerate(freqs):
            detune = 1.0 + (idx - 1.5) * 0.0012
            pad += 0.25 * np.sin(2.0 * math.pi * f * detune * seg_t)
            pad += 0.06 * np.sin(2.0 * math.pi * f * 2.0 * seg_t)
        pad *= env * 0.14
        left[i0:i1] += pad * 0.96
        right[i0:i1] += pad * 1.04

    # Arpegio de caja de música / celesta navideña
    melody_notes = [
        (0.0, 523.25), (0.5, 659.25), (1.0, 698.46), (1.5, 880.00), (2.0, 783.99), (2.5, 698.46),
        (3.0, 659.25), (3.5, 587.33), (4.0, 523.25), (4.5, 783.99), (5.0, 659.25), (5.5, 587.33),
        (6.0, 698.46), (6.5, 880.00), (7.0, 1046.50), (7.5, 880.00), (8.0, 783.99), (8.5, 698.46),
        (9.0, 587.33), (9.5, 698.46), (10.0, 932.33), (10.5, 880.00), (11.0, 783.99), (11.5, 698.46),
        (12.0, 783.99), (12.5, 880.00), (13.0, 932.33), (13.5, 1046.50), (14.0, 880.00), (14.5, 783.99),
        (15.0, 659.25), (15.5, 783.99), (16.0, 880.00), (16.5, 1046.50), (17.0, 932.33), (17.5, 783.99),
        (18.0, 698.46), (18.6, 880.00), (19.2, 1046.50), (19.9, 1396.91),
    ]

    for idx, (note_start, freq) in enumerate(melody_notes):
        i0 = int(note_start * sample_rate)
        note_dur = 2.1 if idx < len(melody_notes) - 1 else 2.8
        i1 = min(n_samples, i0 + int(note_dur * sample_rate))
        if i1 <= i0:
            continue
        nt = t[i0:i1] - note_start
        attack = np.minimum(1.0, nt / 0.015)
        decay = np.exp(-nt * 2.4)
        tone = (
            0.70 * np.sin(2.0 * math.pi * freq * nt)
            + 0.22 * np.sin(2.0 * math.pi * freq * 2.0 * nt) * np.exp(-nt * 5.0)
            + 0.08 * np.sin(2.0 * math.pi * freq * 3.0 * nt) * np.exp(-nt * 8.0)
        )
        sig = tone * attack * decay * 0.16
        pan = 0.5 + 0.22 * math.sin(idx * 0.9)
        left[i0:i1] += sig * (1.0 - pan * 0.4)
        right[i0:i1] += sig * (0.6 + pan * 0.4)

    # Shimmer sutil de cascabeles al inicio y al final
    rng = np.random.default_rng(42)
    for bell_time in [0.15, 0.35, 18.2, 19.6]:
        i0 = int(bell_time * sample_rate)
        i1 = min(n_samples, i0 + int(1.1 * sample_rate))
        if i1 <= i0:
            continue
        bt = t[i0:i1] - bell_time
        bell = np.zeros_like(bt)
        for bf in [2637.0, 3135.9, 3951.0, 4698.6]:
            bell += np.sin(2.0 * math.pi * bf * bt + rng.uniform(0, 3))
        bell *= np.exp(-bt * 4.8) * np.minimum(1.0, bt / 0.01) * 0.035
        left[i0:i1] += bell * 0.9
        right[i0:i1] += bell * 1.1

    # Crepitar muy suave y cálido de chimenea (bajo volumen)
    noise = rng.normal(0.0, 1.0, n_samples)
    # Filtro paso bajo simple por media móvil
    kernel = np.ones(28) / 28.0
    rumble = np.convolve(noise, kernel, mode="same") * 0.018
    pops_idx = rng.integers(0, n_samples - 400, size=65)
    crackle = np.zeros(n_samples, dtype=np.float64)
    pop_t = np.arange(400) / sample_rate
    pop_env = np.exp(-pop_t * 95.0)
    for pidx in pops_idx:
        amp = rng.uniform(0.015, 0.045)
        crackle[pidx : pidx + 400] += rng.normal(0, 1, 400) * pop_env * amp
    left += rumble + crackle * 0.9
    right += rumble + crackle * 1.1

    # Fade in y fade out global
    fade_in = int(0.45 * sample_rate)
    fade_out = int(1.6 * sample_rate)
    left[:fade_in] *= np.linspace(0.0, 1.0, fade_in)
    right[:fade_in] *= np.linspace(0.0, 1.0, fade_in)
    left[-fade_out:] *= np.linspace(1.0, 0.0, fade_out)
    right[-fade_out:] *= np.linspace(1.0, 0.0, fade_out)

    stereo = np.stack([left, right], axis=1)
    peak = np.max(np.abs(stereo))
    if peak > 0.85:
        stereo = stereo * (0.85 / peak)

    pcm = (np.clip(stereo, -1.0, 1.0) * 32767.0).astype(np.int16)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output_path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.tobytes())


def cover_resize(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Redimensiona con crop centrado manteniendo proporción 16:9."""
    src_w, src_h = img.size
    target_ratio = target_w / target_h
    src_ratio = src_w / src_h
    if src_ratio > target_ratio:
        new_w = int(src_h * target_ratio)
        left = (src_w - new_w) // 2
        img = img.crop((left, 0, left + new_w, src_h))
    elif src_ratio < target_ratio:
        new_h = int(src_w / target_ratio)
        top = (src_h - new_h) // 2
        img = img.crop((0, top, src_w, top + new_h))
    return img.resize((target_w, target_h), Image.Resampling.LANCZOS)


def build_santa_base_video(image_path: Path, output_path: Path, duration: float = 18.0, fps: int = 25) -> None:
    """Anima santa_base.png en un vídeo 1280x720 fluido usando Ken Burns, luz de chimenea, partículas y micro-movimiento."""
    if not image_path.exists():
        raise FileNotFoundError(f"No se encuentra la imagen base: {image_path}")

    out_w, out_h = 1280, 720
    # Lienzo de trabajo algo mayor para Ken Burns sin pérdida de nitidez
    work_w, work_h = 1360, 765
    base_img = Image.open(image_path).convert("RGB")
    base_img = cover_resize(base_img, work_w, work_h)
    base_arr = np.asarray(base_img, dtype=np.float32)

    # Coordenadas normalizadas para máscara suave de micro-movimiento en bigote/barba y respiración
    yy, xx = np.mgrid[0:out_h, 0:out_w].astype(np.float32)
    nx = xx / out_w
    ny = yy / out_h

    # Máscara suave centrada en bigote/barba (centro horizontal, ~36% vertical en santa_base.png)
    beard_dist = ((nx - 0.51) / 0.085) ** 2 + ((ny - 0.36) / 0.085) ** 2
    beard_mask = np.exp(-beard_dist * 1.8)

    # Brillo cálido de chimenea en el lado izquierdo
    glow_dist = ((nx - 0.16) / 0.45) ** 2 + ((ny - 0.55) / 0.55) ** 2
    glow_mask = np.exp(-glow_dist * 1.4)[..., None]

    # Partículas doradas flotantes (polvo mágico de Navidad)
    rng = np.random.default_rng(2026)
    num_particles = 36
    p_x0 = rng.uniform(0.03, 0.97, num_particles)
    p_y0 = rng.uniform(0.05, 0.95, num_particles)
    p_vx = rng.uniform(-0.006, 0.008, num_particles)
    p_vy = rng.uniform(-0.022, -0.008, num_particles)
    p_size = rng.uniform(2.0, 5.2, num_particles)
    p_phase = rng.uniform(0.0, 2.0 * math.pi, num_particles)

    total_frames = int(duration * fps)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        FFMPEG_BIN,
        "-y",
        "-f", "rawvideo",
        "-pix_fmt", "rgb24",
        "-s", f"{out_w}x{out_h}",
        "-r", str(fps),
        "-i", "-",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        str(output_path),
    ]

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    assert proc.stdin is not None

    # Grilla base de muestreo bilineal rápido por vecino/interpolación simple
    base_y_grid = np.linspace(0, 1, out_h, dtype=np.float32)[:, None]
    base_x_grid = np.linspace(0, 1, out_w, dtype=np.float32)[None, :]

    for frame_idx in range(total_frames):
        t = frame_idx / fps
        progress = frame_idx / max(1, total_frames - 1)

        # Zoom Ken Burns muy sutil (1.0 -> 1.045 -> 1.01) + ligero balanceo orgánico
        zoom = 1.0 + 0.038 * math.sin(progress * math.pi)
        pan_x = 0.5 + 0.006 * math.sin(t * 0.45)
        pan_y = 0.5 + 0.004 * math.cos(t * 0.35)

        crop_w = work_w / zoom
        crop_h = work_h / zoom
        x0 = max(0.0, min(work_w - crop_w, pan_x * work_w - crop_w / 2.0))
        y0 = max(0.0, min(work_h - crop_h, pan_y * work_h - crop_h / 2.0))

        # Simulación sutil de movimiento del bigote/barba como si hablara detrás del bigote
        speech_pulse = (
            0.55 * math.sin(t * 7.8)
            + 0.35 * math.sin(t * 12.3 + 0.7)
            + 0.25 * math.cos(t * 4.5)
        )
        # Pausa breve en los momentos entre frases (aprox cada 4.5s)
        pause_env = 0.35 + 0.65 * (0.5 + 0.5 * math.sin(t * 1.45))
        disp_y = beard_mask * (speech_pulse * pause_env * 2.2)

        sample_x = np.clip(x0 + base_x_grid * crop_w, 0, work_w - 1.001)
        sample_y = np.clip(y0 + base_y_grid * crop_h + disp_y, 0, work_h - 1.001)

        xi = sample_x.astype(np.int32)
        yi = sample_y.astype(np.int32)
        fx = (sample_x - xi)[..., None]
        fy = (sample_y - yi)[..., None]

        # Interpolación bilineal para movimiento ultra suave sin saltos de píxel
        c00 = base_arr[yi, xi]
        c10 = base_arr[yi, xi + 1]
        c01 = base_arr[yi + 1, xi]
        c11 = base_arr[yi + 1, xi + 1]
        frame = (
            c00 * (1.0 - fx) * (1.0 - fy)
            + c10 * fx * (1.0 - fy)
            + c01 * (1.0 - fx) * fy
            + c11 * fx * fy
        )

        # Destello cálido suave de la chimenea
        flicker = 1.0 + 0.055 * (math.sin(t * 5.2) * 0.6 + math.sin(t * 9.7) * 0.4)
        warm_tint = np.array([1.06, 0.99, 0.90], dtype=np.float32) * flicker
        frame = frame * (1.0 - glow_mask * 0.14) + (frame * warm_tint) * (glow_mask * 0.14)

        # Añadir partículas doradas suaves sobre capa PIL rápida
        frame_u8 = np.clip(frame, 0, 255).astype(np.uint8)
        pil_frame = Image.fromarray(frame_u8, mode="RGB")

        overlay = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        for i in range(num_particles):
            px = ((p_x0[i] + p_vx[i] * t) % 1.0) * out_w
            py = ((p_y0[i] + p_vy[i] * t) % 1.0) * out_h
            twinkle = 0.35 + 0.65 * (0.5 + 0.5 * math.sin(t * 3.1 + p_phase[i]))
            alpha = int(115 * twinkle)
            r = p_size[i]
            draw.ellipse((px - r, py - r, px + r, py + r), fill=(255, 224, 140, alpha))
            draw.ellipse((px - r * 0.45, py - r * 0.45, px + r * 0.45, py + r * 0.45), fill=(255, 250, 225, min(220, alpha + 70)))

        pil_frame = Image.alpha_composite(pil_frame.convert("RGBA"), overlay).convert("RGB")
        proc.stdin.write(pil_frame.tobytes())

    proc.stdin.close()
    stderr_out = proc.stderr.read().decode("utf-8", errors="replace")
    rc = proc.wait()
    if rc != 0:
        raise RuntimeError(f"FFmpeg falló generando santa_base.mp4 (rc={rc}): {stderr_out}")


def main():
    parser = argparse.ArgumentParser(description="Construye música navideña y vídeo base de Papá Noel.")
    parser.add_argument("--only-bgm", action="store_true", help="Genera solo el archivo de música navideña")
    parser.add_argument("--only-video", action="store_true", help="Genera solo el vídeo base desde santa_base.png")
    args = parser.parse_args()

    if not args.only_video:
        bgm_path = ASSETS_DIR / "bgm_christmas.wav"
        print(f"Generando música navideña: {bgm_path}")
        build_bgm_wav(bgm_path)
        print("Música navideña generada correctamente.")

    if not args.only_bgm:
        img_path = ASSETS_DIR / "santa_base.png"
        vid_path = ASSETS_DIR / "santa_base.mp4"
        print(f"Generando vídeo base desde {img_path} -> {vid_path}")
        build_santa_base_video(img_path, vid_path)
        print("Vídeo base generado correctamente.")


if __name__ == "__main__":
    main()
