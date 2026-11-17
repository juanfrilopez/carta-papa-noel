const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const https = require('https');

const execFileAsync = promisify(execFile);

const ROOT_DIR = path.resolve(__dirname, '..');
const CACHE_NAMES_DIR = path.join(ROOT_DIR, 'cache', 'audio', 'names');
const CACHE_SEGMENTS_DIR = path.join(ROOT_DIR, 'cache', 'audio', 'segments');
const TTS_CONFIG_FILE = path.join(ROOT_DIR, 'generated', 'tts_config.json');

const EDGE_TTS_BIN =
  process.env.EDGE_TTS_BIN || (fs.existsSync('/opt/homebrew/bin/edge-tts') ? '/opt/homebrew/bin/edge-tts' : 'edge-tts');
const FFMPEG_BIN =
  process.env.FFMPEG_BIN || (fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');
const SAY_BIN = '/usr/bin/say';

const ALLOWED_GEMINI_MODELS = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
const ALLOWED_GEMINI_VOICES = ['Charon', 'Orus', 'Fenrir', 'Enceladus', 'Puck'];

const ttsConfig = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts',
  geminiVoice: process.env.GEMINI_TTS_VOICE || 'Charon',
  geminiStylePrompt:
    process.env.GEMINI_TTS_STYLE ||
    'Voz de Papá Noel en español de España, abuelo entrañable, voz grave, cálida, pausada, sonriente y mágica de cuento navideño',
};

try {
  if (fs.existsSync(TTS_CONFIG_FILE)) {
    const saved = JSON.parse(fs.readFileSync(TTS_CONFIG_FILE, 'utf8'));
    if (typeof saved.geminiApiKey === 'string' && saved.geminiApiKey.trim()) {
      ttsConfig.geminiApiKey = saved.geminiApiKey.trim();
    }
    if (typeof saved.geminiModel === 'string' && ALLOWED_GEMINI_MODELS.includes(saved.geminiModel.trim())) {
      ttsConfig.geminiModel = saved.geminiModel.trim();
    }
    if (typeof saved.geminiVoice === 'string' && ALLOWED_GEMINI_VOICES.includes(saved.geminiVoice.trim())) {
      ttsConfig.geminiVoice = saved.geminiVoice.trim();
    }
    if (typeof saved.geminiStylePrompt === 'string' && saved.geminiStylePrompt.trim()) {
      ttsConfig.geminiStylePrompt = saved.geminiStylePrompt.trim();
    }
  }
} catch (err) {
  console.warn('[voiceEngine] No se pudo cargar tts_config.json:', err.message);
}

const ACHIEVEMENTS = {
  cole: {
    label: 'Gran esfuerzo en el cole',
    text: 'Mis elfos me han contado lo mucho que te has esforzado en el cole este año, y estoy muy orgulloso de ti.',
  },
  casa: {
    label: 'Ayudar muchísimo en casa',
    text: 'Mis elfos me han dicho que ayudas muchísimo en casa y que tienes un corazón enorme.',
  },
  hermanos: {
    label: 'Cuidar y querer a su familia',
    text: 'Me ha hecho muy feliz saber lo bien que te portas y cuánto cuidas a tu familia.',
  },
  deporte: {
    label: 'Energía, ilusión y deporte',
    text: 'He visto en mi libro mágico cuánta energía y ganas le pones a todo lo que haces.',
  },
  valiente: {
    label: 'Ser valiente y muy bueno',
    label_f: 'Ser valiente y muy buena',
    text: 'En el Polo Norte todos hablamos de lo valiente, bueno y cariñoso que has sido este año.',
    text_f: 'En el Polo Norte todos hablamos de lo valiente, buena y cariñosa que has sido este año.',
  },
};

const BEHAVIORS = {
  super_bien: {
    label: 'Portarse súper bien todo el año',
    text: 'He mirado en mi Gran Libro Mágico y veo que has dicho la verdad: te has portado requetebién este año. Ya tengo tus deseos bien apuntados para Nochebuena. Sigue así, acuéstate prontito esa noche... ¡y muy Feliz Navidad!',
  },
  casi_siempre: {
    label: 'Muy bueno (con alguna pequeña travesura)',
    label_f: 'Muy buena (con alguna pequeña travesura)',
    text: 'Me ha gustado mucho tu sinceridad al contarme que, aunque ha habido alguna pequeña travesura, te has portado fenomenal casi todos los días. Ya tengo tus deseos apuntados para Nochebuena. Acuéstate prontito esa noche... ¡y muy Feliz Navidad!',
  },
  regular: {
    label: 'Sincero: a veces cuesta obedecer, pero mejorando',
    label_f: 'Sincera: a veces cuesta obedecer, pero mejorando',
    text: 'Como en el Polo Norte lo sabemos todo, me alegra mucho que no me hayas mentido y reconozcas que algunos días te ha costado hacer caso a la primera. Pero sé que tienes muy buen corazón y que hasta Nochebuena te vas a portar genial. ¡Confío en ti y muy Feliz Navidad!',
  },
  travieso: {
    label: 'Pequeño terremoto sincero con trato mágico',
    label_f: 'Pequeña terremoto sincera con trato mágico',
    text: '¡Menos mal que has sido sincero y no me has mentido! Mis elfos ya me habían chivado que este año has sido un pequeño terremoto. Pero como has dicho la verdad, hagamos un trato mágico: pórtate de diez hasta Nochebuena y tendrás tu sorpresa. ¡Muy Feliz Navidad!',
    text_f: '¡Menos mal que has sido sincera y no me has mentido! Mis elfos ya me habían chivado que este año has sido un pequeño terremoto. Pero como has dicho la verdad, hagamos un trato mágico: pórtate de diez hasta Nochebuena y tendrás tu sorpresa. ¡Muy Feliz Navidad!',
  },
};

const FIXED_SEGMENTS = {
  intro: 'Acabo de recibir tu carta mágica aquí en mi taller del Polo Norte.',
  outro: 'Ya tengo tus deseos bien apuntados para Nochebuena. Sigue portándote así de bien, acuéstate prontito esa noche... ¡y muy Feliz Navidad!',
};

const COMMON_NAMES = [
  'Lucas', 'Lucía', 'Mateo', 'Sofía', 'Martín', 'Martina', 'Hugo', 'Valeria',
  'Leo', 'Paula', 'Daniel', 'Julia', 'Pablo', 'Emma', 'Alejandro', 'Daniela',
  'Álvaro', 'Carla', 'Adrián', 'Alba', 'Enzo', 'Noa', 'Mario', 'Chloe',
  'Diego', 'Olivia', 'Oliver', 'Claudia', 'Marcos', 'Carmen',
  'Manuel', 'María', 'Liam', 'Vega', 'Thiago', 'Alma', 'Gael', 'Mía',
  'Izan', 'Vera', 'Bruno', 'Sara', 'Javier', 'Elena', 'Carlos', 'Inés',
  'Gonzalo', 'Aitana', 'Nicolás', 'Lola', 'Darío', 'Valentina', 'Gabriel', 'Jimena',
  'Samuel', 'Abril', 'Dylan', 'Triana', 'Marc', 'Nora',
];

fs.mkdirSync(CACHE_NAMES_DIR, { recursive: true });
fs.mkdirSync(CACHE_SEGMENTS_DIR, { recursive: true });

function slugifyName(name) {
  return String(name || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'amigo';
}

function formatDisplayName(name) {
  const cleaned = String(name || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Pequeño';
  return cleaned
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isValidAudioFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 1024;
  } catch {
    return false;
  }
}

async function requestGeminiTtsModel(modelName, payload, apiKey) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 30000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(raw));
            } catch (e) {
              reject(new Error(`Respuesta JSON inválida de Gemini TTS: ${raw.slice(0, 200)}`));
            }
          } else {
            const err = new Error(`Gemini TTS HTTP ${res.statusCode}: ${raw.slice(0, 300)}`);
            err.statusCode = res.statusCode;
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Timeout en Gemini TTS'));
    });
    req.write(payload);
    req.end();
  });
}

async function synthesizeWithGeminiTts(text, outputPath) {
  const apiKey = ttsConfig.geminiApiKey;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada');
  }

  const part = { text };
  if (ttsConfig.geminiStylePrompt && ttsConfig.geminiStylePrompt.trim()) {
    part.speechMetadata = {
      speaker: 'PapaNoel',
      style: ttsConfig.geminiStylePrompt.trim(),
    };
  }

  const payload = JSON.stringify({
    contents: [
      {
        parts: [part],
      },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: ttsConfig.geminiVoice || 'Charon',
          },
        },
      },
    },
  });

  const candidates = [
    ttsConfig.geminiModel,
    ...ALLOWED_GEMINI_MODELS.filter((m) => m !== ttsConfig.geminiModel),
  ];

  let responseJson = null;
  let usedModel = ttsConfig.geminiModel;
  let lastErr = null;

  for (const candidateModel of candidates) {
    try {
      responseJson = await requestGeminiTtsModel(candidateModel, payload, apiKey);
      usedModel = candidateModel;
      break;
    } catch (err) {
      lastErr = err;
      if (err.statusCode === 429) {
        console.warn(`[voiceEngine] Cuota 429 en ${candidateModel}, probando siguiente modelo Gemini TTS...`);
        continue;
      }
      throw err;
    }
  }

  if (!responseJson) {
    throw lastErr || new Error('Todos los modelos Gemini TTS devolvieron error');
  }

  const parts = responseJson?.candidates?.[0]?.content?.parts || [];
  const audioPart = parts.find((p) => p?.inlineData?.data);
  if (!audioPart) {
    throw new Error('Gemini TTS no devolvió datos de audio en inlineData');
  }

  const audioBytes = Buffer.from(audioPart.inlineData.data, 'base64');
  const tmpWav = `${outputPath}.tmp.wav`;
  const tmpMp3 = `${outputPath}.tmp.mp3`;

  try {
    fs.writeFileSync(tmpWav, audioBytes);
    await execFileAsync(
      FFMPEG_BIN,
      ['-y', '-i', tmpWav, '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '160k', tmpMp3],
      { timeout: 20000 }
    );
    if (!isValidAudioFile(tmpMp3)) {
      throw new Error('Gemini TTS + ffmpeg produjo un archivo MP3 vacío');
    }
    fs.renameSync(tmpMp3, outputPath);
    return `${usedModel} (${ttsConfig.geminiVoice})`;
  } finally {
    if (fs.existsSync(tmpWav)) fs.unlinkSync(tmpWav);
    if (fs.existsSync(tmpMp3)) fs.unlinkSync(tmpMp3);
  }
}

async function synthesizeWithElevenLabs(text, outputPath) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY no configurada');
  }
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
  const payload = JSON.stringify({
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.55,
      similarity_boost: 0.78,
      style: 0.35,
      use_speaker_boost: true,
    },
  });

  const buffer = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.elevenlabs.io',
        path: `/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 25000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const data = Buffer.concat(chunks);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`ElevenLabs HTTP ${res.statusCode}: ${data.toString('utf8').slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Timeout en ElevenLabs'));
    });
    req.write(payload);
    req.end();
  });

  fs.writeFileSync(outputPath, buffer);
}

async function synthesizeWithEdgeTts(text, outputPath) {
  const tmpPath = `${outputPath}.tmp.mp3`;
  try {
    await execFileAsync(
      EDGE_TTS_BIN,
      [
        '--voice',
        'es-ES-AlvaroNeural',
        '--rate=-5%',
        '--pitch=-8Hz',
        '--text',
        text,
        '--write-media',
        tmpPath,
      ],
      { timeout: 15000 }
    );
    if (!isValidAudioFile(tmpPath)) {
      throw new Error('edge-tts produjo un archivo vacío');
    }
    fs.renameSync(tmpPath, outputPath);
  } catch (err) {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    throw err;
  }
}

async function synthesizeWithMacSay(text, outputPath) {
  const tmpAiff = `${outputPath}.tmp.aiff`;
  const tmpMp3 = `${outputPath}.tmp.mp3`;
  try {
    await execFileAsync(
      SAY_BIN,
      ['-v', 'Grandpa (Español (España))', '-r', '165', '-o', tmpAiff, text],
      { timeout: 15000 }
    );
    await execFileAsync(
      FFMPEG_BIN,
      [
        '-y',
        '-i',
        tmpAiff,
        '-af',
        'asetrate=22050*0.92,aresample=44100,lowpass=f=3800',
        '-c:a',
        'libmp3lame',
        '-b:a',
        '128k',
        tmpMp3,
      ],
      { timeout: 15000 }
    );
    if (!isValidAudioFile(tmpMp3)) {
      throw new Error('say + ffmpeg produjo un archivo vacío');
    }
    fs.renameSync(tmpMp3, outputPath);
  } finally {
    if (fs.existsSync(tmpAiff)) fs.unlinkSync(tmpAiff);
    if (fs.existsSync(tmpMp3)) fs.unlinkSync(tmpMp3);
  }
}

async function synthesizeClip(text, outputPath) {
  // Prioridad 1: Google AI Studio (Gemini 3.8 TTS con fallback automático de modelo)
  if (ttsConfig.geminiApiKey) {
    try {
      return await synthesizeWithGeminiTts(text, outputPath);
    } catch (err) {
      console.warn('[voiceEngine] Falló Gemini TTS, intentando siguiente motor:', err.message);
    }
  }

  // Prioridad 2: ElevenLabs si hay API Key
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      await synthesizeWithElevenLabs(text, outputPath);
      return 'elevenlabs';
    } catch (err) {
      console.warn('[voiceEngine] Falló ElevenLabs, intentando Edge-TTS:', err.message);
    }
  }

  // Prioridad 3: Edge-TTS gratuito
  try {
    await synthesizeWithEdgeTts(text, outputPath);
    return 'edge-tts';
  } catch (err) {
    console.warn('[voiceEngine] Edge-TTS no disponible, usando fallback offline macOS say:', err.message);
  }

  // Fallback offline macOS say
  await synthesizeWithMacSay(text, outputPath);
  return 'macos-say-offline';
}

function getProviderLabel(defaultProvider = 'cache') {
  if (defaultProvider !== 'cache') return defaultProvider;
  if (ttsConfig.geminiApiKey) return `cache (${ttsConfig.geminiModel} • ${ttsConfig.geminiVoice})`;
  if (process.env.ELEVENLABS_API_KEY) return 'cache (elevenlabs)';
  return 'cache (coste 0€)';
}

async function ensureClip(text, filePath) {
  if (isValidAudioFile(filePath)) {
    return { filePath, cacheHit: true, provider: 'cache' };
  }
  const provider = await synthesizeClip(text, filePath);
  return { filePath, cacheHit: false, provider };
}

const FEMALE_NAMES = new Set([
  'lucia', 'sofia', 'martina', 'valeria', 'paula', 'julia', 'emma', 'daniela',
  'carla', 'alba', 'noa', 'chloe', 'olivia', 'claudia', 'carmen', 'maria',
  'vega', 'alma', 'mia', 'vera', 'sara', 'elena', 'ines', 'aitana', 'lola',
  'valentina', 'jimena', 'abril', 'triana', 'nora', 'julieta', 'rocio', 'candela',
  'laia', 'clara', 'adriana', 'blanca', 'marina', 'natalia', 'irene', 'alicia',
  'ainhoa', 'leire', 'nahia', 'leyre', 'elisa', 'celia', 'helena', 'ariadna',
  'raquel', 'beatriz', 'isabel', 'ana', 'alejandra', 'angela', 'patricia', 'marta',
  'nuria', 'miriam', 'belen', 'ruth', 'esther', 'zoe', 'naia', 'cayetana',
]);

const MALE_ENDING_A = new Set(['luca', 'borja', 'bautista', 'joshua', 'ezra', 'nikita', 'garcia']);

function inferGenderFromName(rawName) {
  const firstWord = String(rawName || '')
    .trim()
    .split(/\s+/)[0] || '';
  const norm = firstWord
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (!norm) return 'm';
  if (MALE_ENDING_A.has(norm)) return 'm';
  if (FEMALE_NAMES.has(norm) || norm.endsWith('a')) return 'f';
  return 'm';
}

async function prepareSpeechClips({ childName, achievement, behavior, gender }) {
  const displayName = formatDisplayName(childName);
  const nameSlug = slugifyName(displayName);
  const resolvedGender = gender === 'f' || gender === 'm' ? gender : inferGenderFromName(displayName);

  const achKey = ACHIEVEMENTS[achievement] ? achievement : 'cole';
  const achData = ACHIEVEMENTS[achKey];
  const behKey = BEHAVIORS[behavior] ? behavior : 'super_bien';
  const behData = BEHAVIORS[behKey];

  const useFemAch = resolvedGender === 'f' && Boolean(achData.text_f);
  const useFemBeh = resolvedGender === 'f' && Boolean(behData.text_f);

  const achText = useFemAch ? achData.text_f : achData.text;
  const achLabel = resolvedGender === 'f' ? (achData.label_f || achData.label) : achData.label;
  const behText = useFemBeh ? behData.text_f : behData.text;
  const behLabel = resolvedGender === 'f' ? (behData.label_f || behData.label) : behData.label;

  const namePath = path.join(CACHE_NAMES_DIR, `${nameSlug}.mp3`);
  const introPath = path.join(CACHE_SEGMENTS_DIR, 'intro.mp3');
  const achPath = path.join(CACHE_SEGMENTS_DIR, useFemAch ? `ach_${achKey}_f.mp3` : `ach_${achKey}.mp3`);
  const behPath = path.join(CACHE_SEGMENTS_DIR, useFemBeh ? `beh_${behKey}_f.mp3` : `beh_${behKey}.mp3`);

  const nameText = `¡Jo, jo, jo! ¡Hola, ${displayName}!`;

  const nameRes = await ensureClip(nameText, namePath);
  const introRes = await ensureClip(FIXED_SEGMENTS.intro, introPath);
  const achRes = await ensureClip(achText, achPath);
  const behRes = await ensureClip(behText, behPath);

  const providersUsed = [nameRes.provider, introRes.provider, achRes.provider, behRes.provider].filter(
    (p) => p !== 'cache'
  );
  const primaryProvider = providersUsed.length > 0 ? providersUsed[0] : getProviderLabel();

  return {
    displayName,
    nameSlug,
    gender: resolvedGender,
    achievementKey: achKey,
    achievementLabel: achLabel,
    behaviorKey: behKey,
    behaviorLabel: behLabel,
    clips: [nameRes.filePath, introRes.filePath, achRes.filePath, behRes.filePath],
    nameCacheHit: nameRes.cacheHit,
    segmentsCacheHits: {
      intro: introRes.cacheHit,
      achievement: achRes.cacheHit,
      behavior: behRes.cacheHit,
    },
    providerUsed: primaryProvider,
    estimatedCostEur: 0,
  };
}

async function pregenerateCommonNames(limit = 15) {
  const subset = COMMON_NAMES.slice(0, Math.max(1, Math.min(COMMON_NAMES.length, Number(limit) || 15)));
  let created = 0;
  let alreadyCached = 0;
  let lastProvider = 'cache';

  for (const rawName of subset) {
    const displayName = formatDisplayName(rawName);
    const slug = slugifyName(displayName);
    const clipPath = path.join(CACHE_NAMES_DIR, `${slug}.mp3`);
    const res = await ensureClip(`¡Jo, jo, jo! ¡Hola, ${displayName}!`, clipPath);
    if (res.cacheHit) {
      alreadyCached += 1;
    } else {
      created += 1;
      lastProvider = res.provider;
    }
  }

  // Asegurar también los bloques base
  await ensureClip(FIXED_SEGMENTS.intro, path.join(CACHE_SEGMENTS_DIR, 'intro.mp3'));
  for (const [key, item] of Object.entries(ACHIEVEMENTS)) {
    await ensureClip(item.text, path.join(CACHE_SEGMENTS_DIR, `ach_${key}.mp3`));
  }
  for (const [key, item] of Object.entries(BEHAVIORS)) {
    await ensureClip(item.text, path.join(CACHE_SEGMENTS_DIR, `beh_${key}.mp3`));
  }

  return {
    totalProcessed: subset.length,
    created,
    alreadyCached,
    provider: lastProvider,
  };
}

function maskApiKey(key) {
  if (!key) return '';
  const trimmed = String(key).trim();
  if (trimmed.length <= 12) return '****';
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
}

function getTtsConfig() {
  return {
    model: ttsConfig.geminiModel,
    voice: ttsConfig.geminiVoice,
    stylePrompt: ttsConfig.geminiStylePrompt,
    apiKeyMasked: maskApiKey(ttsConfig.geminiApiKey),
    hasGeminiKey: Boolean(ttsConfig.geminiApiKey),
    allowedModels: ALLOWED_GEMINI_MODELS,
    allowedVoices: ALLOWED_GEMINI_VOICES,
  };
}

function updateTtsConfig({ apiKey, voice, model, stylePrompt } = {}) {
  if (typeof apiKey === 'string' && apiKey.trim()) {
    ttsConfig.geminiApiKey = apiKey.trim();
  }
  if (typeof model === 'string' && ALLOWED_GEMINI_MODELS.includes(model.trim())) {
    ttsConfig.geminiModel = model.trim();
  }
  if (typeof voice === 'string' && ALLOWED_GEMINI_VOICES.includes(voice.trim())) {
    ttsConfig.geminiVoice = voice.trim();
  }
  if (typeof stylePrompt === 'string') {
    ttsConfig.geminiStylePrompt = stylePrompt.trim();
  }
  try {
    fs.mkdirSync(path.dirname(TTS_CONFIG_FILE), { recursive: true });
    fs.writeFileSync(TTS_CONFIG_FILE, JSON.stringify(ttsConfig, null, 2));
  } catch (err) {
    console.warn('[voiceEngine] No se pudo guardar tts_config.json:', err.message);
  }
  return getTtsConfig();
}

function clearAudioCache() {
  let deleted = 0;
  for (const dir of [CACHE_NAMES_DIR, CACHE_SEGMENTS_DIR]) {
    try {
      for (const file of fs.readdirSync(dir)) {
        if (file.endsWith('.mp3')) {
          fs.unlinkSync(path.join(dir, file));
          deleted += 1;
        }
      }
    } catch {
      // ignore missing dir errors
    }
  }
  return { deleted };
}

function getCacheStats() {
  let cachedNames = [];
  let cachedSegments = [];
  try {
    cachedNames = fs
      .readdirSync(CACHE_NAMES_DIR)
      .filter((f) => f.endsWith('.mp3'))
      .map((f) => f.replace(/\.mp3$/, ''));
  } catch {
    cachedNames = [];
  }
  try {
    cachedSegments = fs
      .readdirSync(CACHE_SEGMENTS_DIR)
      .filter((f) => f.endsWith('.mp3'))
      .map((f) => f.replace(/\.mp3$/, ''));
  } catch {
    cachedSegments = [];
  }
  return {
    cachedNamesCount: cachedNames.length,
    cachedNames: cachedNames.slice(0, 60),
    cachedSegmentsCount: cachedSegments.length,
    geminiTtsConfigured: Boolean(ttsConfig.geminiApiKey),
    ttsConfig: getTtsConfig(),
    elevenLabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
  };
}

module.exports = {
  ACHIEVEMENTS,
  BEHAVIORS,
  COMMON_NAMES,
  slugifyName,
  formatDisplayName,
  inferGenderFromName,
  prepareSpeechClips,
  pregenerateCommonNames,
  getCacheStats,
  getTtsConfig,
  updateTtsConfig,
  clearAudioCache,
};
