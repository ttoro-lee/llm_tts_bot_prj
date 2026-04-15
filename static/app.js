const { createApp, ref, onMounted, nextTick } = Vue;

createApp({
  setup() {
    // ── State ────────────────────────────────────────────────────────────────
    const history      = [];
    const messages     = ref([]);
    const chatInput    = ref('');
    const inputDisabled = ref(false);
    const status       = ref('대기 중');
    const models       = ref([]);
    const selectedModel = ref('');
    const systemPrompt = ref('');
    const toastMsg     = ref('');
    const toastVisible = ref(false);
    const showSettings = ref(false);

    const canvasEl   = ref(null);
    const messagesEl = ref(null);
    const inputEl    = ref(null);

    let audioCtx   = null;
    let analyser   = null;
    let isPlaying  = false;
    let toastTimer = null;
    let msgIdSeq   = 0;

    // ── Config ────────────────────────────────────────────────────────────────
    async function loadModels() {
      try {
        const res  = await fetch('/api/models');
        const data = await res.json();
        models.value = data.models;
        if (!selectedModel.value && data.models.length > 0) {
          selectedModel.value = data.models[0];
        }
      } catch {
        showToast('모델 목록을 불러오지 못했습니다');
      }
    }

    async function loadConfig() {
      const res    = await fetch('/api/config');
      const config = await res.json();
      systemPrompt.value = config.system_prompt;
      if (config.model) {
        if (!models.value.includes(config.model)) {
          models.value.push(config.model);
        }
        selectedModel.value = config.model;
      }
    }

    async function saveConfig() {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel.value, system_prompt: systemPrompt.value }),
      });
      showToast('설정이 적용되었습니다');
    }

    // ── Chat ──────────────────────────────────────────────────────────────────
    async function sendMessage() {
      const message = chatInput.value.trim();
      if (!message) return;

      chatInput.value = '';
      addMsg('user', message);

      inputDisabled.value = true;
      status.value = '생각 중...';

      const loadingId = addLoadingMsg();

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, history: history.slice(-20), model: selectedModel.value }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail ?? '알 수 없는 오류');
        }

        const data = await res.json();
        removeMsg(loadingId);
        addMsg('assistant', data.response);

        history.push({ role: 'user',      content: message       });
        history.push({ role: 'assistant', content: data.response });

        status.value = '재생 중...';
        await playAudio(data.audio);
        status.value = '대기 중';
      } catch (e) {
        removeMsg(loadingId);
        addMsg('error', `오류: ${e.message}`);
        status.value = '대기 중';
      } finally {
        inputDisabled.value = false;
        nextTick(() => inputEl.value?.focus());
      }
    }

    function escapeHtml(t) {
      return t
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }

    function addMsg(role, content) {
      const id   = ++msgIdSeq;
      const html = escapeHtml(content);
      messages.value.push({ id, role, html });
      nextTick(() => {
        if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
      });
      return id;
    }

    function addLoadingMsg() {
      const id   = ++msgIdSeq;
      const html = `<span class="dots"><span>.</span><span>.</span><span>.</span></span>`;
      messages.value.push({ id, role: 'loading', html });
      nextTick(() => {
        if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
      });
      return id;
    }

    function removeMsg(id) {
      const idx = messages.value.findIndex(m => m.id === id);
      if (idx !== -1) messages.value.splice(idx, 1);
    }

    // ── Toast ─────────────────────────────────────────────────────────────────
    function showToast(msg) {
      toastMsg.value     = msg;
      toastVisible.value = true;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastVisible.value = false; }, 2200);
    }

    // ── Audio ─────────────────────────────────────────────────────────────────
    function initAudio() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize              = 128;
        analyser.smoothingTimeConstant = 0.8;
        analyser.connect(audioCtx.destination);
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    async function playAudio(b64) {
      initAudio();
      const binary = atob(b64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const buffer = await audioCtx.decodeAudioData(bytes.buffer);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(analyser);
      source.start(0);
      isPlaying = true;

      return new Promise(resolve => {
        source.onended = () => { isPlaying = false; resolve(); };
      });
    }

    // ── Visualizer ────────────────────────────────────────────────────────────
    function resizeCanvas() {
      const canvas = canvasEl.value;
      if (!canvas) return;
      const rect    = canvas.parentElement.getBoundingClientRect();
      canvas.width  = rect.width;
      canvas.height = rect.height;
    }

    function drawVisualizer(ts) {
      const canvas = canvasEl.value;
      if (!canvas) return;
      const ctx  = canvas.getContext('2d');
      const w    = canvas.width;
      const h    = canvas.height;
      const cx   = w / 2;
      const cy   = h / 2;
      const baseR = Math.min(w, h) * 0.22;

      // Background fade (trail effect)
      ctx.fillStyle = 'rgba(9, 9, 16, 0.25)';
      ctx.fillRect(0, 0, w, h);

      const BAR_COUNT = 64;
      const data      = new Uint8Array(BAR_COUNT);

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(data);
      } else {
        const t = ts / 1800;
        for (let i = 0; i < BAR_COUNT; i++) {
          data[i] = (Math.sin(t + i * 0.25) * 0.5 + 0.5) * 28 + 8;
        }
      }

      const angleStep = (Math.PI * 2) / BAR_COUNT;

      // Outer glow ring
      if (isPlaying) {
        const avgVal = data.reduce((s, v) => s + v, 0) / data.length / 255;
        const glowR  = baseR + avgVal * 40;
        const grad   = ctx.createRadialGradient(cx, cy, baseR * 0.8, cx, cy, glowR * 1.8);
        grad.addColorStop(0, `rgba(100, 100, 255, ${0.08 + avgVal * 0.12})`);
        grad.addColorStop(1, 'rgba(100, 100, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, glowR * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Frequency bars (mirrored for symmetry)
      ctx.lineCap = 'round';
      const half = BAR_COUNT / 2;
      for (let i = 0; i < BAR_COUNT; i++) {
        const freqIndex = i <= half ? i : BAR_COUNT - i;
        const value     = data[freqIndex] / 255;
        const barLen    = value * baseR * 0.85 + (isPlaying ? 3 : 2);
        const angle     = i * angleStep - Math.PI / 2;

        const x1 = cx + Math.cos(angle) * baseR;
        const y1 = cy + Math.sin(angle) * baseR;
        const x2 = cx + Math.cos(angle) * (baseR + barLen);
        const y2 = cy + Math.sin(angle) * (baseR + barLen);

        const hue   = isPlaying ? 220 + value * 80 : 250;
        const alpha = isPlaying ? 0.4 + value * 0.6 : 0.15 + value * 0.35;

        ctx.strokeStyle = `hsla(${hue}, 75%, 65%, ${alpha})`;
        ctx.lineWidth   = isPlaying ? 2 : 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Center circle
      ctx.beginPath();
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
      ctx.strokeStyle = isPlaying
        ? 'rgba(140, 140, 255, 0.5)'
        : 'rgba(80, 80, 180, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner fill
      ctx.beginPath();
      ctx.arc(cx, cy, baseR - 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(9, 9, 16, 0.85)';
      ctx.fill();

      // Center pulsing dot when playing
      if (isPlaying) {
        const avgVal = data.reduce((s, v) => s + v, 0) / data.length / 255;
        const dotR   = baseR * 0.12 + avgVal * baseR * 0.1;
        ctx.beginPath();
        ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(160, 160, 255, ${0.4 + avgVal * 0.5})`;
        ctx.fill();
      }
    }

    function startVisualizerLoop() {
      function frame(ts) {
        requestAnimationFrame(frame);
        drawVisualizer(ts);
      }
      requestAnimationFrame(frame);
    }

    // ── Mount ─────────────────────────────────────────────────────────────────
    onMounted(async () => {
      await loadModels();
      await loadConfig();

      requestAnimationFrame(() => {
        resizeCanvas();
        startVisualizerLoop();
      });

      const ro = new ResizeObserver(() => resizeCanvas());
      ro.observe(canvasEl.value.parentElement);
    });

    return {
      messages, chatInput, inputDisabled, status,
      models, selectedModel, systemPrompt,
      toastMsg, toastVisible, showSettings,
      canvasEl, messagesEl, inputEl,
      loadModels, saveConfig, sendMessage,
    };
  },
}).mount('#app');
