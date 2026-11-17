const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { URL } = require('url');

const voiceEngine = require('./lib/voiceEngine');
const videoCompositor = require('./lib/videoCompositor');

const PORT = Number(process.env.PORT || 3456);
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const GENERATED_DIR = path.join(ROOT_DIR, 'generated');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const ORDERS_FILE = path.join(GENERATED_DIR, 'orders.json');
const STRIPE_CONFIG_FILE = path.join(GENERATED_DIR, 'stripe_config.json');

fs.mkdirSync(GENERATED_DIR, { recursive: true });

let stripeConfig = {
  secretKey: (process.env.STRIPE_SECRET_KEY || '').trim(),
  promoCode: (process.env.PROMO_CODE || 'JULIETA27').trim(),
  resendApiKey: (process.env.RESEND_API_KEY || '').trim(),
  resendFrom: (
    process.env.RESEND_FROM_EMAIL || 'Papá Noel • Polo Norte <onboarding@resend.dev>'
  ).trim(),
  supportEmail: (process.env.SUPPORT_EMAIL || 'juanfri1995@gmail.com').trim(),
};
try {
  if (fs.existsSync(STRIPE_CONFIG_FILE)) {
    const saved = JSON.parse(fs.readFileSync(STRIPE_CONFIG_FILE, 'utf8'));
    if (typeof saved.secretKey === 'string' && saved.secretKey.trim()) {
      stripeConfig.secretKey = saved.secretKey.trim();
    }
    if (typeof saved.promoCode === 'string' && saved.promoCode.trim()) {
      stripeConfig.promoCode = saved.promoCode.trim();
    }
    if (typeof saved.resendApiKey === 'string' && saved.resendApiKey.trim()) {
      stripeConfig.resendApiKey = saved.resendApiKey.trim();
    }
    if (typeof saved.resendFrom === 'string' && saved.resendFrom.trim()) {
      stripeConfig.resendFrom = saved.resendFrom.trim();
    }
    if (typeof saved.supportEmail === 'string' && saved.supportEmail.trim()) {
      stripeConfig.supportEmail = saved.supportEmail.trim();
    }
  }
} catch (err) {
  console.warn('[server] No se pudo cargar stripe_config.json:', err.message);
}

function getStripeSecretKey() {
  return (stripeConfig.secretKey || process.env.STRIPE_SECRET_KEY || '').trim();
}

function getPromoCode() {
  return (stripeConfig.promoCode || process.env.PROMO_CODE || 'JULIETA27').trim();
}

function getResendApiKey() {
  return (stripeConfig.resendApiKey || process.env.RESEND_API_KEY || '').trim();
}

function getResendFrom() {
  return (
    stripeConfig.resendFrom ||
    process.env.RESEND_FROM_EMAIL ||
    'Papá Noel • Polo Norte <onboarding@resend.dev>'
  ).trim();
}

function getSupportEmail() {
  return (stripeConfig.supportEmail || process.env.SUPPORT_EMAIL || 'juanfri1995@gmail.com').trim();
}

function maskKey(k) {
  if (!k) return '';
  if (k.length <= 12) return `${k.slice(0, 4)}...`;
  return `${k.slice(0, 8)}...${k.slice(-4)}`;
}

function saveStripeConfig() {
  try {
    fs.writeFileSync(
      STRIPE_CONFIG_FILE,
      JSON.stringify(
        {
          secretKey: stripeConfig.secretKey,
          promoCode: stripeConfig.promoCode,
          resendApiKey: stripeConfig.resendApiKey,
          resendFrom: stripeConfig.resendFrom,
          supportEmail: stripeConfig.supportEmail,
        },
        null,
        2
      )
    );
  } catch (err) {
    console.error('[server] Error guardando stripe_config.json:', err.message);
  }
}

let orders = {};
try {
  if (fs.existsSync(ORDERS_FILE)) {
    orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  }
} catch (err) {
  console.warn('[server] No se pudo cargar orders.json, iniciando vacío:', err.message);
  orders = {};
}

function saveOrders() {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
  } catch (err) {
    console.error('[server] Error guardando orders.json:', err.message);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > 1024 * 1024) {
        reject(new Error('Body demasiado grande'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function serveFileWithRange(req, res, filePath, downloadFilename = null) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Archivo no encontrado');
    return;
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const total = stat.size;

  const baseHeaders = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
  };
  if (['.html', '.css', '.js'].includes(ext)) {
    baseHeaders['Cache-Control'] = 'no-cache';
  }
  if (downloadFilename) {
    baseHeaders['Content-Disposition'] = `attachment; filename="${downloadFilename}"`;
  }

  const rangeHeader = req.headers.range;
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    if (!match) {
      res.writeHead(416, { 'Content-Range': `bytes */${total}` });
      res.end();
      return;
    }
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? Math.min(total - 1, parseInt(match[2], 10)) : total - 1;
    if (start >= total || start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${total}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      ...baseHeaders,
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': end - start + 1,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    ...baseHeaders,
    'Content-Length': total,
  });
  fs.createReadStream(filePath).pipe(res);
}

function stripeRequest(method, apiPath, formParams = null) {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    return Promise.reject(new Error('STRIPE_SECRET_KEY no configurada'));
  }

  const body = formParams ? new URLSearchParams(formParams).toString() : null;
  const headers = {
    Authorization: `Bearer ${secretKey}`,
  };
  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Content-Length'] = Buffer.byteLength(body);
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.stripe.com',
        path: apiPath,
        method,
        headers,
        timeout: 15000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          try {
            const parsed = JSON.parse(raw);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.error?.message || `Stripe HTTP ${res.statusCode}`));
            }
          } catch (e) {
            reject(new Error(`Respuesta inválida de Stripe: ${raw.slice(0, 120)}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function resendRequest(payload) {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return Promise.reject(new Error('RESEND_API_KEY no configurada'));
  }

  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 15000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          try {
            const parsed = JSON.parse(raw);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.message || parsed.error || `Resend HTTP ${res.statusCode}`));
            }
          } catch {
            reject(new Error(`Respuesta inválida de Resend: ${raw.slice(0, 120)}`));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Timeout conectando con Resend')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendOrderEmail(order, origin) {
  const recipient = String(order.parentEmail || '').trim();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error('Correo electrónico no válido.');
  }

  const shareUrl = `${origin}/?orderId=${encodeURIComponent(order.orderId)}`;
  const downloadUrl = `${origin}/api/download/${encodeURIComponent(order.orderId)}`;
  const safeChild = escapeHtmlAttr(order.childName);
  const supportEmail = getSupportEmail();
  const hasDiploma = order.tier === 'pack';

  const html = `
<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:24px;background:#08111c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f6efe6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;margin:0 auto;background:#101f31;border:1px solid #d4a64a;border-radius:18px;overflow:hidden;">
    <tr>
      <td style="padding:28px 28px 18px;text-align:center;background:linear-gradient(135deg,#4f0c14,#1b2b3e);border-bottom:1px solid rgba(230,184,92,0.35);">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:1.6px;color:#f7dfa0;font-weight:700;text-transform:uppercase;">Taller Oficial de Rovaniemi • Laponia</p>
        <h1 style="margin:0;font-size:24px;color:#ffffff;font-family:Georgia,serif;">🎅 ¡El vídeo de Papá Noel para ${safeChild} está listo!</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:26px 28px;font-size:15px;line-height:1.6;color:#dbe6f2;">
        <p style="margin:0 0 14px;">¡Hola! Te enviamos el enlace permanente al mensaje personalizado que Papá Noel ha grabado para <strong>${safeChild}</strong>.</p>
        <p style="margin:0 0 22px;">Puedes verlo a pantalla completa, descargarlo en MP4 y compartirlo con los abuelos y toda la familia cuando quieras:</p>
        <div style="text-align:center;margin:22px 0;">
          <a href="${escapeHtmlAttr(shareUrl)}" style="display:inline-block;padding:14px 26px;background:linear-gradient(180deg,#c92a35,#8e141d);color:#ffffff;text-decoration:none;font-weight:800;border-radius:12px;border:1px solid #f7dfa0;font-size:16px;">🎬 Ver y Descargar el Vídeo de ${safeChild}</a>
        </div>
        <p style="margin:18px 0 8px;font-size:13.5px;color:#b8cbe0;">
          ⬇️ <a href="${escapeHtmlAttr(downloadUrl)}" style="color:#f7dfa0;">Descarga directa del vídeo MP4</a>
          ${hasDiploma ? ' • 📜 Tu pedido incluye además el <strong>Diploma Oficial imprimible</strong> dentro del enlace.' : ''}
        </p>
        <p style="margin:14px 0 0;font-size:12.5px;color:#8fa6bd;word-break:break-all;">
          Enlace directo: <a href="${escapeHtmlAttr(shareUrl)}" style="color:#f7dfa0;">${escapeHtmlAttr(shareUrl)}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;background:#0a1522;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:#8fa6bd;text-align:center;">
        ¿Necesitas ayuda con tu pedido <strong>${escapeHtmlAttr(order.orderId)}</strong>? Escríbenos a <a href="mailto:${escapeHtmlAttr(supportEmail)}" style="color:#f7dfa0;">${escapeHtmlAttr(supportEmail)}</a>.
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = [
    `¡El vídeo de Papá Noel para ${order.childName} está listo!`,
    '',
    `Ver vídeo completo (y diploma si está incluido): ${shareUrl}`,
    `Descarga directa MP4: ${downloadUrl}`,
    '',
    `Si necesitas ayuda con tu pedido (${order.orderId}), escribe a ${supportEmail}.`,
  ].join('\n');

  const result = await resendRequest({
    from: getResendFrom(),
    to: [recipient],
    reply_to: supportEmail,
    subject: `🎅 Vídeo de Papá Noel para ${order.childName} listo para ver y descargar`,
    html,
    text,
  });

  order.emailSent = true;
  order.emailSentTo = recipient;
  order.emailSentAt = new Date().toISOString();
  order.resendEmailId = result?.id || null;
  saveOrders();
  return result;
}

function getStatsPayload(includeAdminSecrets = false) {
  const cacheStats = voiceEngine.getCacheStats();
  const orderList = Object.values(orders);
  const sk = getStripeSecretKey();
  const promo = getPromoCode();
  const rk = getResendApiKey();
  return {
    ...cacheStats,
    stripeConfigured: Boolean(sk),
    stripeMode: sk.startsWith('sk_live_') ? 'live' : sk.startsWith('sk_test_') ? 'test' : 'demo',
    stripeKeyMasked: maskKey(sk),
    promoCodeConfigured: Boolean(promo),
    resendConfigured: Boolean(rk),
    resendKeyMasked: maskKey(rk),
    resendFrom: getResendFrom(),
    supportEmail: getSupportEmail(),
    ...(includeAdminSecrets ? { promoCode: promo } : {}),
    totalOrders: orderList.length,
    unlockedOrders: orderList.filter((o) => o.paid).length,
    baseVideoReady: fs.existsSync(path.join(ASSETS_DIR, 'santa_base.mp4')),
    baseImageReady: fs.existsSync(path.join(ASSETS_DIR, 'santa_base.png')),
    bgmReady: fs.existsSync(path.join(ASSETS_DIR, 'bgm_christmas.wav')),
  };
}

const COMMON_BY_SLUG = new Map(
  (voiceEngine.COMMON_NAMES || []).map((name) => [voiceEngine.slugifyName(name), name])
);

function escapeHtmlAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getRequestOrigin(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function resolveSeoDisplayName(rawName) {
  if (!rawName) return null;
  const cleaned = String(rawName).replace(/-/g, ' ').trim().slice(0, 40);
  if (!cleaned) return null;
  const slug = voiceEngine.slugifyName(cleaned);
  return COMMON_BY_SLUG.get(slug) || voiceEngine.formatDisplayName(cleaned);
}

function renderSeoHtml(req, rawChildName = null, canonicalSlug = null) {
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const origin = getRequestOrigin(req);
  const displayName = resolveSeoDisplayName(rawChildName);
  const canonicalUrl = canonicalSlug ? `${origin}/para/${encodeURIComponent(canonicalSlug)}` : `${origin}/`;

  html = html.replace(/https:\/\/carta-papa-noel\.onrender\.com/g, origin);
  html = html.replace(
    /<link rel="canonical" href="[^"]*" id="canonicalLink" \/>/,
    `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" id="canonicalLink" />`
  );
  html = html.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`
  );

  if (displayName) {
    const safeName = escapeHtmlAttr(displayName);
    const title = `Vídeo de Papá Noel para ${safeName} — Carta Mágica Personalizada desde Laponia`;
    const desc = `Prepara la carta a Papá Noel para ${safeName} y escucha al instante su saludo personalizado en vídeo llamándole por su nombre desde Laponia. Saludo inicial gratis.`;
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
    html = html.replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
      `<meta name="description" content="${desc}" />`
    );
    html = html.replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${title}" />`
    );
    html = html.replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:description" content="${desc}" />`
    );
    html = html.replace(
      /<meta name="twitter:title" content="[^"]*" \/>/,
      `<meta name="twitter:title" content="${title}" />`
    );
    html = html.replace(
      /<h1>Envía tu Carta Mágica a Papá Noel<\/h1>/,
      `<h1>Carta y Vídeo de Papá Noel para ${safeName}</h1>`
    );
    html = html.replace(
      'id="childName"\n                name="childName"',
      `id="childName"\n                name="childName"\n                value="${safeName}"`
    );
  }

  return html;
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, port: PORT });
    }

    if (req.method === 'GET' && pathname === '/api/stats') {
      const includeAdmin = parsedUrl.searchParams.get('admin') === '1';
      return sendJson(res, 200, getStatsPayload(includeAdmin));
    }

    if (req.method === 'POST' && pathname === '/api/send-letter') {
      const body = await readJsonBody(req);
      const rawName = String(body.childName || '').trim();
      if (!rawName || rawName.length > 40) {
        return sendJson(res, 400, { error: 'Introduce el nombre del niño o niña (máximo 40 caracteres).' });
      }

      const age = String(body.age || '').trim().slice(0, 3);
      const gender = body.gender === 'f' ? 'f' : body.gender === 'm' ? 'm' : undefined;
      const achievement = String(body.achievement || 'cole').trim();
      const behavior = String(body.behavior || 'super_bien').trim();
      const letterText = String(body.letterText || '').trim().slice(0, 800);
      const parentEmail = String(body.parentEmail || '').trim().slice(0, 120);

      const orderId = `noel_${crypto.randomBytes(5).toString('hex')}`;
      const startedAt = Date.now();

      const speech = await voiceEngine.prepareSpeechClips({
        childName: rawName,
        achievement,
        behavior,
        gender,
      });

      const video = await videoCompositor.composeSantaVideo({
        orderId,
        displayName: speech.displayName,
        age,
        achievementLabel: `${speech.achievementLabel} • ${speech.behaviorLabel}`,
        letterText,
        clips: speech.clips,
      });

      const renderTimeMs = Date.now() - startedAt;
      const videoUrl = `/generated/${orderId}.mp4`;
      const previewUrl = `/generated/${orderId}_preview.mp4`;

      const order = {
        orderId,
        childName: speech.displayName,
        nameSlug: speech.nameSlug,
        gender: speech.gender,
        age,
        achievement: speech.achievementKey,
        achievementLabel: speech.achievementLabel,
        behavior: speech.behaviorKey,
        behaviorLabel: speech.behaviorLabel,
        letterText,
        parentEmail,
        paid: false,
        videoUrl,
        previewUrl,
        downloadUrl: `/api/download/${orderId}`,
        durationSec: video.durationSec,
        nameCacheHit: speech.nameCacheHit,
        segmentsCacheHits: speech.segmentsCacheHits,
        providerUsed: speech.providerUsed,
        estimatedCostEur: speech.estimatedCostEur,
        renderTimeMs,
        createdAt: new Date().toISOString(),
      };

      orders[orderId] = order;
      saveOrders();

      return sendJson(res, 200, order);
    }

    if (req.method === 'POST' && pathname === '/api/create-checkout') {
      const body = await readJsonBody(req);
      const order = orders[body.orderId];
      if (!order) {
        return sendJson(res, 404, { error: 'Pedido no encontrado.' });
      }
      const tier = body.tier === 'pack' ? 'pack' : 'standard';
      const amountCents = tier === 'pack' ? 199 : 100;
      const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
      const origin = `${proto}://${req.headers.host || `localhost:${PORT}`}`;
      const sk = getStripeSecretKey();

      if (sk) {
        const baseSessionParams = {
          mode: 'payment',
          allow_promotion_codes: 'true',
          client_reference_id: order.orderId,
          'metadata[orderId]': order.orderId,
          'metadata[tier]': tier,
          'line_items[0][price_data][currency]': 'eur',
          'line_items[0][price_data][unit_amount]': String(amountCents),
          'line_items[0][price_data][product_data][name]':
            tier === 'pack'
              ? `Vídeo Mágico de Papá Noel + Diploma para ${order.childName}`
              : `Vídeo Mágico de Papá Noel para ${order.childName}`,
          'line_items[0][quantity]': '1',
          success_url: `${origin}/?orderId=${encodeURIComponent(order.orderId)}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/?orderId=${encodeURIComponent(order.orderId)}&canceled=1`,
          ...(order.parentEmail ? { customer_email: order.parentEmail } : {}),
        };
        let session;
        try {
          session = await stripeRequest('POST', '/v1/checkout/sessions', {
            ...baseSessionParams,
            'managed_payments[enabled]': 'false',
          });
        } catch (stripeErr) {
          if (String(stripeErr.message || '').includes('managed_payments')) {
            session = await stripeRequest('POST', '/v1/checkout/sessions', baseSessionParams);
          } else {
            throw stripeErr;
          }
        }
        return sendJson(res, 200, {
          mode: 'stripe',
          checkoutUrl: session.url,
          sessionId: session.id,
        });
      }

      return sendJson(res, 200, {
        mode: 'demo',
        orderId: order.orderId,
        amountEur: amountCents / 100,
        message: 'Modo demo local activo (sin STRIPE_SECRET_KEY). Puedes desbloquear con un clic.',
      });
    }

    if (req.method === 'POST' && pathname === '/api/unlock-order') {
      const body = await readJsonBody(req);
      const order = orders[body.orderId];
      if (!order) {
        return sendJson(res, 404, { error: 'Pedido no encontrado.' });
      }

      const sk = getStripeSecretKey();
      let verifiedTier = body.tier === 'pack' ? 'pack' : 'standard';

      const submittedPromo = String(body.promoCode || '').trim();
      const activePromo = getPromoCode();
      const isValidPromo =
        Boolean(submittedPromo && activePromo) &&
        submittedPromo.toUpperCase() === activePromo.toUpperCase();

      if (submittedPromo && !isValidPromo) {
        return sendJson(res, 403, { error: 'Código de invitación no válido.' });
      }

      if (isValidPromo) {
        order.paid = true;
        order.paidAt = new Date().toISOString();
        order.tier = 'pack';
        order.unlockedWithPromo = true;
        saveOrders();
        if (order.parentEmail && getResendApiKey() && !order.emailSent) {
          try {
            await sendOrderEmail(order, getRequestOrigin(req));
          } catch (mailErr) {
            console.warn('[email] Error enviando correo tras promo:', mailErr.message);
          }
        }
        return sendJson(res, 200, { ok: true, order });
      }

      if (sk) {
        if (!body.sessionId) {
          return sendJson(res, 402, {
            error: 'Se requiere completar el pago en Stripe para desbloquear el vídeo.',
          });
        }
        const session = await stripeRequest(
          'GET',
          `/v1/checkout/sessions/${encodeURIComponent(body.sessionId)}`
        );
        if (
          session.payment_status !== 'paid' ||
          (session.client_reference_id && session.client_reference_id !== order.orderId)
        ) {
          return sendJson(res, 402, { error: 'El pago de Stripe aún no figura como completado.' });
        }
        verifiedTier = session.metadata?.tier === 'pack' ? 'pack' : verifiedTier;
        order.stripeSessionId = session.id;
        const stripeEmail = String(
          session.customer_details?.email || session.customer_email || ''
        ).trim();
        if (stripeEmail && !order.parentEmail) {
          order.parentEmail = stripeEmail;
        }
      }

      order.paid = true;
      order.paidAt = new Date().toISOString();
      order.tier = verifiedTier;
      saveOrders();

      if (order.parentEmail && getResendApiKey() && !order.emailSent) {
        try {
          await sendOrderEmail(order, getRequestOrigin(req));
        } catch (mailErr) {
          console.warn('[email] Error enviando correo tras pago:', mailErr.message);
        }
      }

      return sendJson(res, 200, {
        ok: true,
        order,
      });
    }

    if (req.method === 'POST' && pathname === '/api/send-order-email') {
      const body = await readJsonBody(req);
      const order = orders[body.orderId];
      if (!order) {
        return sendJson(res, 404, { error: 'Pedido no encontrado.' });
      }
      if (!order.paid) {
        return sendJson(res, 402, {
          error: 'Desbloquea primero el vídeo completo para recibir el enlace.',
        });
      }
      const email = String(body.email || order.parentEmail || '').trim().slice(0, 160);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return sendJson(res, 400, { error: 'Introduce un correo electrónico válido.' });
      }

      order.parentEmail = email;
      saveOrders();

      const origin = getRequestOrigin(req);
      const shareUrl = `${origin}/?orderId=${encodeURIComponent(order.orderId)}`;
      const downloadUrl = `${origin}/api/download/${encodeURIComponent(order.orderId)}`;

      if (getResendApiKey()) {
        await sendOrderEmail(order, origin);
        return sendJson(res, 200, {
          ok: true,
          mode: 'resend',
          email,
          shareUrl,
          downloadUrl,
          order,
        });
      }

      return sendJson(res, 200, {
        ok: true,
        mode: 'mailto',
        email,
        shareUrl,
        downloadUrl,
        order,
      });
    }

    if (req.method === 'GET' && pathname.startsWith('/api/order/')) {
      const orderId = pathname.replace('/api/order/', '').trim();
      const order = orders[orderId];
      if (!order) {
        return sendJson(res, 404, { error: 'Pedido no encontrado.' });
      }
      return sendJson(res, 200, order);
    }

    if (req.method === 'POST' && pathname === '/api/pregenerate-common-names') {
      const body = await readJsonBody(req).catch(() => ({}));
      const result = await voiceEngine.pregenerateCommonNames(body.limit || 15);
      return sendJson(res, 200, {
        ok: true,
        ...result,
        stats: getStatsPayload(),
      });
    }

    if (req.method === 'POST' && pathname === '/api/tts-config') {
      const body = await readJsonBody(req);
      const ttsConfig = voiceEngine.updateTtsConfig({
        apiKey: body.apiKey,
        voice: body.voice,
        model: body.model,
        stylePrompt: body.stylePrompt,
      });
      let cleared = null;
      if (body.clearCache) {
        cleared = voiceEngine.clearAudioCache();
      }
      return sendJson(res, 200, {
        ok: true,
        ttsConfig,
        cleared,
        stats: getStatsPayload(),
      });
    }

    if (req.method === 'POST' && pathname === '/api/clear-audio-cache') {
      const cleared = voiceEngine.clearAudioCache();
      return sendJson(res, 200, {
        ok: true,
        ...cleared,
        stats: getStatsPayload(),
      });
    }

    if (req.method === 'POST' && pathname === '/api/stripe-config') {
      const body = await readJsonBody(req);
      let updated = false;

      if (typeof body.promoCode === 'string' && body.promoCode.trim()) {
        stripeConfig.promoCode = body.promoCode.trim().toUpperCase().slice(0, 30);
        updated = true;
      }

      if (body.clear === true) {
        stripeConfig.secretKey = '';
        saveStripeConfig();
        return sendJson(res, 200, {
          ok: true,
          promoCode: getPromoCode(),
          stats: getStatsPayload(true),
        });
      }

      if (typeof body.secretKey === 'string' && body.secretKey.trim()) {
        const key = body.secretKey.trim();
        if (!key.startsWith('sk_test_') && !key.startsWith('sk_live_')) {
          return sendJson(res, 400, {
            error: 'La clave secreta de Stripe debe empezar por sk_test_ o sk_live_',
          });
        }
        stripeConfig.secretKey = key;
        updated = true;
      }

      if (typeof body.resendApiKey === 'string' && body.resendApiKey.trim()) {
        const rkey = body.resendApiKey.trim();
        if (!rkey.startsWith('re_')) {
          return sendJson(res, 400, {
            error: 'La API Key de Resend debe empezar por re_',
          });
        }
        stripeConfig.resendApiKey = rkey;
        updated = true;
      }

      if (typeof body.resendFrom === 'string' && body.resendFrom.trim()) {
        stripeConfig.resendFrom = body.resendFrom.trim().slice(0, 140);
        updated = true;
      }

      if (typeof body.supportEmail === 'string' && body.supportEmail.trim()) {
        stripeConfig.supportEmail = body.supportEmail.trim().slice(0, 120);
        updated = true;
      }

      if (!updated) {
        return sendJson(res, 400, {
          error: 'Introduce una clave válida (Stripe, Resend o código de invitación).',
        });
      }

      saveStripeConfig();
      return sendJson(res, 200, {
        ok: true,
        promoCode: getPromoCode(),
        stats: getStatsPayload(true),
      });
    }

    if (req.method === 'GET' && pathname.startsWith('/api/download/')) {
      const orderId = path.basename(pathname.replace('/api/download/', ''));
      const order = orders[orderId];
      if (!order) {
        return sendJson(res, 404, { error: 'Vídeo no encontrado.' });
      }
      if (!order.paid) {
        return sendJson(res, 402, { error: 'Desbloquea el vídeo primero para poder descargarlo.' });
      }
      const videoFile = path.join(GENERATED_DIR, `${orderId}.mp4`);
      const safeName = `Carta-Papa-Noel-${order.nameSlug || 'nino'}.mp4`;
      return serveFileWithRange(req, res, videoFile, safeName);
    }

    if (req.method === 'GET' && pathname.startsWith('/generated/')) {
      const filename = path.basename(pathname);
      if (!/^[a-zA-Z0-9_-]+\.mp4$/.test(filename)) {
        res.writeHead(400);
        return res.end('Nombre inválido');
      }
      if (filename.endsWith('_preview.mp4')) {
        return serveFileWithRange(req, res, path.join(GENERATED_DIR, filename));
      }
      const orderId = filename.replace(/\.mp4$/, '');
      const order = orders[orderId];
      if (!order || !order.paid) {
        const previewFallback = path.join(GENERATED_DIR, `${orderId}_preview.mp4`);
        if (fs.existsSync(previewFallback)) {
          return serveFileWithRange(req, res, previewFallback);
        }
        return sendJson(res, 402, {
          error: 'Desbloquea el vídeo completo por 1,00 € para verlo entero.',
        });
      }
      return serveFileWithRange(req, res, path.join(GENERATED_DIR, filename));
    }

    const PUBLIC_ASSETS = new Set(['santa_base.png', 'santa_base.mp4', 'bgm_christmas.wav', 'wax_seal.png']);
    if (req.method === 'GET' && pathname.startsWith('/assets/')) {
      const assetName = path.basename(pathname);
      if (PUBLIC_ASSETS.has(assetName)) {
        return serveFileWithRange(req, res, path.join(ASSETS_DIR, assetName));
      }
    }

    if (req.method === 'GET' && pathname === '/robots.txt') {
      const origin = getRequestOrigin(req);
      const robots = `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      return res.end(robots);
    }

    if (req.method === 'GET' && pathname === '/sitemap.xml') {
      const origin = getRequestOrigin(req);
      const today = new Date().toISOString().slice(0, 10);
      const urls = [
        `  <url>\n    <loc>${origin}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
      ];
      for (const name of voiceEngine.COMMON_NAMES || []) {
        const slug = voiceEngine.slugifyName(name);
        urls.push(
          `  <url>\n    <loc>${origin}/para/${encodeURIComponent(slug)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
        );
      }
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
      res.writeHead(200, {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      return res.end(xml);
    }

    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      const rawName = parsedUrl.searchParams.get('nombre');
      const html = renderSeoHtml(req, rawName, null);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Content-Length': Buffer.byteLength(html),
      });
      return res.end(html);
    }

    if (req.method === 'GET' && pathname.startsWith('/para/')) {
      const slug = path.basename(pathname.replace(/^\/para\//, ''));
      if (slug && !slug.includes('.')) {
        const html = renderSeoHtml(req, slug, voiceEngine.slugifyName(slug));
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Content-Length': Buffer.byteLength(html),
        });
        return res.end(html);
      }
    }

    // Archivos estáticos de public/
    if (req.method === 'GET') {
      const cleanPath = pathname;
      const resolved = path.normalize(path.join(PUBLIC_DIR, cleanPath));
      if (!resolved.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        return res.end('Acceso denegado');
      }
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        return serveFileWithRange(req, res, resolved);
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  } catch (err) {
    console.error('[server] Error procesando petición:', err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: err.message || 'Error interno del servidor' });
    }
  }
});

server.listen(PORT, () => {
  console.log(`🎅 Carta Mágica a Papá Noel escuchando en http://localhost:${PORT}`);
});
