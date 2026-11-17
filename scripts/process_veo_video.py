#!/usr/bin/env python3
"""
Pre-procesa assets/video_santa_1080p.mp4 (vídeo neutro de Papá Noel) a 1280x720 @ 24fps,
rastrea la posición (dx, dy) de nariz/gafas en cada fotograma respecto al fotograma 0,
y exporta un bucle Ping-Pong fluido (Ida + Vuelta) en assets/santa_base.mp4 junto con
las coordenadas pre-calculadas en assets/santa_tracks.json.
"""

import json
import subprocess
from pathlib import Path

import numpy as np

ROOT_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT_DIR / "assets"
INPUT_VIDEO = ASSETS_DIR / "video_santa_1080p.mp4"
OUTPUT_VIDEO = ASSETS_DIR / "santa_base.mp4"
OUTPUT_TRACKS = ASSETS_DIR / "santa_tracks.json"
FFMPEG_BIN = "/opt/homebrew/bin/ffmpeg"
FFPROBE_BIN = "/opt/homebrew/bin/ffprobe"

OUT_W = 1280
OUT_H = 720


def probe_fps(video_path: Path) -> float:
    out = subprocess.check_output(
        [
            FFPROBE_BIN,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=r_frame_rate",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ]
    ).decode().strip()
    num, den = out.split("/")
    return float(num) / float(den)


def load_frames_720p(video_path: Path) -> np.ndarray:
    raw = subprocess.check_output(
        [
            FFMPEG_BIN,
            "-i",
            str(video_path),
            "-vf",
            f"scale={OUT_W}:{OUT_H}:flags=lanczos",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-v",
            "error",
            "-",
        ]
    )
    frame_bytes = OUT_W * OUT_H * 3
    n_frames = len(raw) // frame_bytes
    return np.frombuffer(raw[: n_frames * frame_bytes], dtype=np.uint8).reshape((n_frames, OUT_H, OUT_W, 3))


def track_nose(frame_f32: np.ndarray, tpl: np.ndarray, y0: int, y1: int, x0: int, x1: int, prev_dx: int, prev_dy: int):
    best_score = -1e18
    best_dx, best_dy = prev_dx, prev_dy

    dy_min = max(-45, prev_dy - 14)
    dy_max = min(45, prev_dy + 14)
    dx_min = max(-45, prev_dx - 14)
    dx_max = min(45, prev_dx + 14)

    for dy in range(dy_min, dy_max + 1, 2):
        for dx in range(dx_min, dx_max + 1, 2):
            patch = frame_f32[y0 + dy : y1 + dy, x0 + dx : x1 + dx]
            score = -float(np.mean(np.abs(patch - tpl)))
            if score > best_score:
                best_score = score
                best_dx, best_dy = dx, dy

    c_dx, c_dy = best_dx, best_dy
    for dy in range(max(-46, c_dy - 2), min(46, c_dy + 2) + 1):
        for dx in range(max(-46, c_dx - 2), min(46, c_dx + 2) + 1):
            patch = frame_f32[y0 + dy : y1 + dy, x0 + dx : x1 + dx]
            score = -float(np.mean(np.abs(patch - tpl)))
            if score > best_score:
                best_score = score
                best_dx, best_dy = dx, dy

    return best_dx, best_dy


def smooth_series(vals, window: int = 3):
    n = len(vals)
    half = window // 2
    out = []
    for i in range(n):
        i0 = max(0, i - half)
        i1 = min(n, i + half + 1)
        out.append(round(sum(vals[i0:i1]) / (i1 - i0), 2))
    return out


def main():
    if not INPUT_VIDEO.exists():
        raise FileNotFoundError(f"No existe {INPUT_VIDEO}")

    fps = probe_fps(INPUT_VIDEO)
    print(f"Cargando {INPUT_VIDEO.name} escalado a {OUT_W}x{OUT_H} @ {fps:.2f} fps...")
    frames = load_frames_720p(INPUT_VIDEO)
    n_frames = len(frames)
    print(f"Fotogramas leídos: {n_frames}")

    # Template en 1280x720: puente de nariz y gafas redondas
    y0, y1, x0, x1 = 140, 225, 575, 720
    tpl = frames[0, y0:y1, x0:x1].astype(np.float32)

    raw_dx, raw_dy = [], []
    prev_dx, prev_dy = 0, 0
    for i in range(n_frames):
        f_f32 = frames[i].astype(np.float32)
        dx, dy = track_nose(f_f32, tpl, y0, y1, x0, x1, prev_dx, prev_dy)
        prev_dx, prev_dy = dx, dy
        raw_dx.append(float(dx))
        raw_dy.append(float(dy))

    dx_smooth = smooth_series(raw_dx, window=3)
    dy_smooth = smooth_series(raw_dy, window=3)

    # Ping-Pong: 0..N-1 + N-2..1
    ping_pong_indices = list(range(n_frames)) + list(range(n_frames - 2, 0, -1))
    tracks_ping_pong = [[dx_smooth[i], dy_smooth[i]] for i in ping_pong_indices]

    OUTPUT_TRACKS.write_text(
        json.dumps(
            {
                "width": OUT_W,
                "height": OUT_H,
                "fps": fps,
                "frameCount": len(ping_pong_indices),
                "tracks": tracks_ping_pong,
            }
        ),
        encoding="utf-8",
    )

    print(f"Exportando bucle Ping-Pong ({len(ping_pong_indices)} fotogramas) a {OUTPUT_VIDEO.name}...")
    cmd = [
        FFMPEG_BIN,
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{OUT_W}x{OUT_H}",
        "-r",
        f"{fps:.6f}",
        "-i",
        "-",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-an",
        str(OUTPUT_VIDEO),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    assert proc.stdin is not None
    for idx in ping_pong_indices:
        proc.stdin.write(frames[idx].tobytes())
    proc.stdin.close()
    stderr_out = proc.stderr.read().decode("utf-8", errors="replace")
    rc = proc.wait()
    if rc != 0:
        raise RuntimeError(f"FFmpeg falló (rc={rc}): {stderr_out}")

    print(f"Listo: {OUTPUT_VIDEO} y {OUTPUT_TRACKS} ({len(ping_pong_indices)} fotogramas)")


if __name__ == "__main__":
    main()
