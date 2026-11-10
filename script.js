/**
 * StressO_Meter — script.js
 * Author: Lovneesh Agrawal · 2026
 *
 * ── FASTAPI CORS NOTE ──────────────────────────────────────────────────────
 * Your FastAPI backend at https://mansik-santulan-project.onrender.com MUST
 * have CORSMiddleware enabled, otherwise fetch() calls are blocked by the
 * browser's Same-Origin Policy.
 *
 *   from fastapi.middleware.cors import CORSMiddleware
 *   app.add_middleware(
 *     CORSMiddleware,
 *     allow_origins=["*"],        // Tighten to your front-end domain in production
 *     allow_credentials=True,
 *     allow_methods=["*"],
 *     allow_headers=["*"],
 *   )
 *
 * ── SECURITY NOTES ─────────────────────────────────────────────────────────
 * 1. All user input is sanitized before display — values set via textContent,
 *    never innerHTML, preventing XSS injection.
 * 2. Client-side rate limiting: 3-second cooldown between submissions.
 * 3. Numeric values are type-cast and range-clamped before sending to the API.
 * 4. Errors are shown as human-readable messages; raw stack traces never exposed.
 * 5. No secrets, tokens, or credentials are stored client-side.
 * 6. In production: enforce HTTPS, tighten CORS allow_origins, add CSP headers.
 * ───────────────────────────────────────────────────────────────────────────
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   CONFIGURATION  — single source of truth for the backend URL
   ═══════════════════════════════════════════════════════════════ */
const API_BASE = 'https://mansik-santulan-project.onrender.com';

/** Minimum milliseconds between submissions (client-side rate limiting). */
const RATE_LIMIT_MS = 3000;

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let lastSubmitTime = 0;
let lastPayload    = null;
let isSubmitting   = false;

/* ═══════════════════════════════════════════════════════════════
   DOM REFERENCES
   ═══════════════════════════════════════════════════════════════ */
const form        = document.getElementById('predict-form');
const submitBtn   = document.getElementById('submit-btn');
const globalError = document.getElementById('form-error-global');
const formBox     = document.getElementById('form-box');
const resultsBox  = document.getElementById('results-container');
const resContent  = document.getElementById('results-content');
const resError    = document.getElementById('results-error');
const resScore    = document.getElementById('result-score');
const resBand     = document.getElementById('result-score-band');
const resList     = document.getElementById('result-inputs-list');
const resErrorMsg = document.getElementById('results-error-msg');
const backBtn     = document.getElementById('result-back-btn');
const retryBtn    = document.getElementById('error-retry-btn');
const meterFill   = document.getElementById('meter-fill');

/* ═══════════════════════════════════════════════════════════════
   CANVAS — AMBIENT GOLD/AMBER PARTICLE ANIMATION
   ═══════════════════════════════════════════════════════════════ */
(function initCanvas() {
  const canvas = document.getElementById('canvas-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, particles;
  const COUNT = 75;

  function makeParticle() {
    // Warm gold, amber, copper tones only
    const palettes = [
      `hsl(${32 + Math.random() * 18}, ${55 + Math.random() * 25}%, ${45 + Math.random() * 25}%)`,  // amber/gold
      `hsl(${20 + Math.random() * 15}, ${50 + Math.random() * 20}%, ${35 + Math.random() * 20}%)`,  // copper/brown
      `hsl(${40 + Math.random() * 15}, ${60 + Math.random() * 20}%, ${55 + Math.random() * 20}%)`,  // warm gold
    ];
    return {
      x:          Math.random() * W,
      y:          Math.random() * H,
      r:          0.5 + Math.random() * 2.0,
      vx:         (Math.random() - 0.5) * 0.2,
      vy:         -(0.08 + Math.random() * 0.35),
      alpha:      0.07 + Math.random() * 0.28,
      color:      palettes[Math.floor(Math.random() * palettes.length)],
      drift:      (Math.random() - 0.5) * 0.006,
      pulse:      Math.random() * Math.PI * 2,
      pulseSpeed: 0.008 + Math.random() * 0.02,
    };
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    particles = Array.from({ length: COUNT }, makeParticle);
    particles.forEach(p => { p.y = Math.random() * H; });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.pulse += p.pulseSpeed;
      const alpha = p.alpha * (0.5 + 0.5 * Math.sin(p.pulse));

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      // Convert hsl() → hsla() by injecting alpha
      ctx.fillStyle = p.color.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`);
      ctx.fill();

      p.x += p.vx + p.drift;
      p.y += p.vy;

      if (p.y < -p.r * 2)   { p.y = H + p.r; p.x = Math.random() * W; }
      if (p.x < -p.r)        p.x = W + p.r;
      if (p.x > W + p.r)     p.x = -p.r;
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
  steps.forEach(s => obs.observe(s));
}

/* ═══════════════════════════════════════════════════════════════
   SECURITY: INPUT SANITIZATION
   Strips dangerous characters before inserting any user value into the DOM.
   ═══════════════════════════════════════════════════════════════ */
function sanitize(str) {
  if (typeof str !== 'string') return String(str);
  return str.replace(/[<>"'`&]/g, c => ({
    '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;',
    '`': '&#x60;', '&': '&amp;',
  }[c])).trim();
}

/* ═══════════════════════════════════════════════════════════════
   FIELD ERROR HELPERS
   ═══════════════════════════════════════════════════════════════ */
function setFieldError(groupId, errorId, msg) {
  document.getElementById(groupId)?.classList.add('has-error');
  const el = document.getElementById(errorId);
  if (el) el.textContent = msg;
}

function clearFieldError(groupId, errorId) {
  document.getElementById(groupId)?.classList.remove('has-error');
  const el = document.getElementById(errorId);
  if (el) el.textContent = '';
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
  const ageVal = parseInt(form.elements['Age'].value.trim(), 10);
  if (!form.elements['Age'].value.trim() || isNaN(ageVal) || ageVal < 10 || ageVal > 100) {
    setFieldError('grp-age', 'err-age', 'Age must be 10–100.'); valid = false;
  }

  // Gender
  if (!form.querySelector('input[name="Gender"]:checked')) {
    setFieldError('grp-gender', 'err-gender', 'Select a gender.'); valid = false;
  }

  // Country
  if (form.elements['Country'].value.trim().length < 2) {
    setFieldError('grp-country', 'err-country', 'Enter your country.'); valid = false;
  }

  // Academic Level
  if (!form.elements['Academic_Level'].value) {
    setFieldError('grp-academic', 'err-academic', 'Select a level.'); valid = false;
  }

  // Platform
  if (!form.elements['Most_Used_Platform'].value) {
    setFieldError('grp-platform', 'err-platform', 'Select a platform.'); valid = false;
  }

  // Purpose
  if (!form.elements['Purpose_Of_Use'].value) {
    setFieldError('grp-purpose', 'err-purpose', 'Select a purpose.'); valid = false;
  }

  // Daily Usage
  const usageVal = parseFloat(form.elements['Avg_Daily_Usage_Hours'].value);
  if (form.elements['Avg_Daily_Usage_Hours'].value.trim() === '' || isNaN(usageVal) || usageVal < 0 || usageVal > 24) {
    setFieldError('grp-usage', 'err-usage', '0–24 hours.'); valid = false;
  }

  // Daily Unlocks
  const unlocksVal = parseInt(form.elements['Daily_Unlocks'].value.trim(), 10);
  if (form.elements['Daily_Unlocks'].value.trim() === '' || isNaN(unlocksVal) || unlocksVal < 0) {
    setFieldError('grp-unlocks', 'err-unlocks', 'Enter 0 or more.'); valid = false;
  }

  // Study Hours
  const studyVal = parseFloat(form.elements['Study_Hours'].value);
  if (form.elements['Study_Hours'].value.trim() === '' || isNaN(studyVal) || studyVal < 0 || studyVal > 24) {
    setFieldError('grp-study', 'err-study', '0–24 hours.'); valid = false;
  }

  // Physical Activity
  const actVal = parseFloat(form.elements['Physical_Activity_Hours'].value);
  if (form.elements['Physical_Activity_Hours'].value.trim() === '' || isNaN(actVal) || actVal < 0 || actVal > 24) {
    setFieldError('grp-activity', 'err-activity', '0–24 hours.'); valid = false;
  }

  // Sleep Hours
  const sleepVal = parseFloat(form.elements['Sleep_Hours_Per_Night'].value);
  if (form.elements['Sleep_Hours_Per_Night'].value.trim() === '' || isNaN(sleepVal) || sleepVal < 0 || sleepVal > 24) {
    setFieldError('grp-sleep', 'err-sleep', '0–24 hours.'); valid = false;
  }

  // Stress Level
  if (!form.elements['Stress_Level'].value) {
    setFieldError('grp-stress', 'err-stress', 'Select a level.'); valid = false;
  }

  if (!valid) {
    globalError.textContent = 'Please fix the highlighted fields above.';
    const firstErr = document.querySelector('.fg.has-error .fi, .fg.has-error .fs, .fg.has-error input[type="radio"]');
    if (firstErr) firstErr.focus();
  }

  return valid;
}

/* ═══════════════════════════════════════════════════════════════
   BUILD PAYLOAD — typed, sanitized, range-clamped
   ═══════════════════════════════════════════════════════════════ */
function buildPayload() {
  const clamp = (v, mn, mx) => Math.min(Math.max(v, mn), mx);
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
  const res = await fetch(`${API_BASE}/predict`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = `Server error ${res.status}: ${res.statusText}.`;
    try {
      const err = await res.json();
      if (err.detail) detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

async function fetchResult() {
  const res = await fetch(`${API_BASE}/get`, {
    method:  'GET',
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`GET /get returned ${res.status}.`);
  const data = await res.json();
  if (!data || typeof data !== 'object') throw new Error('Unexpected response format.');
  return data;
}

/* ═══════════════════════════════════════════════════════════════
   LOADING STATE
   ═══════════════════════════════════════════════════════════════ */
function setLoading(on) {
  isSubmitting = on;
  submitBtn.disabled = on;
  submitBtn.classList.toggle('is-loading', on);
  submitBtn.querySelector('.btn-label').textContent = on ? 'Processing' : 'Analyze My Profile';
  submitBtn.querySelector('.btn-arrow').style.visibility = on ? 'hidden' : 'visible';
}

/* ═══════════════════════════════════════════════════════════════
   RESULT METER
   ═══════════════════════════════════════════════════════════════ */
const METER_MAP = {
  'low':       { pct: 15, band: 'band-low',       label: 'Low' },
  'medium':    { pct: 42, band: 'band-medium',     label: 'Medium' },
  'high':      { pct: 70, band: 'band-high',       label: 'High' },
  'very high': { pct: 95, band: 'band-veryhigh',   label: 'Very High' },
};

function animateMeter(levelKey) {
  const cfg = METER_MAP[levelKey] || { pct: 0, band: '', label: levelKey };
  meterFill.style.width = '0%';
  void meterFill.offsetWidth; // force reflow
  setTimeout(() => { meterFill.style.width = `${cfg.pct}%`; }, 80);
  resBand.textContent = cfg.label;
  resBand.className   = `res-band ${cfg.band}`;
}

/* ═══════════════════════════════════════════════════════════════
   LABEL MAP — readable display names for profile grid
   ═══════════════════════════════════════════════════════════════ */
const LABEL_MAP = {
  Age: 'Age', Gender: 'Gender', Country: 'Country',
  Academic_Level: 'Academic', Most_Used_Platform: 'Platform',
  Purpose_Of_Use: 'Purpose', Avg_Daily_Usage_Hours: 'Daily Usage',
  Daily_Unlocks: 'Unlocks', Study_Hours: 'Study hrs',
  Physical_Activity_Hours: 'Exercise hrs', Sleep_Hours_Per_Night: 'Sleep hrs',
  Stress_Level: 'Stress',
};

/* ═══════════════════════════════════════════════════════════════
   RENDER RESULT
   ═══════════════════════════════════════════════════════════════ */
function renderResult(data, predictedLevel) {
  const level = predictedLevel || data.Stress_Level || 'Unknown';

  // Score (textContent — XSS safe)
  resScore.textContent = level;
  animateMeter(level.toLowerCase());

  // Profile grid
  resList.innerHTML = '';
  Object.entries(data).forEach(([key, val], i) => {
    const item = document.createElement('div');
    item.className = 'res-item';
    item.style.setProperty('--delay', `${i * 40}ms`);

    const lbl = document.createElement('div');
    lbl.className   = 'res-item-label';
    lbl.textContent = LABEL_MAP[key] || key; // from our own map — safe

    const v = document.createElement('div');
    v.className   = 'res-item-val';
    v.textContent = sanitize(String(val)); // sanitized — safe

    item.appendChild(lbl);
    item.appendChild(v);
    resList.appendChild(item);
  });

  // Show result, hide form
  formBox.style.display = 'none';
  resultsBox.classList.add('is-visible');
  resError.classList.remove('is-active');
  resContent.classList.add('is-active');
  resultsBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ═══════════════════════════════════════════════════════════════
   SHOW API ERROR
   ═══════════════════════════════════════════════════════════════ */
function showApiError(msg) {
  formBox.style.display = 'none';
  resultsBox.classList.add('is-visible');
  resContent.classList.remove('is-active');
  resErrorMsg.textContent = msg; // textContent — safe
  resError.classList.add('is-active');
}

/* ═══════════════════════════════════════════════════════════════
   SHOW FORM
   ═══════════════════════════════════════════════════════════════ */
function showForm() {
  formBox.style.display = '';
  resultsBox.classList.remove('is-visible');
  resContent.classList.remove('is-active');
  resError.classList.remove('is-active');
  meterFill.style.width = '0%';
  form.querySelector('[name="Age"]')?.focus();
}

/* ═══════════════════════════════════════════════════════════════
   REAL-TIME BLUR VALIDATION
   ═══════════════════════════════════════════════════════════════ */
function attachBlurValidation() {
  const rules = {
    Age:                     (v) => { const n = parseInt(v, 10); return (v && !isNaN(n) && n >= 10 && n <= 100) ? '' : 'Age must be 10–100.'; },
    Country:                 (v) => v.trim().length >= 2 ? '' : 'Enter your country.',
    Academic_Level:          (v) => v ? '' : 'Select a level.',
    Most_Used_Platform:      (v) => v ? '' : 'Select a platform.',
    Purpose_Of_Use:          (v) => v ? '' : 'Select a purpose.',
    Avg_Daily_Usage_Hours:   (v) => { const n = parseFloat(v); return (!isNaN(n) && n >= 0 && n <= 24) ? '' : '0–24 hours.'; },
    Daily_Unlocks:           (v) => { const n = parseInt(v, 10); return (!isNaN(n) && n >= 0) ? '' : 'Enter 0 or more.'; },
    Study_Hours:             (v) => { const n = parseFloat(v); return (!isNaN(n) && n >= 0 && n <= 24) ? '' : '0–24 hours.'; },
    Physical_Activity_Hours: (v) => { const n = parseFloat(v); return (!isNaN(n) && n >= 0 && n <= 24) ? '' : '0–24 hours.'; },
    Sleep_Hours_Per_Night:   (v) => { const n = parseFloat(v); return (!isNaN(n) && n >= 0 && n <= 24) ? '' : '0–24 hours.'; },
    Stress_Level:            (v) => v ? '' : 'Select a level.',
  };
  const GROUP = { Age:'grp-age', Country:'grp-country', Academic_Level:'grp-academic', Most_Used_Platform:'grp-platform', Purpose_Of_Use:'grp-purpose', Avg_Daily_Usage_Hours:'grp-usage', Daily_Unlocks:'grp-unlocks', Study_Hours:'grp-study', Physical_Activity_Hours:'grp-activity', Sleep_Hours_Per_Night:'grp-sleep', Stress_Level:'grp-stress' };
  const ERR   = { Age:'err-age', Country:'err-country', Academic_Level:'err-academic', Most_Used_Platform:'err-platform', Purpose_Of_Use:'err-purpose', Avg_Daily_Usage_Hours:'err-usage', Daily_Unlocks:'err-unlocks', Study_Hours:'err-study', Physical_Activity_Hours:'err-activity', Sleep_Hours_Per_Night:'err-sleep', Stress_Level:'err-stress' };

  form.addEventListener('blur', (e) => {
    const name = e.target.name;
    if (!name || !(name in rules)) return;
    const msg = rules[name](e.target.value);
    msg ? setFieldError(GROUP[name], ERR[name], msg) : clearFieldError(GROUP[name], ERR[name]);
  }, true);

  form.querySelectorAll('input[name="Gender"]').forEach(r =>
    r.addEventListener('change', () => clearFieldError('grp-gender', 'err-gender'))
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUBMIT HANDLER
   ═══════════════════════════════════════════════════════════════ */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isSubmitting) return;

  // Rate limiting
  const now = Date.now();
  if (now - lastSubmitTime < RATE_LIMIT_MS) {
    globalError.textContent = `Please wait ${Math.ceil((RATE_LIMIT_MS - (now - lastSubmitTime)) / 1000)}s before retrying.`;
    return;
  }

  if (!validateForm()) return;

  const payload  = buildPayload();
  lastPayload    = payload;
  lastSubmitTime = Date.now();

  setLoading(true);
  globalError.textContent = '';

  try {
    await postPrediction(payload);

    // Try GET /get; fall back to submitted payload if it fails
    let resultData  = payload;
    let prediction  = null;
    try {
      const getRes = await fetchResult();
      resultData   = getRes;
      prediction   = getRes.prediction || getRes.Stress_Level || null;
    } catch (_) { /* use payload as display data */ }

    renderResult(resultData, prediction);
  } catch (err) {
    let msg = `Unable to reach the server at ${API_BASE}. Make sure the backend is running and CORS is configured.`;
    if (err.message && !err.message.toLowerCase().includes('fetch')) msg = err.message;
    showApiError(msg);
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
  if (!lastPayload) return;
  // Repopulate form for convenience
  const f = form.elements;
  const setVal = (name, val) => { if (f[name]) f[name].value = val; };
  setVal('Age',                     lastPayload.Age);
  setVal('Country',                 lastPayload.Country);
  setVal('Academic_Level',          lastPayload.Academic_Level);
  setVal('Most_Used_Platform',      lastPayload.Most_Used_Platform);
  setVal('Purpose_Of_Use',          lastPayload.Purpose_Of_Use);
  setVal('Avg_Daily_Usage_Hours',   lastPayload.Avg_Daily_Usage_Hours);
  setVal('Daily_Unlocks',           lastPayload.Daily_Unlocks);
  setVal('Study_Hours',             lastPayload.Study_Hours);
  setVal('Physical_Activity_Hours', lastPayload.Physical_Activity_Hours);
  setVal('Sleep_Hours_Per_Night',   lastPayload.Sleep_Hours_Per_Night);
  setVal('Stress_Level',            lastPayload.Stress_Level);
  const radio = form.querySelector(`input[name="Gender"][value="${lastPayload.Gender}"]`);
  if (radio) radio.checked = true;
});

/* ═══════════════════════════════════════════════════════════════
   KEYBOARD: ESC closes results
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && resultsBox.classList.contains('is-visible')) showForm();
});

/* ═══════════════════════════════════════════════════════════════
   BUTTON RIPPLE
   ═══════════════════════════════════════════════════════════════ */
submitBtn.addEventListener('click', () => {
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
   SMOOTH NAV
   ═══════════════════════════════════════════════════════════════ */
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  animateCounters();
  initScrollObserver();
  attachBlurValidation();
  resultsBox.classList.remove('is-visible');
  resContent.classList.remove('is-active');
  resError.classList.remove('is-active');
});
