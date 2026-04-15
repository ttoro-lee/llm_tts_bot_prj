// ── State ────────────────────────────────────────────────────────────────────
const history = [];
let isPlaying = false;
let audioCtx   = null;
let analyser   = null;

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadModels();
  await loadConfig();
  // 레이아웃 계산 완료 후 canvas 크기 확정 및 루프 시작
  requestAnimationFrame(() => {
    resizeCanvas();
    startVisualizerLoop();
  });

  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('save-config').addEventListener('click', saveConfig);
  document.getElementById('refresh-models').addEventListener('click', loadModels);
});

// ── Config ───────────────────────────────────────────────────────────────────
async function loadModels() {
  try {
    const res  = await fetch('/api/models');
    const data = await res.json();
    const select = document.getElementById('model-select');
    const current = select.value;
    select.innerHTML = data.models
      .map(m => `<option value="${m}">${m}</option>`)
      .join('');
    if (current) select.value = current;
  } catch {
    showToast('모델 목록을 불러오지 못했습니다');
  }
}

async function loadConfig() {
  const res    = await fetch('/api/config');
  const config = await res.json();
  document.getElementById('system-prompt').value = config.system_prompt;
  const select = document.getElementById('model-select');
  if (config.model) {
    // 목록에 없으면 옵션 추가
    if (![...select.options].some(o => o.value === config.model)) {
      select.insertAdjacentHTML('beforeend',
        `<option value="${config.model}">${config.model}</option>`);
    }
    select.value = config.model;
  }
}

async function saveConfig() {
  const model        = document.getElementById('model-select').value;
  const systemPrompt = document.getElementById('system-prompt').value;
  await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, system_prompt: systemPrompt }),
  });
  showToast('설정이 적용되었습니다');
}

// ── Chat ─────────────────────────────────────────────────────────────────────
async function sendMessage() {
  const input   = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  addMessage('user', message);

  input.disabled   = true;
  sendBtn.disabled = true;
  setStatus('생각 중...');

  const loadingId = addLoading();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: history.slice(-20) }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail ?? '알 수 없는 오류');
    }

    const data = await res.json();
    removeLoading(loadingId);
    addMessage('assistant', data.response);

    history.push({ role: 'user',      content: message       });
    history.push({ role: 'assistant', content: data.response });

    setStatus('재생 중...');
    await playAudio(data.audio);
    setStatus('대기 중');
  } catch (e) {
    removeLoading(loadingId);
    addMessage('error', `오류: ${e.message}`);
    setStatus('대기 중');
  } finally {
    input.disabled   = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

function addMessage(role, content) {
  const wrap = document.getElementById('chat-messages');
  const div  = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = `<div class="bubble">${escapeHtml(content)}</div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function addLoading() {
  const wrap = document.getElementById('chat-messages');
  const div  = document.createElement('div');
  const id   = 'loading-' + Date.now();
  div.id        = id;
  div.className = 'message assistant';
  div.innerHTML = `<div class="bubble"><span class="dots">
    <span>.</span><span>.</span><span>.</span></span></div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  return id;
}

function removeLoading(id) {
  document.getElementById(id)?.remove();
}

function escapeHtml(t) {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function setStatus(text) {
  document.getElementById('status-label').textContent = text;
}

// ── Audio ─────────────────────────────────────────────────────────────────────
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize         = 128;
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

// ── Visualizer ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('visualizer');
const ctx    = canvas.getContext('2d');

function resizeCanvas() {
  const rect   = canvas.parentElement.getBoundingClientRect();
  canvas.width  = rect.width;
  canvas.height = rect.height;
}

// ResizeObserver로 컨테이너 크기 변화를 정확히 감지
const ro = new ResizeObserver(() => resizeCanvas());
ro.observe(canvas.parentElement);

function startVisualizerLoop() {
  function frame(ts) {
    requestAnimationFrame(frame);
    drawVisualizer(ts);
  }
  requestAnimationFrame(frame);
}

function drawVisualizer(ts) {
  const w  = canvas.width;
  const h  = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const baseR = Math.min(w, h) * 0.22;

  // Background fade (trail effect)
  ctx.fillStyle = 'rgba(9, 9, 16, 0.25)';
  ctx.fillRect(0, 0, w, h);

  const BAR_COUNT = 64;
  const data      = new Uint8Array(BAR_COUNT);

  if (analyser && isPlaying) {
    analyser.getByteFrequencyData(data);
  } else {
    // Idle: gentle breathing wave
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

  // Frequency bars
  ctx.lineCap = 'round';
  for (let i = 0; i < BAR_COUNT; i++) {
    const value  = data[i] / 255;
    const barLen = value * baseR * 0.85 + (isPlaying ? 3 : 2);
    const angle  = i * angleStep - Math.PI / 2;

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

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
