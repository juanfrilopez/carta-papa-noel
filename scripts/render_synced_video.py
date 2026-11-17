#!/usr/bin/env python3
"""
Renderiza el vídeo final sincronizando el movimiento del bigote/barba de Papá Noel
sílaba a sílaba con la onda real de voice_full.wav (quieto en silencios, animado al hablar),
superpone overlay.png y mezcla voice_full.wav + bgm_christmas.wav con FFmpeg.
"""

import argparse
import json
import math
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image

FFMPEG_BIN = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
WIDTH = 1280
HEIGHT = 720


def compute_voice_envelope(wav_path: Path, fps: float) -> tuple[np.ndarray, float]:
    """Calcula la envolvente RMS normalizada a fps con puerta de ruido (0.0 en pausas)."""
    with wave.open(str(wav_path), "rb") as wf:
        n_channels = wf.getnchannels()
        sample_rate = wf.getframerate()
        n_samples = wf.getnframes()
        raw = wf.readframes(n_samples)

    pcm = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if n_channels > 1:
        pcm = pcm.reshape(-1, n_channels).mean(axis=1)

    total_duration = n_samples / float(sample_rate)
    n_frames_out = max(1, int(math.ceil(total_duration * fps)) + 1)
    samples_per_frame = sample_rate / float(fps)

    rms_vals = np.zeros(n_frames_out, dtype=np.float32)
    for k in range(n_frames_out):
        i0 = int(k * samples_per_frame)
        i1 = min(len(pcm), int((k + 1) * samples_per_frame))
        if i1 > i0:
            seg = pcm[i0:i1]
            rms_vals[k] = float(np.sqrt(np.mean(seg * seg)))

    # Puerta de ruido estricta para mantener reposo absoluto en silencios/pausas
    noise_gate = 0.02
    active = rms_vals[rms_vals > noise_gate]
    if len(active) > 0:
        ref_high = max(float(np.percentile(active, 92)), noise_gate + 0.05)
    else:
        ref_high = 0.20

    env = np.clip((rms_vals - noise_gate) / (ref_high - noise_gate), 0.0, 1.0)
    # Suavizado ligero preservando exactamente 0.0 donde no hay voz
    smoothed = np.zeros_like(env)
    for k in range(n_frames_out):
        if env[k] <= 0.005:
            smoothed[k] = 0.0
        else:
            prev_v = env[k - 1] if k > 0 else env[k]
            next_v = env[k + 1] if k + 1 < n_frames_out else env[k]
            smoothed[k] = 0.25 * prev_v + 0.50 * env[k] + 0.25 * next_v

    return smoothed, total_duration


def load_base_frames(video_path: Path) -> np.ndarray:
    raw = subprocess.check_output(
        [
            FFMPEG_BIN,
            "-i",
            str(video_path),
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-v",
            "error",
            "-",
        ]
    )
    frame_bytes = WIDTH * HEIGHT * 3
    n_frames = len(raw) // frame_bytes
    return np.frombuffer(raw[: n_frames * frame_bytes], dtype=np.uint8).reshape((n_frames, HEIGHT, WIDTH, 3))


def prepare_overlay_bands(overlay_png: Path):
    """Extrae únicamente las bandas con opacidad > 0 para componer en milisegundos."""
    ov = np.asarray(Image.open(overlay_png).convert("RGBA"), dtype=np.float32)
    alpha = ov[..., 3:4] / 255.0
    rgb_premult = ov[..., :3] * alpha
    one_minus_a = 1.0 - alpha

    row_has_alpha = np.any(alpha[..., 0] > 0.002, axis=1)
    bands = []
    in_band = False
    start = 0
    for y, active in enumerate(row_has_alpha):
        if active and not in_band:
            start = y
            in_band = True
        elif not active and in_band:
            bands.append((start, y, rgb_premult[start:y], one_minus_a[start:y]))
            in_band = False
    if in_band:
        bands.append((start, HEIGHT, rgb_premult[start:HEIGHT], one_minus_a[start:HEIGHT]))
    return bands


def render_synced(
    base_video: Path,
    tracks_json: Path,
    voice_wav: Path,
    bgm_wav: Path,
    overlay_png: Path,
    output_mp4: Path,
) -> float:
    tracks_data = json.loads(tracks_json.read_text(encoding="utf-8"))
    fps = float(tracks_data.get("fps", 24.0))
    tracks = tracks_data["tracks"]

    env, total_duration = compute_voice_envelope(voice_wav, fps)
    n_frames_out = len(env)

    base_frames = load_base_frames(base_video)
    n_base = len(base_frames)
    overlay_bands = prepare_overlay_bands(overlay_png)

    # Precalcular rejilla local para la subregión del bigote/barba (250x190)
    sub_w = 250
    sub_h = 190
    sy_grid, sx_grid = np.mgrid[0:sub_h, 0:sub_w].astype(np.float32)
    # Centro relativo dentro de la subregión [x: 520..770, y: 200..390] -> (125, 75)
    local_cx = 125.0
    local_cy = 75.0
    falloff = np.exp(-((sx_grid - local_cx) / 62.0) ** 2 - ((sy_grid - local_cy) / 46.0) ** 2)

    dur_str = f"{total_duration:.2f}"
    fade_start = f"{max(0.0, total_duration - 1.4):.2f}"
    filter_complex = (
        "[1:a]volume=1.0[voice];"
        f"[2:a]volume=0.22,atrim=0:{dur_str},afade=t=out:st={fade_start}:d=1.4[bgm];"
        "[voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]"
    )

    cmd = [
        FFMPEG_BIN,
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{WIDTH}x{HEIGHT}",
        "-r",
        f"{fps:.6f}",
        "-i",
        "-",
        "-i",
        str(voice_wav),
        "-stream_loop",
        "-1",
        "-i",
        str(bgm_wav),
        "-filter_complex",
        filter_complex,
        "-map",
        "0:v",
        "-map",
        "[aout]",
        "-t",
        dur_str,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "22",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
        str(output_mp4),
    ]

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    assert proc.stdin is not None

    for k in range(n_frames_out):
        base_idx = k % n_base
        frame = base_frames[base_idx].copy()

        e = float(env[k])
        if e > 0.01:
            dx, dy = tracks[base_idx % len(tracks)]
            x0 = max(0, min(WIDTH - sub_w, int(round(520 + dx))))
            y0 = max(0, min(HEIGHT - sub_h, int(round(200 + dy))))

            # Desplazamiento vertical silábico en el bigote/barba inferior
            amp = e * (0.7 + 0.3 * math.sin(k * 1.6)) * 6.8
            disp_y = falloff * amp

            src_y = np.clip(sy_grid - disp_y, 0.0, sub_h - 1.001)
            yi = src_y.astype(np.int32)
            fy = (src_y - yi)[..., None]
            xi = sx_grid.astype(np.int32)

            patch_f = frame[y0 : y0 + sub_h, x0 : x0 + sub_w].astype(np.float32)
            warped = patch_f[yi, xi] * (1.0 - fy) + patch_f[yi + 1, xi] * fy
            frame[y0 : y0 + sub_h, x0 : x0 + sub_w] = np.clip(warped, 0, 255).astype(np.uint8)

        # Aplicar solo las bandas del overlay donde hay gráficos/texto
        for by0, by1, rgb_pre, one_m_a in overlay_bands:
            band = frame[by0:by1].astype(np.float32)
            frame[by0:by1] = np.clip(band * one_m_a + rgb_pre, 0, 255).astype(np.uint8)

        proc.stdin.write(frame.tobytes())

    proc.stdin.close()
    stderr_out = proc.stderr.read().decode("utf-8", errors="replace")
    rc = proc.wait()
    if rc != 0:
        raise RuntimeError(f"FFmpeg falló renderizando {output_mp4} (rc={rc}): {stderr_out}")

    return total_duration


def main():
    parser = argparse.ArgumentParser(description="Renderiza vídeo de Papá Noel sincronizado por volumen de voz.")
    parser.add_argument("--base-video", required=True)
    parser.add_argument("--tracks", required=True)
    parser.add_argument("--voice-wav", required=True)
    parser.add_argument("--bgm-wav", required=True)
    parser.add_argument("--overlay-png", required=True)
    parser.add_argument("--output-mp4", required=True)
    args = parser.parse_args()

    render_synced(
        base_video=Path(args.base_video),
        tracks_json=Path(args.tracks),
        voice_wav=Path(args.voice_wav),
        bgm_wav=Path(args.bgm_wav),
        overlay_png=Path(args.overlay_png),
        output_mp4=Path(args.output_mp4),
    )


if __name__ == "__main__":
    main()
