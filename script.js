/**
 * StressO_Meter — script.js
 * Author: Lovneesh Agrawal · 2026
 *
 * ── FASTAPI CORS NOTE ──────────────────────────────────────────────────────
 * Your FastAPI backend MUST have CORSMiddleware configured, otherwise every
 * fetch() call below is blocked by the browser's Same-Origin Policy.
 *
 *   from fastapi.middleware.cors import CORSMiddleware
 *   app.add_middleware(
 *     CORSMiddleware,
 *     allow_origins=["*"],        // Lock down to your real origin in production
 *     allow_credentials=True,
 *     allow_methods=["*"],
 *     allow_headers=["*"],
 *   )
 *
 * ── SECURITY NOTES ─────────────────────────────────────────────────────────
 * 1. All user input is sanitized (HTML stripped) before display.
 * 2. Result values are rendered via textContent, never innerHTML.
 * 3. Client-side rate limiting prevents rapid-fire submissions.
 * 4. Numeric inputs are validated and clamped before sending.
 * 5. The API_BASE constant is the only place to update if the backend moves.
 * 6. No secrets or tokens are stored client-side.
 * 7. In production: enforce HTTPS and tighten allow_origins in CORS config.
 * ───────────────────────────────────────────────────────────────────────────
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════════════════════ */
const API_BASE = 'http://127.0.0.1:8000';

/** Minimum milliseconds between submissions (rate limiting). */
const RATE_LIMIT_MS = 3000;

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let lastSubmitTime  = 0;
let lastPayload     = null;
let isSubmitting    = false;

/* ═══════════════════════════════════════════════════════════════
   DOM REFERENCES
   ═══════════════════════════════════════════════════════════════ */
const form          = document.getElementById('predict-form');
const submitBtn     = document.getElementById('submit-btn');
const globalError   = document.getElementById('form-error-global');
const formBox       = document.getElementById('form-box');
const resultsBox    = document.getElementById('results-container');
const resContent    = document.getElementById('results-content');
const resError      = document.getElementById('results-error');
const resScore      = document.getElementById('result-score');
const resBand       = document.getElementById('result-score-band');
const resList       = document.getElementById('result-inputs-list');
const resErrorMsg   = document.getElementById('results-error-msg');
const backBtn       = document.getElementById('result-back-btn');
const retryBtn      = document.getElementById('error-retry-btn');
const meterFill     = document.getElementById('meter-fill');
const meterGlow     = document.getElementById('meter-glow');

/* ═══════════════════════════════════════════════════════════════
   CANVAS — AMBIENT PARTICLE ANIMATION
   ═══════════════════════════════════════════════════════════════ */
(function initCanvas() {
  const canvas = document.getElementById('canvas-bg');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');

  let W, H, particles;
  const COUNT = 80;

  /** Particle factory */
  function makeParticle() {
    const hue = Math.random() < 0.5
      ? `hsl(${30 + Math.random() * 20}, ${55 + Math.random() * 20}%, ${50 + Math.random() * 20}%)`   // copper/gold
      : `hsl(${125 + Math.random() * 20}, ${35 + Math.random() * 20}%, ${35 + Math.random() * 20}%)`; // sage green
    return {
      x:     Math.random() * W,
      y:     Math.random() * H,
      r:     0.5 + Math.random() * 2.2,
      vx:    (Math.random() - 0.5) * 0.25,
      vy:    -(0.1 + Math.random() * 0.4),
      alpha: 0.08 + Math.random() * 0.3,
      color: hue,
      drift: (Math.random() - 0.5) * 0.008,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.01 + Math.random() * 0.025,
    };
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    particles = Array.from({ length: COUNT }, makeParticle);
    // Scatter them vertically on resize
    particles.forEach(p => { p.y = Math.random() * H; });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.pulse += p.pulseSpeed;
      const alpha = p.alpha * (0.6 + 0.4 * Math.sin(p.pulse));

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color.replace(')', `, ${alpha})`).replace('hsl', 'hsla');
      ctx.fill();

      p.x  += p.vx + p.drift;
      p.y  += p.vy;

      if (p.y < -p.r * 2) {
        p.y  = H + p.r;
        p.x  = Math.random() * W;
      }
      if (p.x < -p.r) p.x = W + p.r;
      if (p.x > W + p.r) p.x = -p.r;
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();
  draw();
})();

/* ═══════════════════════════════════════════════════════════════
   COUNTER ANIMATION (hero stats)
   ═══════════════════════════════════════════════════════════════ */
function animateCounters() {
  document.querySelectorAll('.stat-val[data-target]').forEach(el => {
    const target   = parseInt(el.dataset.target, 10);
    const duration = 1200;
    const start    = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

/* ═══════════════════════════════════════════════════════════════
   HOW-IT-WORKS SCROLL ANIMATION
   ═══════════════════════════════════════════════════════════════ */
function initScrollObserver() {
  const steps = document.querySelectorAll('.how-step');
  if (!steps.length || !window.IntersectionObserver) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('scroll-visible');
          entry.target.style.setProperty('--delay', `${i * 100}ms`);
        }, i * 100);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  steps.forEach(step => obs.observe(step));
}

/* ═══════════════════════════════════════════════════════════════
   SECURITY: INPUT SANITIZATION
   ═══════════════════════════════════════════════════════════════ */
/**
 * Strips HTML tags and trims whitespace from a string.
 * Used before displaying any user-supplied value in the DOM.
 * @param {string} str
 * @returns {string}
 */
function sanitize(str) {
  if (typeof str !== 'string') return String(str);
  return str.replace(/[<>"'`]/g, c => ({
    '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '`': '&#x60;'
  }[c])).trim();
}

/* ═══════════════════════════════════════════════════════════════
   FIELD ERROR HELPERS
   ═══════════════════════════════════════════════════════════════ */
function setFieldError(groupId, errorId, msg) {
  const grp = document.getElementById(groupId);
  const err = document.getElementById(errorId);
  if (grp) grp.classList.add('has-error');
  if (err) err.textContent = msg;
}

function clearFieldError(groupId, errorId) {
  const grp = document.getElementById(groupId);
  const err = document.getElementById(errorId);
  if (grp) grp.classList.remove('has-error');
  if (err) err.textContent = '';
}

function clearAllErrors() {
  document.querySelectorAll('.fg.has-error').forEach(g => g.classList.remove('has-error'));
  document.querySelectorAll('.fe').forEach(el => { el.textContent = ''; });
  globalError.textContent = '';
}

/* ═══════════════════════════════════════════════════════════════
   FORM VALIDATION
   ═══════════════════════════════════════════════════════════════ */
function validateForm() {
  clearAllErrors();
  let valid = true;

  // Age
  const ageRaw = form.elements['Age'].value.trim();
  const ageVal = parseInt(ageRaw, 10);
  if (!ageRaw || isNaN(ageVal) || ageVal < 10 || ageVal > 100) {
    setFieldError('grp-age', 'err-age', 'Age must be 10–100.');
    valid = false;
  }

  // Gender (radio)
  const genderChecked = form.querySelector('input[name="Gender"]:checked');
  if (!genderChecked) {
    setFieldError('grp-gender', 'err-gender', 'Select a gender.');
    valid = false;
  }

  // Country
  const country = form.elements['Country'].value.trim();
  if (!country || country.length < 2) {
    setFieldError('grp-country', 'err-country', 'Enter your country.');
    valid = false;
  }

  // Academic Level
  if (!form.elements['Academic_Level'].value) {
    setFieldError('grp-academic', 'err-academic', 'Select a level.');
    valid = false;
  }

  // Platform
  if (!form.elements['Most_Used_Platform'].value) {
    setFieldError('grp-platform', 'err-platform', 'Select a platform.');
    valid = false;
  }

  // Purpose
  if (!form.elements['Purpose_Of_Use'].value) {
    setFieldError('grp-purpose', 'err-purpose', 'Select a purpose.');
    valid = false;
  }

  // Avg Daily Usage
  const usageRaw = form.elements['Avg_Daily_Usage_Hours'].value.trim();
  const usageVal = parseFloat(usageRaw);
  if (usageRaw === '' || isNaN(usageVal) || usageVal < 0 || usageVal > 24) {
    setFieldError('grp-usage', 'err-usage', '0–24 hours.');
    valid = false;
  }

  // Daily Unlocks
  const unlocksRaw = form.elements['Daily_Unlocks'].value.trim();
  const unlocksVal = parseInt(unlocksRaw, 10);
  if (unlocksRaw === '' || isNaN(unlocksVal) || unlocksVal < 0) {
    setFieldError('grp-unlocks', 'err-unlocks', 'Enter 0 or more.');
    valid = false;
  }

  // Study Hours
  const studyRaw = form.elements['Study_Hours'].value.trim();
  const studyVal = parseFloat(studyRaw);
  if (studyRaw === '' || isNaN(studyVal) || studyVal < 0 || studyVal > 24) {
    setFieldError('grp-study', 'err-study', '0–24 hours.');
    valid = false;
  }

  // Physical Activity
  const activityRaw = form.elements['Physical_Activity_Hours'].value.trim();
  const activityVal = parseFloat(activityRaw);
  if (activityRaw === '' || isNaN(activityVal) || activityVal < 0 || activityVal > 24) {
    setFieldError('grp-activity', 'err-activity', '0–24 hours.');
    valid = false;
  }

  // Sleep Hours
  const sleepRaw = form.elements['Sleep_Hours_Per_Night'].value.trim();
  const sleepVal = parseFloat(sleepRaw);
  if (sleepRaw === '' || isNaN(sleepVal) || sleepVal < 0 || sleepVal > 24) {
    setFieldError('grp-sleep', 'err-sleep', '0–24 hours.');
    valid = false;
  }

  // Stress Level
  if (!form.elements['Stress_Level'].value) {
    setFieldError('grp-stress', 'err-stress', 'Select a level.');
    valid = false;
  }

  if (!valid) {
    globalError.textContent = 'Please fix the highlighted fields above.';
    // Focus first errored field
    const firstErr = document.querySelector('.fg.has-error .fi, .fg.has-error .fs, .fg.has-error input[type="radio"]');
    if (firstErr) firstErr.focus();
  }

  return valid;
}

/* ═══════════════════════════════════════════════════════════════
   BUILD PAYLOAD (typed, clamped)
   ═══════════════════════════════════════════════════════════════ */
function buildPayload() {
  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

  return {
    Age:                     clamp(parseInt(form.elements['Age'].value, 10), 10, 100),
    Gender:                  form.querySelector('input[name="Gender"]:checked').value,
    Country:                 form.elements['Country'].value.trim().slice(0, 60),
    Academic_Level:          form.elements['Academic_Level'].value,
    Most_Used_Platform:      form.elements['Most_Used_Platform'].value,
    Purpose_Of_Use:          form.elements['Purpose_Of_Use'].value,
    Avg_Daily_Usage_Hours:   clamp(parseFloat(form.elements['Avg_Daily_Usage_Hours'].value), 0, 24),
    Daily_Unlocks:           Math.max(0, parseInt(form.elements['Daily_Unlocks'].value, 10)),
    Study_Hours:             clamp(parseFloat(form.elements['Study_Hours'].value), 0, 24),
    Physical_Activity_Hours: clamp(parseFloat(form.elements['Physical_Activity_Hours'].value), 0, 24),
    Sleep_Hours_Per_Night:   clamp(parseFloat(form.elements['Sleep_Hours_Per_Night'].value), 0, 24),
    Stress_Level:            form.elements['Stress_Level'].value,
  };
}

/* ═══════════════════════════════════════════════════════════════
   API CALLS
   ═══════════════════════════════════════════════════════════════ */
async function postPrediction(payload) {
  const response = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = `Server returned ${response.status} ${response.statusText}.`;
    try {
      const errData = await response.json();
      if (errData.detail) {
        detail = typeof errData.detail === 'string'
          ? errData.detail
          : JSON.stringify(errData.detail);
      }
    } catch (_) { /* ignore JSON parse failure */ }
    throw new Error(detail);
  }

  return response.json();
}

async function fetchResult() {
  const response = await fetch(`${API_BASE}/get`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`GET /get returned ${response.status}.`);
  }

  const data = await response.json();
  if (!data || typeof data !== 'object') {
    throw new Error('Unexpected response format from /get.');
  }
  return data;
}

/* ═══════════════════════════════════════════════════════════════
   LOADING STATE
   ═══════════════════════════════════════════════════════════════ */
function setLoading(loading) {
  isSubmitting = loading;
  submitBtn.disabled = loading;
  submitBtn.classList.toggle('is-loading', loading);
  submitBtn.querySelector('.btn-label').textContent = loading ? 'Processing' : 'Analyze My Profile';
  submitBtn.querySelector('.btn-arrow').style.display = loading ? 'none' : '';
}

/* ═══════════════════════════════════════════════════════════════
   RESULT METER
   ═══════════════════════════════════════════════════════════════ */
const METER_MAP = {
  'low':       { pct: 15,  band: 'band-low',       label: 'Low' },
  'medium':    { pct: 42,  band: 'band-medium',     label: 'Medium' },
  'high':      { pct: 70,  band: 'band-high',       label: 'High' },
  'very high': { pct: 95,  band: 'band-veryhigh',   label: 'Very High' },
};

function animateMeter(levelKey) {
  const cfg = METER_MAP[levelKey] || { pct: 0, band: '', label: levelKey };
  // Trigger layout before animating
  meterFill.style.width = '0%';
  void meterFill.offsetWidth;
  setTimeout(() => {
    meterFill.style.width = `${cfg.pct}%`;
    meterFill.classList.add('is-set');
  }, 100);
  resBand.textContent = cfg.label;
  resBand.className   = `res-band ${cfg.band}`;
}

/* ═══════════════════════════════════════════════════════════════
   RENDER RESULT
   ═══════════════════════════════════════════════════════════════ */
const LABEL_MAP = {
  Age: 'Age', Gender: 'Gender', Country: 'Country',
  Academic_Level: 'Academic', Most_Used_Platform: 'Platform',
  Purpose_Of_Use: 'Purpose', Avg_Daily_Usage_Hours: 'Daily Usage',
  Daily_Unlocks: 'Unlocks', Study_Hours: 'Study hrs',
  Physical_Activity_Hours: 'Exercise hrs', Sleep_Hours_Per_Night: 'Sleep hrs',
  Stress_Level: 'Stress',
};

function renderResult(data, predictedLevel) {
  // Score — from prediction or derived from data.Stress_Level
  const level = predictedLevel || data.Stress_Level || 'Unknown';
  resScore.textContent = level;
  animateMeter(level.toLowerCase());

  // Profile grid — use textContent for XSS safety
  resList.innerHTML = '';
  Object.entries(data).forEach(([key, val], i) => {
    const item = document.createElement('div');
    item.className = 'res-item';
    item.style.setProperty('--delay', `${i * 40}ms`);

    const lbl = document.createElement('div');
    lbl.className = 'res-item-label';
    lbl.textContent = LABEL_MAP[key] || key; // safe — from our own map

    const v = document.createElement('div');
    v.className = 'res-item-val';
    v.textContent = sanitize(String(val)); // safe — sanitized

    item.appendChild(lbl);
    item.appendChild(v);
    resList.appendChild(item);
  });

  // Show panels
  formBox.style.display    = 'none';
  resultsBox.classList.add('is-visible');
  resError.classList.remove('is-active');
  resContent.classList.add('is-active');
  resultsBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ═══════════════════════════════════════════════════════════════
   SHOW API ERROR
   ═══════════════════════════════════════════════════════════════ */
function showApiError(msg) {
  formBox.style.display    = 'none';
  resultsBox.classList.add('is-visible');
  resContent.classList.remove('is-active');
  resErrorMsg.textContent  = msg; // safe — textContent
  resError.classList.add('is-active');
}

/* ═══════════════════════════════════════════════════════════════
   SHOW FORM (from results/error state)
   ═══════════════════════════════════════════════════════════════ */
function showForm() {
  formBox.style.display = '';
  resultsBox.classList.remove('is-visible');
  resContent.classList.remove('is-active');
  resError.classList.remove('is-active');
  meterFill.style.width = '0%';
  meterFill.classList.remove('is-set');
  form.querySelector('[name="Age"]').focus();
}

/* ═══════════════════════════════════════════════════════════════
   REAL-TIME FIELD VALIDATION (on blur)
   ═══════════════════════════════════════════════════════════════ */
function attachBlurValidation() {
  const fields = {
    'Age':                     () => { const v = parseInt(form.elements['Age'].value, 10); return v >= 10 && v <= 100 ? '' : 'Age must be 10–100.'; },
    'Country':                 () => form.elements['Country'].value.trim().length >= 2 ? '' : 'Enter your country.',
    'Academic_Level':          () => form.elements['Academic_Level'].value ? '' : 'Select a level.',
    'Most_Used_Platform':      () => form.elements['Most_Used_Platform'].value ? '' : 'Select a platform.',
    'Purpose_Of_Use':          () => form.elements['Purpose_Of_Use'].value ? '' : 'Select a purpose.',
    'Avg_Daily_Usage_Hours':   () => { const v = parseFloat(form.elements['Avg_Daily_Usage_Hours'].value); return v >= 0 && v <= 24 ? '' : '0–24 hours.'; },
    'Daily_Unlocks':           () => { const v = parseInt(form.elements['Daily_Unlocks'].value, 10); return v >= 0 ? '' : 'Enter 0 or more.'; },
    'Study_Hours':             () => { const v = parseFloat(form.elements['Study_Hours'].value); return v >= 0 && v <= 24 ? '' : '0–24 hours.'; },
    'Physical_Activity_Hours': () => { const v = parseFloat(form.elements['Physical_Activity_Hours'].value); return v >= 0 && v <= 24 ? '' : '0–24 hours.'; },
    'Sleep_Hours_Per_Night':   () => { const v = parseFloat(form.elements['Sleep_Hours_Per_Night'].value); return v >= 0 && v <= 24 ? '' : '0–24 hours.'; },
    'Stress_Level':            () => form.elements['Stress_Level'].value ? '' : 'Select a level.',
  };

  const GROUP_MAP = {
    'Age': 'grp-age', 'Country': 'grp-country', 'Academic_Level': 'grp-academic',
    'Most_Used_Platform': 'grp-platform', 'Purpose_Of_Use': 'grp-purpose',
    'Avg_Daily_Usage_Hours': 'grp-usage', 'Daily_Unlocks': 'grp-unlocks',
    'Study_Hours': 'grp-study', 'Physical_Activity_Hours': 'grp-activity',
    'Sleep_Hours_Per_Night': 'grp-sleep', 'Stress_Level': 'grp-stress',
  };
  const ERR_MAP = {
    'Age': 'err-age', 'Country': 'err-country', 'Academic_Level': 'err-academic',
    'Most_Used_Platform': 'err-platform', 'Purpose_Of_Use': 'err-purpose',
    'Avg_Daily_Usage_Hours': 'err-usage', 'Daily_Unlocks': 'err-unlocks',
    'Study_Hours': 'err-study', 'Physical_Activity_Hours': 'err-activity',
    'Sleep_Hours_Per_Night': 'err-sleep', 'Stress_Level': 'err-stress',
  };

  form.addEventListener('blur', (e) => {
    const name = e.target.name;
    if (!name || !(name in fields)) return;
    const msg = fields[name]();
    if (msg) {
      setFieldError(GROUP_MAP[name], ERR_MAP[name], msg);
    } else {
      clearFieldError(GROUP_MAP[name], ERR_MAP[name]);
    }
  }, true);

  // Gender radios
  form.querySelectorAll('input[name="Gender"]').forEach(radio => {
    radio.addEventListener('change', () => clearFieldError('grp-gender', 'err-gender'));
  });
}

/* ═══════════════════════════════════════════════════════════════
   SUBMIT HANDLER
   ═══════════════════════════════════════════════════════════════ */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (isSubmitting) return;

  // Client-side rate limiting
  const now = Date.now();
  if (now - lastSubmitTime < RATE_LIMIT_MS) {
    globalError.textContent = `Please wait ${Math.ceil((RATE_LIMIT_MS - (now - lastSubmitTime)) / 1000)}s before trying again.`;
    return;
  }

  if (!validateForm()) return;

  const payload = buildPayload();
  lastPayload   = payload;
  lastSubmitTime = Date.now();

  setLoading(true);
  globalError.textContent = '';

  try {
    // POST prediction
    await postPrediction(payload);

    // GET result (or fall back to payload)
    let resultData = payload;
    let prediction = null;
    try {
      const getResponse = await fetchResult();
      resultData = getResponse;
      prediction = getResponse.prediction || getResponse.Stress_Level || null;
    } catch (_) {
      // /get failed; use the submitted payload for display
    }

    renderResult(resultData, prediction);
  } catch (err) {
    let userMsg = 'Unable to reach the server. Make sure the FastAPI backend is running at ' + API_BASE + '.';
    if (err.message && !err.message.includes('fetch')) {
      userMsg = err.message;
    }
    showApiError(userMsg);
  } finally {
    setLoading(false);
  }
});

/* ═══════════════════════════════════════════════════════════════
   BACK / RETRY BUTTONS
   ═══════════════════════════════════════════════════════════════ */
backBtn.addEventListener('click', showForm);
retryBtn.addEventListener('click', () => {
  showForm();
  if (lastPayload) {
    // Re-populate form with last payload for convenience
    const f = form.elements;
    if (f['Age'])                     f['Age'].value = lastPayload.Age;
    if (f['Country'])                 f['Country'].value = lastPayload.Country;
    if (f['Academic_Level'])          f['Academic_Level'].value = lastPayload.Academic_Level;
    if (f['Most_Used_Platform'])      f['Most_Used_Platform'].value = lastPayload.Most_Used_Platform;
    if (f['Purpose_Of_Use'])          f['Purpose_Of_Use'].value = lastPayload.Purpose_Of_Use;
    if (f['Avg_Daily_Usage_Hours'])   f['Avg_Daily_Usage_Hours'].value = lastPayload.Avg_Daily_Usage_Hours;
    if (f['Daily_Unlocks'])           f['Daily_Unlocks'].value = lastPayload.Daily_Unlocks;
    if (f['Study_Hours'])             f['Study_Hours'].value = lastPayload.Study_Hours;
    if (f['Physical_Activity_Hours']) f['Physical_Activity_Hours'].value = lastPayload.Physical_Activity_Hours;
    if (f['Sleep_Hours_Per_Night'])   f['Sleep_Hours_Per_Night'].value = lastPayload.Sleep_Hours_Per_Night;
    if (f['Stress_Level'])            f['Stress_Level'].value = lastPayload.Stress_Level;
    const genderRadio = form.querySelector(`input[name="Gender"][value="${lastPayload.Gender}"]`);
    if (genderRadio) genderRadio.checked = true;
  }
});

/* ═══════════════════════════════════════════════════════════════
   KEYBOARD: ESC to go back from results
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && resultsBox.classList.contains('is-visible')) {
    showForm();
  }
});

/* ═══════════════════════════════════════════════════════════════
   SUBMIT BUTTON RIPPLE
   ═══════════════════════════════════════════════════════════════ */
submitBtn.addEventListener('click', (e) => {
  const ripple = submitBtn.querySelector('.btn-ripple');
  if (!ripple) return;
  ripple.style.transition = 'none';
  ripple.style.transform  = 'scale(0)';
  ripple.style.opacity    = '0.6';
  void ripple.offsetWidth;
  ripple.style.transition = 'transform 0.6s ease-out, opacity 0.6s ease-out';
  ripple.style.transform  = 'scale(2.5)';
  ripple.style.opacity    = '0';
});

/* ═══════════════════════════════════════════════════════════════
   SMOOTH NAVIGATION LINKS
   ═══════════════════════════════════════════════════════════════ */
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  animateCounters();
  initScrollObserver();
  attachBlurValidation();
  // Ensure results hidden on start
  resultsBox.classList.remove('is-visible');
  resContent.classList.remove('is-active');
  resError.classList.remove('is-active');
});
