(() => {
  const PREVIEW_HOOK_SECONDS = 4.6;

  const state = {
    achievement: 'cole',
    behavior: 'super_bien',
    gender: 'm',
    genderTouchedManually: false,
    selectedTier: 'pack',
    currentOrder: null,
    musicDesired: false,
  };

  const isAdmin = new URLSearchParams(window.location.search).get('admin') === '1';

  // DOM refs
  const countdownPill = document.getElementById('countdownPill');
  const musicToggleBtn = document.getElementById('musicToggleBtn');
  const bgMusic = document.getElementById('bgMusic');
  const costMetricsBox = document.getElementById('costMetricsBox');
  const fullscreenVideoBtn = document.getElementById('fullscreenVideoBtn');
  const steps = {
    compose: document.getElementById('stepCompose'),
    sending: document.getElementById('stepSending'),
    preview: document.getElementById('stepPreviewPaywall'),
    unlocked: document.getElementById('stepUnlocked'),
  };

  const letterForm = document.getElementById('letterForm');
  const childNameInput = document.getElementById('childName');
  const ageInput = document.getElementById('age');
  const letterTextInput = document.getElementById('letterText');
  const parentEmailInput = document.getElementById('parentEmail');
  const formError = document.getElementById('formError');
  const submitBtn = document.getElementById('submitBtn');

  const envelopeWrapper = document.getElementById('envelopeWrapper');
  const flyingChildName = document.getElementById('flyingChildName');
  const sendingStatusTitle = document.getElementById('sendingStatusTitle');
  const sendingStatusDesc = document.getElementById('sendingStatusDesc');
  const radarFill = document.getElementById('radarFill');
  const rStep1 = document.getElementById('rStep1');
  const rStep2 = document.getElementById('rStep2');
  const rStep3 = document.getElementById('rStep3');

  const previewVideo = document.getElementById('previewVideo');
  const previewTitle = document.getElementById('previewTitle');
  const hudName = document.getElementById('hudName');
  const previewProgress = document.getElementById('previewProgress');
  const paywallOverlay = document.getElementById('paywallOverlay');
  const paywallChildName = document.getElementById('paywallChildName');
  const paywallDuration = document.getElementById('paywallDuration');
  const unlockBtn = document.getElementById('unlockBtn');
  const unlockPriceText = document.getElementById('unlockPriceText');
  const replayHookBtn = document.getElementById('replayHookBtn');
  const togglePromoBtn = document.getElementById('togglePromoBtn');
  const promoBox = document.getElementById('promoBox');
  const promoCodeInput = document.getElementById('promoCodeInput');
  const applyPromoBtn = document.getElementById('applyPromoBtn');
  const promoError = document.getElementById('promoError');
  const playPreviewBtn = document.getElementById('playPreviewBtn');
  const backToFormBtn1 = document.getElementById('backToFormBtn1');

  const fullVideo = document.getElementById('fullVideo');
  const unlockedTitle = document.getElementById('unlockedTitle');
  const downloadVideoBtn = document.getElementById('downloadVideoBtn');
  const whatsappShareBtn = document.getElementById('whatsappShareBtn');
  const printDiplomaBtn = document.getElementById('printDiplomaBtn');
  const newLetterBtn = document.getElementById('newLetterBtn');
  const unlockedEmailInput = document.getElementById('unlockedEmailInput');
  const sendOrderEmailBtn = document.getElementById('sendOrderEmailBtn');
  const unlockedEmailStatus = document.getElementById('unlockedEmailStatus');

  const metricCost = document.getElementById('metricCost');
  const metricCache = document.getElementById('metricCache');
  const metricRenderTime = document.getElementById('metricRenderTime');
  const metricProvider = document.getElementById('metricProvider');

  // Creator modal
  const openCreatorBtn = document.getElementById('openCreatorBtn');
  const closeCreatorBtn = document.getElementById('closeCreatorBtn');
  const creatorModal = document.getElementById('creatorModal');
  const statNamesCount = document.getElementById('statNamesCount');
  const statSegmentsCount = document.getElementById('statSegmentsCount');
  const statOrdersCount = document.getElementById('statOrdersCount');
  const statIntegrations = document.getElementById('statIntegrations');
  const pregenerateBtn = document.getElementById('pregenerateBtn');
  const pregenerateStatus = document.getElementById('pregenerateStatus');
  const cachedNamesList = document.getElementById('cachedNamesList');
  const copyPromptBtn = document.getElementById('copyPromptBtn');
  const klingPromptBox = document.getElementById('klingPromptBox');
  const ttsModelSelect = document.getElementById('ttsModelSelect');
  const ttsVoiceSelect = document.getElementById('ttsVoiceSelect');
  const ttsStylePrompt = document.getElementById('ttsStylePrompt');
  const ttsApiKeyInput = document.getElementById('ttsApiKeyInput');
  const saveTtsConfigBtn = document.getElementById('saveTtsConfigBtn');
  const ttsConfigStatus = document.getElementById('ttsConfigStatus');
  const stripeSecretKeyInput = document.getElementById('stripeSecretKeyInput');
  const promoCodeAdminInput = document.getElementById('promoCodeAdminInput');
  const saveStripeConfigBtn = document.getElementById('saveStripeConfigBtn');
  const savePromoCodeBtn = document.getElementById('savePromoCodeBtn');
  const clearStripeConfigBtn = document.getElementById('clearStripeConfigBtn');
  const stripeConfigStatus = document.getElementById('stripeConfigStatus');
  const resendApiKeyInput = document.getElementById('resendApiKeyInput');
  const resendFromInput = document.getElementById('resendFromInput');
  const saveResendConfigBtn = document.getElementById('saveResendConfigBtn');
  const resendConfigStatus = document.getElementById('resendConfigStatus');
  const gmailWebhookInput = document.getElementById('gmailWebhookInput');
  const gmailAppPassInput = document.getElementById('gmailAppPassInput');
  const saveGmailConfigBtn = document.getElementById('saveGmailConfigBtn');
  const gmailConfigStatus = document.getElementById('gmailConfigStatus');
  const copyGasCodeBtn = document.getElementById('copyGasCodeBtn');
  const gasScriptBox = document.getElementById('gasScriptBox');

  // Legal modal
  const legalModal = document.getElementById('legalModal');
  const closeLegalBtn = document.getElementById('closeLegalBtn');
  const legalSupportEmailLink = document.getElementById('legalSupportEmailLink');
  const legalPanels = {
    privacidad: document.getElementById('legalPanelPrivacidad'),
    condiciones: document.getElementById('legalPanelCondiciones'),
    contacto: document.getElementById('legalPanelContacto'),
  };

  // Diploma modal
  const diplomaModal = document.getElementById('diplomaModal');
  const closeDiplomaBtn = document.getElementById('closeDiplomaBtn');
  const diplomaName = document.getElementById('diplomaName');
  const diplomaReason = document.getElementById('diplomaReason');
  const diplomaDate = document.getElementById('diplomaDate');
  const printNowBtn = document.getElementById('printNowBtn');

  function showStep(stepKey) {
    Object.entries(steps).forEach(([k, el]) => {
      el.classList.toggle('active', k === stepKey);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function initCountdown() {
    if (!countdownPill) return;
    const now = new Date();
    let targetYear = now.getFullYear();
    let xmasEve = new Date(targetYear, 11, 24, 23, 59, 59);
    if (now > xmasEve) {
      targetYear += 1;
      xmasEve = new Date(targetYear, 11, 24, 23, 59, 59);
    }
    const diffDays = Math.max(0, Math.ceil((xmasEve - now) / (1000 * 60 * 60 * 24)));
    const dayLabel = diffDays === 0 ? '¡Hoy es Nochebuena!' : `Faltan ${diffDays} días para Nochebuena`;
    countdownPill.textContent = `🎄 ${dayLabel} • ❄️ -14°C en Laponia`;
  }

  function pauseBgMusicForVideo() {
    if (bgMusic && !bgMusic.paused) {
      bgMusic.pause();
    }
  }

  function updateMusicButtonUi(playing) {
    if (!musicToggleBtn) return;
    musicToggleBtn.classList.toggle('playing', playing);
    musicToggleBtn.setAttribute('aria-pressed', String(playing));
    musicToggleBtn.textContent = playing ? '🔊 Música: ON' : '🔇 Música Navideña';
  }

  if (musicToggleBtn && bgMusic) {
    bgMusic.volume = 0.18;
    musicToggleBtn.addEventListener('click', () => {
      if (bgMusic.paused) {
        state.musicDesired = true;
        bgMusic.play().then(() => updateMusicButtonUi(true)).catch(() => {});
      } else {
        state.musicDesired = false;
        bgMusic.pause();
        updateMusicButtonUi(false);
      }
    });
  }

  if (isAdmin) {
    openCreatorBtn?.classList.remove('hidden');
    costMetricsBox?.classList.remove('hidden');
  }

  // Nieve suave en canvas
  function initSnow() {
    const canvas = document.getElementById('snowCanvas');
    const ctx = canvas.getContext('2d');
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const flakes = Array.from({ length: 75 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 1.2 + Math.random() * 2.8,
      vy: 0.5 + Math.random() * 1.1,
      vx: -0.35 + Math.random() * 0.7,
      a: 0.25 + Math.random() * 0.65,
    }));

    window.addEventListener('resize', () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    });

    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (const f of flakes) {
        f.y += f.vy;
        f.x += f.vx;
        if (f.y > h + 6) {
          f.y = -6;
          f.x = Math.random() * w;
        }
        if (f.x > w + 6) f.x = -6;
        if (f.x < -6) f.x = w + 6;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 250, 240, ${f.a})`;
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    frame();
  }

  const achHermanosSub = document.getElementById('achHermanosSub');
  const achValienteSub = document.getElementById('achValienteSub');
  const behSuperBienSub = document.getElementById('behSuperBienSub');
  const behTraviesoTitle = document.getElementById('behTraviesoTitle');

  const FEMALE_NAME_HINTS = new Set([
    'lucia', 'sofia', 'martina', 'valeria', 'paula', 'julia', 'emma', 'daniela',
    'carla', 'alba', 'noa', 'chloe', 'olivia', 'claudia', 'carmen', 'maria',
    'vega', 'alma', 'mia', 'vera', 'sara', 'elena', 'ines', 'aitana', 'lola',
    'valentina', 'jimena', 'abril', 'triana', 'nora', 'julieta', 'rocio', 'candela',
    'laia', 'clara', 'adriana', 'blanca', 'marina', 'natalia', 'irene', 'alicia',
    'ainhoa', 'leire', 'nahia', 'leyre', 'elisa', 'celia', 'helena', 'ariadna',
    'raquel', 'beatriz', 'isabel', 'ana', 'alejandra', 'angela', 'patricia', 'marta',
    'nuria', 'miriam', 'belen', 'ruth', 'esther', 'zoe', 'naia', 'cayetana',
  ]);
  const MALE_ENDING_A_HINTS = new Set(['luca', 'borja', 'bautista', 'joshua', 'ezra', 'nikita']);

  function inferGenderClient(rawName) {
    const first = String(rawName || '').trim().split(/\s+/)[0] || '';
    const norm = first
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    if (!norm) return null;
    if (MALE_ENDING_A_HINTS.has(norm)) return 'm';
    if (FEMALE_NAME_HINTS.has(norm) || norm.endsWith('a')) return 'f';
    return 'm';
  }

  function setGender(g, manual = false) {
    state.gender = g === 'f' ? 'f' : 'm';
    if (manual) state.genderTouchedManually = true;
    document.querySelectorAll('.gen-btn').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.gender === state.gender);
    });
    const isFem = state.gender === 'f';
    if (achHermanosSub) achHermanosSub.textContent = isFem ? 'Buena hermana / hija' : 'Buen hermano / hijo';
    if (achValienteSub) achValienteSub.textContent = isFem ? 'Un año genial y muy buena' : 'Un año genial y muy bueno';
    if (behSuperBienSub) behSuperBienSub.textContent = isFem ? 'Casi un angelito todo el año' : 'Casi un angelito todo el año';
    if (behTraviesoTitle) {
      behTraviesoTitle.textContent = isFem ? 'Algo terremoto (¡soy sincera!)' : 'Algo terremoto (¡soy sincero!)';
    }
  }

  document.querySelectorAll('.gen-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setGender(btn.dataset.gender, true);
    });
  });

  childNameInput?.addEventListener('input', () => {
    if (state.genderTouchedManually) return;
    const guessed = inferGenderClient(childNameInput.value);
    if (guessed) setGender(guessed, false);
  });

  // Selector de logros
  document.querySelectorAll('.ach-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ach-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.achievement = btn.dataset.value;
    });
  });

  // Selector de comportamiento ("¿Cómo te has portado?")
  document.querySelectorAll('.beh-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.beh-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.behavior = btn.dataset.behavior;
    });
  });

  // Plantillas rápidas
  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      letterTextInput.value = chip.dataset.template;
    });
  });

  // Selector de tarifa en Paywall
  document.querySelectorAll('.tier-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.tier-option').forEach((o) => o.classList.remove('selected'));
      opt.classList.add('selected');
      opt.querySelector('input').checked = true;
      state.selectedTier = opt.dataset.tier;
      unlockPriceText.textContent = state.selectedTier === 'pack' ? '1,99 €' : '1,00 €';
    });
  });

  function resetEnvelopeAnimation(childName) {
    flyingChildName.textContent = childName;
    envelopeWrapper.classList.remove('takeoff');
    // Reiniciar animaciones CSS clonando o forzando reflow
    envelopeWrapper.style.animation = 'none';
    void envelopeWrapper.offsetWidth;
    envelopeWrapper.style.animation = '';
    radarFill.style.width = '20%';
    rStep1.classList.add('active');
    rStep2.classList.remove('active');
    rStep3.classList.remove('active');
    sendingStatusTitle.textContent = 'Sellando tu carta con polvo de estrellas...';
    sendingStatusDesc.textContent = 'Preparando el sobre mágico para viajar a Rovaniemi, Laponia';
  }

  function runFlightTimeline() {
    setTimeout(() => {
      radarFill.style.width = '55%';
      rStep2.classList.add('active');
      sendingStatusTitle.textContent = '¡Tu carta está volando hacia el Polo Norte!';
      sendingStatusDesc.textContent = 'Los renos acaban de cruzar el cielo ártico rumbo al taller...';
    }, 1100);

    setTimeout(() => {
      radarFill.style.width = '88%';
      rStep3.classList.add('active');
      envelopeWrapper.classList.add('takeoff');
      sendingStatusTitle.textContent = 'Papá Noel está grabando su respuesta...';
      sendingStatusDesc.textContent = 'Mezclando su voz con la música de la cabaña mágica';
    }, 2200);
  }

  function revealPaywall() {
    if (state.currentOrder?.paid) return;
    previewVideo.pause();
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
    if (typeof previewVideo.webkitExitFullscreen === 'function') {
      try {
        previewVideo.webkitExitFullscreen();
      } catch {
        // ignore if not active
      }
    }
    paywallOverlay.classList.remove('hidden');
  }

  function enterPreviewStep(order) {
    state.currentOrder = order;
    previewTitle.textContent = `Papá Noel ha respondido a ${order.childName}`;
    hudName.textContent = order.childName;
    paywallChildName.textContent = order.childName;
    paywallDuration.textContent = Math.round(order.durationSec || 16);
    paywallOverlay.classList.add('hidden');
    promoBox?.classList.add('hidden');
    promoError?.classList.add('hidden');
    if (promoCodeInput) promoCodeInput.value = '';
    previewProgress.style.width = '0%';

    if (previewVideo.disablePictureInPicture !== undefined) {
      previewVideo.disablePictureInPicture = true;
    }
    previewVideo.src = `${order.previewUrl || order.videoUrl}?t=${Date.now()}`;
    previewVideo.currentTime = 0;
    showStep('preview');

    pauseBgMusicForVideo();
    previewVideo.play().catch(() => {
      // Si el navegador bloquea autoplay con sonido, el usuario pulsa "Reproducir saludo"
    });
  }

  function enterUnlockedStep(order) {
    state.currentOrder = order;
    previewVideo.pause();
    pauseBgMusicForVideo();
    unlockedTitle.textContent = `Mensaje completo de Papá Noel para ${order.childName}`;
    fullVideo.src = `${order.videoUrl}?unlocked=${Date.now()}`;
    downloadVideoBtn.href = order.downloadUrl || `/api/download/${order.orderId}`;

    const orderLink = `${window.location.origin}/?orderId=${encodeURIComponent(order.orderId)}`;
    const shareText = encodeURIComponent(
      `¡Mira el vídeo personalizado que Papá Noel le ha enviado a ${order.childName} desde el Polo Norte!`
    );
    whatsappShareBtn.href = `https://wa.me/?text=${shareText}%20${encodeURIComponent(orderLink)}`;

    if (unlockedEmailInput) {
      unlockedEmailInput.value = order.parentEmail || '';
    }
    if (unlockedEmailStatus) {
      if (order.emailSent && order.emailSentTo) {
        unlockedEmailStatus.textContent = `✅ Enlace enviado automáticamente a ${order.emailSentTo}`;
        unlockedEmailStatus.classList.remove('hidden', 'is-error');
      } else {
        unlockedEmailStatus.textContent = '';
        unlockedEmailStatus.classList.add('hidden');
        unlockedEmailStatus.classList.remove('is-error');
      }
    }

    metricCost.textContent = `${Number(order.estimatedCostEur || 0).toFixed(2).replace('.', ',')} €`;
    metricCache.textContent = order.nameCacheHit
      ? '✅ Reutilizado de caché (0 llamadas IA)'
      : '🆕 Generado y guardado para futuros usos';
    metricRenderTime.textContent = `${order.renderTimeMs || '--'} ms`;
    metricProvider.textContent = order.providerUsed || 'Local';

    diplomaName.textContent = order.childName;
    const behText = order.behaviorLabel ? ` (${order.behaviorLabel})` : '';
    const listLabel = order.gender === 'f' ? 'Lista de Niñas Buenas' : 'Lista de Niños Buenos';
    diplomaReason.textContent = `ha destacado este año por su "${order.achievementLabel}"${behText} y figura oficialmente en la ${listLabel} de esta Navidad.`;
    diplomaDate.textContent = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    showStep('unlocked');
    fullVideo.play().catch(() => {});
  }

  // Control del límite de 4.6s en el vídeo preview y bloqueo de PiP/fullscreen sin pagar
  previewVideo.addEventListener('timeupdate', () => {
    const pct = Math.min(100, (previewVideo.currentTime / PREVIEW_HOOK_SECONDS) * 100);
    previewProgress.style.width = `${pct}%`;

    if (previewVideo.currentTime >= PREVIEW_HOOK_SECONDS - 0.15 && !state.currentOrder?.paid) {
      revealPaywall();
    }
  });

  previewVideo.addEventListener('ended', () => {
    previewProgress.style.width = '100%';
    revealPaywall();
  });

  previewVideo.addEventListener('enterpictureinpicture', revealPaywall);
  previewVideo.addEventListener('webkitbeginfullscreen', revealPaywall);

  replayHookBtn.addEventListener('click', () => {
    paywallOverlay.classList.add('hidden');
    previewVideo.currentTime = 0;
    previewVideo.play();
  });

  playPreviewBtn.addEventListener('click', () => {
    paywallOverlay.classList.add('hidden');
    if (previewVideo.currentTime >= PREVIEW_HOOK_SECONDS) {
      previewVideo.currentTime = 0;
    }
    previewVideo.play();
  });

  // Envío del formulario
  letterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.classList.add('hidden');

    const childName = childNameInput.value.trim();
    if (!childName) {
      formError.textContent = 'Por favor, escribe el nombre del niño o niña.';
      formError.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    resetEnvelopeAnimation(childName);
    showStep('sending');
    runFlightTimeline();

    const minAnimDelay = new Promise((r) => setTimeout(r, 3200));

    try {
      const apiPromise = fetch('/api/send-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childName,
          age: ageInput.value.trim(),
          gender: state.gender,
          achievement: state.achievement,
          behavior: state.behavior,
          letterText: letterTextInput.value.trim(),
          parentEmail: parentEmailInput.value.trim(),
        }),
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error generando el vídeo mágico');
        return data;
      });

      const [order] = await Promise.all([apiPromise, minAnimDelay]);
      radarFill.style.width = '100%';
      setTimeout(() => enterPreviewStep(order), 350);
    } catch (err) {
      showStep('compose');
      formError.textContent = err.message;
      formError.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Desbloqueo / Pago
  unlockBtn.addEventListener('click', async () => {
    if (!state.currentOrder) return;
    unlockBtn.disabled = true;
    const origText = unlockBtn.innerHTML;
    unlockBtn.textContent = 'Procesando magia de desbloqueo...';

    try {
      const checkoutRes = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: state.currentOrder.orderId,
          tier: state.selectedTier,
        }),
      }).then((r) => r.json());

      if (checkoutRes.error) {
        throw new Error(checkoutRes.error);
      }
      if (checkoutRes.mode === 'stripe' && checkoutRes.checkoutUrl) {
        window.location.href = checkoutRes.checkoutUrl;
        return;
      }

      // Modo demo local: desbloquear directamente tras confirmar
      const unlockData = await fetch('/api/unlock-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: state.currentOrder.orderId,
          tier: state.selectedTier,
        }),
      }).then((r) => r.json());

      if (!unlockData.ok) {
        throw new Error(unlockData.error || 'No se pudo desbloquear el vídeo');
      }

      enterUnlockedStep(unlockData.order);
    } catch (err) {
      alert(err.message);
    } finally {
      unlockBtn.disabled = false;
      unlockBtn.innerHTML = origText;
    }
  });

  if (togglePromoBtn && promoBox) {
    togglePromoBtn.addEventListener('click', () => {
      promoBox.classList.toggle('hidden');
      promoError?.classList.add('hidden');
      if (!promoBox.classList.contains('hidden')) {
        promoCodeInput?.focus();
      }
    });
  }

  async function redeemPromoCode() {
    if (!state.currentOrder || !promoCodeInput || !applyPromoBtn) return;
    const promoCode = promoCodeInput.value.trim();
    if (!promoCode) {
      if (promoError) {
        promoError.textContent = 'Escribe un código de invitación.';
        promoError.classList.remove('hidden');
      }
      return;
    }

    applyPromoBtn.disabled = true;
    promoError?.classList.add('hidden');
    const origLabel = applyPromoBtn.textContent;
    applyPromoBtn.textContent = 'Canjeando...';

    try {
      const unlockData = await fetch('/api/unlock-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: state.currentOrder.orderId,
          tier: 'pack',
          promoCode,
        }),
      }).then((r) => r.json());

      if (!unlockData.ok) {
        throw new Error(unlockData.error || 'Código de invitación no válido');
      }
      enterUnlockedStep(unlockData.order);
    } catch (err) {
      if (promoError) {
        promoError.textContent = err.message;
        promoError.classList.remove('hidden');
      }
    } finally {
      applyPromoBtn.disabled = false;
      applyPromoBtn.textContent = origLabel;
    }
  }

  applyPromoBtn?.addEventListener('click', redeemPromoCode);
  promoCodeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      redeemPromoCode();
    }
  });

  function goBackToCompose() {
    previewVideo.pause();
    fullVideo.pause();
    if (state.musicDesired && bgMusic) {
      bgMusic.play().catch(() => {});
    }
    showStep('compose');
  }

  if (fullscreenVideoBtn && fullVideo) {
    fullscreenVideoBtn.addEventListener('click', () => {
      if (fullVideo.requestFullscreen) {
        fullVideo.requestFullscreen().catch(() => {});
      } else if (fullVideo.webkitEnterFullscreen) {
        fullVideo.webkitEnterFullscreen();
      }
      fullVideo.play().catch(() => {});
    });
  }

  previewVideo.addEventListener('play', pauseBgMusicForVideo);
  fullVideo.addEventListener('play', pauseBgMusicForVideo);

  backToFormBtn1.addEventListener('click', goBackToCompose);
  newLetterBtn.addEventListener('click', goBackToCompose);

  // Panel del creador
  async function loadCreatorStats() {
    try {
      const data = await fetch(isAdmin ? '/api/stats?admin=1' : '/api/stats').then((r) => r.json());
      statNamesCount.textContent = data.cachedNamesCount ?? 0;
      statSegmentsCount.textContent = data.cachedSegmentsCount ?? 0;
      statOrdersCount.textContent = data.totalOrders ?? 0;

      const flags = [];
      if (data.geminiTtsConfigured) {
        flags.push(`Gemini 3.8 (${data.ttsConfig?.voice || 'Charon'}) ✅`);
      } else if (data.elevenLabsConfigured) {
        flags.push('ElevenLabs ✅');
      } else {
        flags.push('Voz Gratis 0€');
      }
      if (data.stripeMode === 'live') {
        flags.push('Stripe LIVE ✅');
      } else if (data.stripeMode === 'test') {
        flags.push('Stripe TEST 🧪');
      } else {
        flags.push(data.stripeConfigured ? 'Stripe ✅' : 'Pago Demo');
      }
      if (data.gmailConfigured) {
        flags.push('Gmail ✅');
      } else if (data.resendConfigured) {
        flags.push('Email Resend ✅');
      }
      statIntegrations.textContent = flags.join(' • ');

      if (gmailWebhookInput) {
        gmailWebhookInput.placeholder = data.gmailWebhookMasked
          ? `Actual: ${data.gmailWebhookMasked} (pegar nueva URL para cambiar)`
          : 'https://script.google.com/macros/s/.../exec';
      }
      if (resendApiKeyInput) {
        resendApiKeyInput.placeholder = data.resendKeyMasked
          ? `Actual: ${data.resendKeyMasked} (pegar nueva clave para cambiar)`
          : 're_...';
      }
      if (resendFromInput && data.resendFrom && !resendFromInput.value) {
        resendFromInput.value = data.resendFrom;
      }
      if (legalSupportEmailLink && data.supportEmail) {
        legalSupportEmailLink.href = `mailto:${data.supportEmail}`;
        legalSupportEmailLink.textContent = data.supportEmail;
      }

      if (stripeSecretKeyInput) {
        stripeSecretKeyInput.placeholder = data.stripeKeyMasked
          ? `Actual: ${data.stripeKeyMasked} (pegar nueva clave para cambiar)`
          : 'sk_test_... o sk_live_...';
      }
      if (promoCodeAdminInput && data.promoCode) {
        promoCodeAdminInput.value = data.promoCode;
      }

      if (data.ttsConfig) {
        if (ttsModelSelect) ttsModelSelect.value = data.ttsConfig.model || 'gemini-3.8-flash-tts';
        if (ttsVoiceSelect) ttsVoiceSelect.value = data.ttsConfig.voice || 'Charon';
        if (ttsStylePrompt && !ttsStylePrompt.value) {
          ttsStylePrompt.value = data.ttsConfig.stylePrompt || '';
        }
        if (ttsApiKeyInput && data.ttsConfig.apiKeyMasked) {
          ttsApiKeyInput.placeholder = `Actual: ${data.ttsConfig.apiKeyMasked} (dejar vacío para mantener)`;
        }
      }

      cachedNamesList.innerHTML = '';
      if (Array.isArray(data.cachedNames) && data.cachedNames.length > 0) {
        data.cachedNames.forEach((slug) => {
          const span = document.createElement('span');
          span.className = 'name-tag';
          span.textContent = slug;
          cachedNamesList.appendChild(span);
        });
      } else {
        cachedNamesList.innerHTML = '<small style="color:#9db4c8;">Todavía no hay nombres cacheados. Envía una carta o pulsa pre-generar.</small>';
      }
    } catch (err) {
      console.error(err);
    }
  }

  openCreatorBtn.addEventListener('click', () => {
    creatorModal.classList.remove('hidden');
    loadCreatorStats();
  });

  closeCreatorBtn.addEventListener('click', () => {
    creatorModal.classList.add('hidden');
  });

  pregenerateBtn.addEventListener('click', async () => {
    pregenerateBtn.disabled = true;
    pregenerateStatus.textContent = 'Generando clips de nombres...';
    try {
      const res = await fetch('/api/pregenerate-common-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 15 }),
      }).then((r) => r.json());

      pregenerateStatus.textContent = `✅ Listo: ${res.created} nuevos, ${res.alreadyCached} ya estaban en caché.`;
      await loadCreatorStats();
    } catch (err) {
      pregenerateStatus.textContent = `❌ Error: ${err.message}`;
    } finally {
      pregenerateBtn.disabled = false;
    }
  });

  if (saveTtsConfigBtn) {
    saveTtsConfigBtn.addEventListener('click', async () => {
      saveTtsConfigBtn.disabled = true;
      ttsConfigStatus.textContent = 'Guardando configuración y vaciando caché...';
      try {
        const res = await fetch('/api/tts-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ttsModelSelect.value,
            voice: ttsVoiceSelect.value,
            stylePrompt: ttsStylePrompt.value,
            apiKey: ttsApiKeyInput.value.trim() || undefined,
            clearCache: true,
          }),
        }).then((r) => r.json());
        if (!res.ok) throw new Error(res.error || 'Error guardando configuración');
        ttsApiKeyInput.value = '';
        ttsConfigStatus.textContent = `✅ Guardado (${res.ttsConfig.model} • ${res.ttsConfig.voice}). Caché limpiada (${res.cleared?.deleted || 0} clips).`;
        await loadCreatorStats();
      } catch (err) {
        ttsConfigStatus.textContent = `❌ Error: ${err.message}`;
      } finally {
        saveTtsConfigBtn.disabled = false;
      }
    });
  }

  async function updateStripeConfig(payload, statusMessagePending) {
    if (saveStripeConfigBtn) saveStripeConfigBtn.disabled = true;
    if (clearStripeConfigBtn) clearStripeConfigBtn.disabled = true;
    if (stripeConfigStatus) stripeConfigStatus.textContent = statusMessagePending;
    try {
      const res = await fetch('/api/stripe-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error || 'Error guardando clave de Stripe');
      if (stripeSecretKeyInput) stripeSecretKeyInput.value = '';
      const mode = res.stats?.stripeMode || 'demo';
      if (stripeConfigStatus) {
        stripeConfigStatus.textContent =
          mode === 'live'
            ? '✅ Stripe LIVE activado'
            : mode === 'test'
              ? '🧪 Stripe TEST activado'
              : '🟡 Modo demo local activado';
      }
      await loadCreatorStats();
    } catch (err) {
      if (stripeConfigStatus) stripeConfigStatus.textContent = `❌ ${err.message}`;
    } finally {
      if (saveStripeConfigBtn) saveStripeConfigBtn.disabled = false;
      if (clearStripeConfigBtn) clearStripeConfigBtn.disabled = false;
    }
  }

  if (saveStripeConfigBtn) {
    saveStripeConfigBtn.addEventListener('click', () => {
      const secretKey = (stripeSecretKeyInput?.value || '').trim();
      if (!secretKey) {
        if (stripeConfigStatus) stripeConfigStatus.textContent = '❌ Pega una clave sk_test_... o sk_live_...';
        return;
      }
      updateStripeConfig({ secretKey }, 'Guardando clave Stripe...');
    });
  }

  if (savePromoCodeBtn) {
    savePromoCodeBtn.addEventListener('click', async () => {
      const promoCode = (promoCodeAdminInput?.value || '').trim();
      if (!promoCode) {
        if (stripeConfigStatus) stripeConfigStatus.textContent = '❌ Escribe un código válido';
        return;
      }
      savePromoCodeBtn.disabled = true;
      if (stripeConfigStatus) stripeConfigStatus.textContent = 'Guardando código gratis...';
      try {
        const res = await fetch('/api/stripe-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promoCode }),
        }).then((r) => r.json());
        if (!res.ok) throw new Error(res.error || 'Error guardando código');
        if (stripeConfigStatus) stripeConfigStatus.textContent = `🎟️ Código gratis activo: ${res.promoCode}`;
        await loadCreatorStats();
      } catch (err) {
        if (stripeConfigStatus) stripeConfigStatus.textContent = `❌ ${err.message}`;
      } finally {
        savePromoCodeBtn.disabled = false;
      }
    });
  }

  if (clearStripeConfigBtn) {
    clearStripeConfigBtn.addEventListener('click', () => {
      updateStripeConfig({ clear: true }, 'Volviendo a modo demo...');
    });
  }

  copyGasCodeBtn?.addEventListener('click', () => {
    if (!gasScriptBox) return;
    navigator.clipboard?.writeText(gasScriptBox.textContent).then(() => {
      copyGasCodeBtn.textContent = '✅ ¡Script copiado!';
      setTimeout(() => {
        copyGasCodeBtn.textContent = '📋 Copiar script Gmail';
      }, 2000);
    });
  });

  if (saveGmailConfigBtn) {
    saveGmailConfigBtn.addEventListener('click', async () => {
      const gmailWebhookUrl = (gmailWebhookInput?.value || '').trim();
      const gmailAppPassword = (gmailAppPassInput?.value || '').trim();
      if (!gmailWebhookUrl && !gmailAppPassword) {
        if (gmailConfigStatus) gmailConfigStatus.textContent = '❌ Pega la URL de Google Script o tu contraseña';
        return;
      }
      saveGmailConfigBtn.disabled = true;
      if (gmailConfigStatus) gmailConfigStatus.textContent = 'Guardando puente Gmail...';
      try {
        const res = await fetch('/api/stripe-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(gmailWebhookUrl ? { gmailWebhookUrl } : {}),
            ...(gmailAppPassword ? { gmailAppPassword } : {}),
          }),
        }).then((r) => r.json());
        if (!res.ok) throw new Error(res.error || 'Error guardando Gmail');
        if (gmailWebhookInput) gmailWebhookInput.value = '';
        if (gmailAppPassInput) gmailAppPassInput.value = '';
        if (gmailConfigStatus) gmailConfigStatus.textContent = '✅ Envío desde Gmail activado';
        await loadCreatorStats();
      } catch (err) {
        if (gmailConfigStatus) gmailConfigStatus.textContent = `❌ ${err.message}`;
      } finally {
        saveGmailConfigBtn.disabled = false;
      }
    });
  }

  if (saveResendConfigBtn) {
    saveResendConfigBtn.addEventListener('click', async () => {
      const resendApiKey = (resendApiKeyInput?.value || '').trim();
      const resendFrom = (resendFromInput?.value || '').trim();
      if (!resendApiKey && !resendFrom) {
        if (resendConfigStatus) resendConfigStatus.textContent = '❌ Pega tu RESEND_API_KEY (re_...) o remitente';
        return;
      }
      saveResendConfigBtn.disabled = true;
      if (resendConfigStatus) resendConfigStatus.textContent = 'Guardando configuración de correo...';
      try {
        const res = await fetch('/api/stripe-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(resendApiKey ? { resendApiKey } : {}),
            ...(resendFrom ? { resendFrom } : {}),
          }),
        }).then((r) => r.json());
        if (!res.ok) throw new Error(res.error || 'Error guardando Resend');
        if (resendApiKeyInput) resendApiKeyInput.value = '';
        if (resendConfigStatus) resendConfigStatus.textContent = '✅ Resend configurado correctamente';
        await loadCreatorStats();
      } catch (err) {
        if (resendConfigStatus) resendConfigStatus.textContent = `❌ ${err.message}`;
      } finally {
        saveResendConfigBtn.disabled = false;
      }
    });
  }

  // Envío manual / reenvío del enlace al correo en vídeo desbloqueado
  async function handleSendOrderEmail() {
    if (!state.currentOrder || !unlockedEmailInput || !sendOrderEmailBtn || !unlockedEmailStatus) return;
    const email = unlockedEmailInput.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      unlockedEmailStatus.textContent = '❌ Escribe un correo electrónico válido.';
      unlockedEmailStatus.classList.remove('hidden');
      unlockedEmailStatus.classList.add('is-error');
      unlockedEmailInput.focus();
      return;
    }

    sendOrderEmailBtn.disabled = true;
    const origLabel = sendOrderEmailBtn.textContent;
    sendOrderEmailBtn.textContent = 'Enviando...';
    unlockedEmailStatus.classList.add('hidden');
    unlockedEmailStatus.classList.remove('is-error');

    try {
      const res = await fetch('/api/send-order-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: state.currentOrder.orderId,
          email,
        }),
      }).then((r) => r.json());

      if (!res.ok) throw new Error(res.error || 'No se pudo enviar el correo.');
      state.currentOrder = res.order || state.currentOrder;

      if (res.mode === 'resend' || res.mode === 'gmail') {
        unlockedEmailStatus.textContent = `✅ ¡Enviado! Revisa tu correo (${res.email}) o la carpeta de spam.`;
      } else {
        await navigator.clipboard?.writeText(res.shareUrl).catch(() => {});
        unlockedEmailStatus.textContent = `✅ Correo guardado y enlace copiado: ${res.shareUrl}`;
        const mailSubject = encodeURIComponent(
          `🎅 Vídeo de Papá Noel para ${state.currentOrder.childName}`
        );
        const mailBody = encodeURIComponent(
          `Aquí tienes el enlace para ver y descargar el vídeo completo de Papá Noel para ${state.currentOrder.childName}:\n\n${res.shareUrl}\n\nDescarga directa MP4:\n${res.downloadUrl}`
        );
        window.location.href = `mailto:${encodeURIComponent(email)}?subject=${mailSubject}&body=${mailBody}`;
      }
      unlockedEmailStatus.classList.remove('hidden');
    } catch (err) {
      unlockedEmailStatus.textContent = `❌ ${err.message}`;
      unlockedEmailStatus.classList.remove('hidden');
      unlockedEmailStatus.classList.add('is-error');
    } finally {
      sendOrderEmailBtn.disabled = false;
      sendOrderEmailBtn.textContent = origLabel;
    }
  }

  sendOrderEmailBtn?.addEventListener('click', handleSendOrderEmail);
  unlockedEmailInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendOrderEmail();
    }
  });

  // Modal Legal (Privacidad, Condiciones y Contacto)
  function switchLegalTab(tabKey) {
    const key = legalPanels[tabKey] ? tabKey : 'privacidad';
    document.querySelectorAll('.legal-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.legalPanel === key);
    });
    Object.entries(legalPanels).forEach(([k, panel]) => {
      if (panel) panel.classList.toggle('hidden', k !== key);
    });
  }

  function openLegalModal(tabKey = 'privacidad') {
    if (!legalModal) return;
    switchLegalTab(tabKey);
    legalModal.classList.remove('hidden');
  }

  document.querySelectorAll('[data-legal-tab]').forEach((btn) => {
    btn.addEventListener('click', () => openLegalModal(btn.dataset.legalTab));
  });
  document.querySelectorAll('.legal-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchLegalTab(btn.dataset.legalPanel));
  });
  closeLegalBtn?.addEventListener('click', () => legalModal?.classList.add('hidden'));
  legalModal?.addEventListener('click', (e) => {
    if (e.target === legalModal) legalModal.classList.add('hidden');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && legalModal && !legalModal.classList.contains('hidden')) {
      legalModal.classList.add('hidden');
    }
  });

  copyPromptBtn.addEventListener('click', () => {
    navigator.clipboard?.writeText(klingPromptBox.textContent).then(() => {
      copyPromptBtn.textContent = '✅ ¡Prompt copiado!';
      setTimeout(() => {
        copyPromptBtn.textContent = '📋 Copiar prompt exacto';
      }, 2000);
    });
  });

  // Modal Diploma
  printDiplomaBtn.addEventListener('click', () => {
    diplomaModal.classList.remove('hidden');
  });
  closeDiplomaBtn.addEventListener('click', () => {
    diplomaModal.classList.add('hidden');
  });
  printNowBtn.addEventListener('click', () => {
    window.print();
  });

  // Retorno desde Stripe Checkout si llega ?orderId=...&session_id=...
  async function checkStripeReturn() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('orderId');
    const sessionId = params.get('session_id');
    if (!orderId) return;

    try {
      if (sessionId) {
        const res = await fetch('/api/unlock-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, sessionId }),
        }).then((r) => r.json());
        if (res.ok && res.order) {
          enterUnlockedStep(res.order);
          return;
        }
      }
      const order = await fetch(`/api/order/${encodeURIComponent(orderId)}`).then((r) => r.json());
      if (order && order.orderId) {
        if (order.paid) {
          enterUnlockedStep(order);
        } else {
          enterPreviewStep(order);
        }
      }
    } catch (err) {
      console.error('Error recuperando pedido:', err);
    }
  }

  const initialGuessedGender = inferGenderClient(childNameInput?.value || '');
  if (initialGuessedGender) {
    setGender(initialGuessedGender, false);
  }
  initCountdown();
  initSnow();
  checkStripeReturn();
})();
