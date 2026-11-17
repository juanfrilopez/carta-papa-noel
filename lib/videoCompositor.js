const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const ROOT_DIR = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const GENERATED_DIR = path.join(ROOT_DIR, 'generated');
const OVERLAY_SCRIPT = path.join(ROOT_DIR, 'scripts', 'render_overlay.py');
const SYNC_RENDER_SCRIPT = path.join(ROOT_DIR, 'scripts', 'render_synced_video.py');

const FFMPEG_BIN =
  process.env.FFMPEG_BIN || (fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');
const FFPROBE_BIN =
  process.env.FFPROBE_BIN || (fs.existsSync('/opt/homebrew/bin/ffprobe') ? '/opt/homebrew/bin/ffprobe' : 'ffprobe');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';

fs.mkdirSync(GENERATED_DIR, { recursive: true });

async function getAudioDuration(audioPath) {
  const { stdout } = await execFileAsync(FFPROBE_BIN, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    audioPath,
  ]);
  const parsed = parseFloat(stdout.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15.0;
}

async function concatVoiceClips(clips, outputVoiceWav) {
  // Inserta 250ms de pausa entre cada bloque de voz + 0.35s inicial + 1.2s de cola final
  const filterParts = [];
  const concatInputs = [];

  // Pausa inicial suave (0.35s)
  filterParts.push('aevalsrc=0:channel_layout=stereo:sample_rate=44100:d=0.35[s_start]');
  concatInputs.push('[s_start]');

  clips.forEach((_, idx) => {
    filterParts.push(
      `[${idx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[c${idx}]`
    );
    concatInputs.push(`[c${idx}]`);
    if (idx < clips.length - 1) {
      filterParts.push(`aevalsrc=0:channel_layout=stereo:sample_rate=44100:d=0.25[p${idx}]`);
      concatInputs.push(`[p${idx}]`);
    }
  });

  // Cola final (1.2s) para despedida musical
  filterParts.push('aevalsrc=0:channel_layout=stereo:sample_rate=44100:d=1.20[s_end]');
  concatInputs.push('[s_end]');

  filterParts.push(`${concatInputs.join('')}concat=n=${concatInputs.length}:v=0:a=1[voice_full]`);

  const args = ['-y'];
  for (const clip of clips) {
    args.push('-i', clip);
  }
  args.push('-filter_complex', filterParts.join(';'), '-map', '[voice_full]', '-c:a', 'pcm_s16le', outputVoiceWav);

  await execFileAsync(FFMPEG_BIN, args, { timeout: 30000 });
  return getAudioDuration(outputVoiceWav);
}

async function composeSantaVideo({
  orderId,
  displayName,
  age,
  achievementLabel,
  letterText,
  clips,
}) {
  const santaBaseVideo = path.join(ASSETS_DIR, 'santa_base.mp4');
  const santaTracksJson = path.join(ASSETS_DIR, 'santa_tracks.json');
  const bgmAudio = path.join(ASSETS_DIR, 'bgm_christmas.wav');

  if (!fs.existsSync(santaBaseVideo)) {
    throw new Error(`Falta el vídeo base en ${santaBaseVideo}`);
  }
  if (!fs.existsSync(bgmAudio)) {
    throw new Error(`Falta la música navideña en ${bgmAudio}`);
  }

  const overlayPng = path.join(GENERATED_DIR, `${orderId}_overlay.png`);
  const voiceFullWav = path.join(GENERATED_DIR, `${orderId}_voice.wav`);
  const outputVideoMp4 = path.join(GENERATED_DIR, `${orderId}.mp4`);
  const previewVideoMp4 = path.join(GENERATED_DIR, `${orderId}_preview.mp4`);

  const safeLetter = String(letterText || '').trim().slice(0, 900);
  const hasSyncedTracks = fs.existsSync(santaTracksJson);

  try {
    // 1. Generar PNG transparente con faldón inferior, sello de lacre y marco del pergamino
    const overlayArgs = [
      OVERLAY_SCRIPT,
      `--name=${displayName}`,
      `--age=${String(age || '')}`,
      `--achievement-label=${achievementLabel || ''}`,
      `--letter-excerpt=${safeLetter}`,
      '--output',
      overlayPng,
    ];
    if (!hasSyncedTracks) {
      overlayArgs.push('--static-letter');
    }

    await execFileAsync(PYTHON_BIN, overlayArgs, { timeout: 15000 });

    // 2. Concatenar los 4 clips de voz con pausas de 250ms
    const totalDuration = await concatVoiceClips(clips, voiceFullWav);

    // 3. Renderizar vídeo sincronizado por amplitud de voz + scroll completo de la carta
    if (hasSyncedTracks) {
      await execFileAsync(
        PYTHON_BIN,
        [
          SYNC_RENDER_SCRIPT,
          '--base-video',
          santaBaseVideo,
          '--tracks',
          santaTracksJson,
          '--voice-wav',
          voiceFullWav,
          '--bgm-wav',
          bgmAudio,
          '--overlay-png',
          overlayPng,
          '--output-mp4',
          outputVideoMp4,
          `--letter-text=${safeLetter}`,
          `--child-name=${displayName}`,
        ],
        { timeout: 120000 }
      );
    } else {
      const fadeStart = Math.max(0, totalDuration - 1.4).toFixed(2);
      const durStr = totalDuration.toFixed(2);
      const filterComplex = [
        '[0:v][1:v]overlay=0:0[vout]',
        '[2:a]volume=1.0[voice]',
        `[3:a]volume=0.22,atrim=0:${durStr},afade=t=out:st=${fadeStart}:d=1.4[bgm]`,
        '[voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]',
      ].join(';');

      await execFileAsync(
        FFMPEG_BIN,
        [
          '-y',
          '-stream_loop',
          '-1',
          '-i',
          santaBaseVideo,
          '-i',
          overlayPng,
          '-i',
          voiceFullWav,
          '-stream_loop',
          '-1',
          '-i',
          bgmAudio,
          '-filter_complex',
          filterComplex,
          '-map',
          '[vout]',
          '-map',
          '[aout]',
          '-t',
          durStr,
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-crf',
          '23',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '160k',
          '-movflags',
          '+faststart',
          outputVideoMp4,
        ],
        { timeout: 45000 }
      );
    }

    await execFileAsync(
      FFMPEG_BIN,
      [
        '-y',
        '-threads',
        '2',
        '-i',
        outputVideoMp4,
        '-t',
        '4.6',
        '-af',
        'afade=t=out:st=4.1:d=0.5',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        previewVideoMp4,
      ],
      { timeout: 20000 }
    );

    return {
      outputVideoMp4,
      previewVideoMp4,
      durationSec: Number(totalDuration.toFixed(2)),
    };
  } finally {
    // Limpiar temporales intermedios para mantener limpia la carpeta generated/
    if (fs.existsSync(overlayPng)) fs.unlinkSync(overlayPng);
    if (fs.existsSync(voiceFullWav)) fs.unlinkSync(voiceFullWav);
  }
}

module.exports = {
  composeSantaVideo,
};
