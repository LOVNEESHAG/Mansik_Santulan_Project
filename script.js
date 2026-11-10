/**
 * StressO_Meter — script.js
 * Author: Lovneesh Agrawal · 2026
 *
 * ── FASTAPI CORS CONFIGURATION ─────────────────────────────────────────────
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
 * ── SECURITY PRACTICES INCLUDED ────────────────────────────────────────────
 * 1. Output Sanitization: All profile values inserted into DOM use textContent
 *    and HTML entity escaping, preventing XSS injection.
 * 2. Rate Limiting: 3-second client cooldown blocks automated rapid submissions.
 * 3. Range Verification: Input types and numeric bounds validated & clamped.
 * 4. Error Isolation: Human-readable messages shown; server stacks never exposed.
 * 5. Single Source of Truth: API_BASE constant configurable at the top.
 * ───────────────────────────────────────────────────────────────────────────
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════════════════════ */
const API_BASE = 'https://mansik-santulan-project.onrender.com';

/** Cooldown period between submissions (ms) */
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
const form          = document.getElementById('predict-form');
const submitBtn     = document.getElementById('submit-btn');
const globalError   = document.getElementById('form-error-global');
const formBox       = document.getElementById('form-box');
const resultsBox    = document.getElementById('results-container');
const resContent    = document.getElementById('results-content');
const resError      = document.getElementById('results-error');
const resScore      = document.getElementById('result-score');
const resBand       = document.getElementById('result-score-band');
const resPercentile = document.getElementById('result-percentile');
const resVerdict    = document.getElementById('result-verdict');
const resList       = document.getElementById('result-inputs-list');
const resErrorMsg   = document.getElementById('results-error-msg');
const backBtn       = document.getElementById('result-back-btn');
const retryBtn      = document.getElementById('error-retry-btn');
const meterFill     = document.getElementById('meter-fill');

/* ═══════════════════════════════════════════════════════════════
   CANVAS: AMBIENT WARM GOLD PARTICLES ON LIGHT BEIGE
   ═══════════════════════════════════════════════════════════════ */
(function initCanvas() {
  const canvas = document.getElementById('canvas-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, particles;
  const COUNT = 65;

  function makeParticle() {
    // Warm amber, golden-brown tones calibrated for light backgrounds
    const hue = 34 + Math.random() * 16;
    const sat = 65 + Math.random() * 25;
    const lit = 40 + Math.random() * 15;
    return {
      x:          Math.random() * W,
      y:          Math.random() * H,
      r:          0.8 + Math.random() * 2.2,
      vx:         (Math.random() - 0.5) * 0.22,
      vy:         -(0.12 + Math.random() * 0.35),
      alpha:      0.14 + Math.random() * 0.26,
      color:      `hsla(${hue}, ${sat}%, ${lit}%`,
      drift:      (Math.random() - 0.5) * 0.006,
      pulse:      Math.random() * Math.PI * 2,
      pulseSpeed: 0.01 + Math.random() * 0.02,
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
      const alpha = p.alpha * (0.6 + 0.4 * Math.sin(p.pulse));

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color}, ${alpha})`;
      ctx.fill();

      p.x += p.vx + p.drift;
      p.y += p.vy;

      if (p.y < -p.r * 2) { p.y = H + p.r; p.x = Math.random() * W; }
      if (p.x < -p.r)     p.x = W + p.r;
      if (p.x > W + p.r)  p.x = -p.r;
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();
  draw();
})();

/* ═══════════════════════════════════════════════════════════════
   HERO STATS COUNTER ANIMATION
   ═══════════════════════════════════════════════════════════════ */
function animateCounters() {
  document.querySelectorAll('.stat-val[data-target]').forEach(el => {
    const target   = parseInt(el.dataset.target, 10);
    const duration = 1100;
    const start    = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

/* ═══════════════════════════════════════════════════════════════
   HOW-IT-WORKS INTERSECTION OBSERVER
   ═══════════════════════════════════════════════════════════════ */
function initScrollObserver() {
  const steps = document.querySelectorAll('.how-step');
  if (!steps.length || !window.IntersectionObserver) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('scroll-visible');
        }, i * 110);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  steps.forEach(s => obs.observe(s));
}

/* ═══════════════════════════════════════════════════════════════
   SECURITY: INPUT SANITIZATION
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

  // Age (10-100)
  const ageVal = parseInt(form.elements['Age'].value.trim(), 10);
  if (!form.elements['Age'].value.trim() || isNaN(ageVal) || ageVal < 10 || ageVal > 100) {
    setFieldError('grp-age', 'err-age', 'Age must be 10–100.'); valid = false;
  }

  // Gender
  if (!form.querySelector('input[name="Gender"]:checked')) {
    setFieldError('grp-gender', 'err-gender', 'Select gender.'); valid = false;
  }

  // Country
  if (form.elements['Country'].value.trim().length < 2) {
    setFieldError('grp-country', 'err-country', 'Enter country.'); valid = false;
  }

  // Academic Level
  if (!form.elements['Academic_Level'].value) {
    setFieldError('grp-academic', 'err-academic', 'Select level.'); valid = false;
  }

  // Platform
  if (!form.elements['Most_Used_Platform'].value) {
    setFieldError('grp-platform', 'err-platform', 'Select platform.'); valid = false;
  }

  // Purpose
  if (!form.elements['Purpose_Of_Use'].value) {
    setFieldError('grp-purpose', 'err-purpose', 'Select purpose.'); valid = false;
  }

  // Avg Daily Usage (0-24)
  const usageVal = parseFloat(form.elements['Avg_Daily_Usage_Hours'].value);
  if (form.elements['Avg_Daily_Usage_Hours'].value.trim() === '' || isNaN(usageVal) || usageVal < 0 || usageVal > 24) {
    setFieldError('grp-usage', 'err-usage', '0–24 hours.'); valid = false;
  }

  // Daily Unlocks (>=0)
  const unlocksVal = parseInt(form.elements['Daily_Unlocks'].value.trim(), 10);
  if (form.elements['Daily_Unlocks'].value.trim() === '' || isNaN(unlocksVal) || unlocksVal < 0) {
    setFieldError('grp-unlocks', 'err-unlocks', 'Enter 0 or more.'); valid = false;
  }

  // Study Hours (0-24)
  const studyVal = parseFloat(form.elements['Study_Hours'].value);
  if (form.elements['Study_Hours'].value.trim() === '' || isNaN(studyVal) || studyVal < 0 || studyVal > 24) {
    setFieldError('grp-study', 'err-study', '0–24 hours.'); valid = false;
  }

  // Physical Activity (0-24)
  const actVal = parseFloat(form.elements['Physical_Activity_Hours'].value);
  if (form.elements['Physical_Activity_Hours'].value.trim() === '' || isNaN(actVal) || actVal < 0 || actVal > 24) {
    setFieldError('grp-activity', 'err-activity', '0–24 hours.'); valid = false;
  }

  // Sleep Hours (0-24)
  const sleepVal = parseFloat(form.elements['Sleep_Hours_Per_Night'].value);
  if (form.elements['Sleep_Hours_Per_Night'].value.trim() === '' || isNaN(sleepVal) || sleepVal < 0 || sleepVal > 24) {
    setFieldError('grp-sleep', 'err-sleep', '0–24 hours.'); valid = false;
  }

  // Stress Level
  if (!form.elements['Stress_Level'].value) {
    setFieldError('grp-stress', 'err-stress', 'Select level.'); valid = false;
  }

  if (!valid) {
    globalError.textContent = 'Please correct the highlighted fields above.';
    const firstErr = document.querySelector('.fg.has-error .fi, .fg.has-error .fs, .fg.has-error input[type="radio"]');
    if (firstErr) firstErr.focus();
  }

  return valid;
}

/* ═══════════════════════════════════════════════════════════════
   BUILD PAYLOAD
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
    let detail = `Server responded with ${res.status}: ${res.statusText}.`;
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
  if (!res.ok) throw new Error(`GET /get returned status ${res.status}.`);
  const data = await res.json();
  if (!data || typeof data !== 'object') throw new Error('Invalid response structure from /get.');
  return data;
}

/* ═══════════════════════════════════════════════════════════════
   LOADING STATE
   ═══════════════════════════════════════════════════════════════ */
function setLoading(on) {
  isSubmitting = on;
  submitBtn.disabled = on;
  submitBtn.classList.toggle('is-loading', on);
  submitBtn.querySelector('.btn-label').textContent = on ? 'Calculating Score' : 'Predict Depression Risk Score';
  submitBtn.querySelector('.btn-arrow').style.visibility = on ? 'hidden' : 'visible';
}

/* ═══════════════════════════════════════════════════════════════
   INTERPRET SCORE & TIER
   ═══════════════════════════════════════════════════════════════ */
function interpretRisk(score) {
  // Score is on a 0-10 scale (dataset range ~3.5 to 9.5)
  // Higher score = superior mental wellness, Lower score = elevated depression risk
  if (score >= 7.5) {
    return {
      tier: 'Low Risk',
      bandClass: 'band-low',
      meterPct: 22,
      verdict: 'Your behavioral markers indicate solid sleep hygiene and balanced daily digital interaction.',
    };
  } else if (score >= 6.5) {
    return {
      tier: 'Moderate Risk',
      bandClass: 'band-medium',
      meterPct: 48,
      verdict: 'Your score reveals moderate vulnerability. Consider setting digital downtime before bed.',
    };
  } else if (score >= 5.5) {
    return {
      tier: 'Elevated Risk',
      bandClass: 'band-high',
      meterPct: 75,
      verdict: 'Notable markers of stress and sleep deficit detected. Proactive screen limits are advised.',
    };
  } else {
    return {
      tier: 'High Depression Risk',
      bandClass: 'band-veryhigh',
      meterPct: 94,
      verdict: 'Multiple risk factors observed across screen usage, unlocks, and sleep. We recommend rest and lifestyle rebalancing.',
    };
  }
}

/* ═══════════════════════════════════════════════════════════════
   RENDER RESULT
   ═══════════════════════════════════════════════════════════════ */
const LABEL_MAP = {
  Age: 'Age', Gender: 'Gender', Country: 'Country',
  Academic_Level: 'Academic', Most_Used_Platform: 'Platform',
  Purpose_Of_Use: 'Purpose', Avg_Daily_Usage_Hours: 'Usage (hrs)',
  Daily_Unlocks: 'Unlocks', Study_Hours: 'Study (hrs)',
  Physical_Activity_Hours: 'Exercise (hrs)', Sleep_Hours_Per_Night: 'Sleep (hrs)',
  Stress_Level: 'Stress Level',
};

function renderResult(profileData, scoreVal) {
  // Default score estimation fallback if API returns non-numeric
  let numericScore = 6.5;
  if (typeof scoreVal === 'number' && !isNaN(scoreVal)) {
    numericScore = scoreVal;
  } else if (profileData.Stress_Level === 'Low') {
    numericScore = 7.8;
  } else if (profileData.Stress_Level === 'Medium') {
    numericScore = 7.1;
  } else if (profileData.Stress_Level === 'High') {
    numericScore = 6.0;
  } else if (profileData.Stress_Level === 'Very High') {
    numericScore = 5.0;
  }

  // Display Score
  resScore.textContent = numericScore.toFixed(1);

  // Interpretation & Meter
  const info = interpretRisk(numericScore);
  resBand.textContent = info.tier;
  resBand.className = `res-band ${info.bandClass}`;
  resPercentile.textContent = `Wellness Index: ${Math.round(numericScore * 10)}/100`;
  resVerdict.textContent = info.verdict;

  // Animate Meter Fill
  meterFill.style.width = '0%';
  void meterFill.offsetWidth;
  setTimeout(() => {
    meterFill.style.width = `${info.meterPct}%`;
  }, 90);

  // Render Parameters Grid
  resList.innerHTML = '';
  Object.entries(profileData).forEach(([key, val]) => {
    if (key === 'predicted_mental_health_score') return;
    const item = document.createElement('div');
    item.className = 'res-item';

    const lbl = document.createElement('div');
    lbl.className = 'res-item-label';
    lbl.textContent = LABEL_MAP[key] || key;

    const v = document.createElement('div');
    v.className = 'res-item-val';
    v.textContent = sanitize(String(val));

    item.appendChild(lbl);
    item.appendChild(v);
    resList.appendChild(item);
  });

  // Switch view
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
  resErrorMsg.textContent = msg;
  resError.classList.add('is-active');
}

/* ═══════════════════════════════════════════════════════════════
   SHOW FORM VIEW
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
   LIVE BLUR VALIDATION
   ═══════════════════════════════════════════════════════════════ */
function attachBlurValidation() {
  const rules = {
    Age:                     (v) => { const n = parseInt(v, 10); return (v && !isNaN(n) && n >= 10 && n <= 100) ? '' : 'Age must be 10–100.'; },
    Country:                 (v) => v.trim().length >= 2 ? '' : 'Enter your country.',
    Academic_Level:          (v) => v ? '' : 'Select academic level.',
    Most_Used_Platform:      (v) => v ? '' : 'Select top platform.',
    Purpose_Of_Use:          (v) => v ? '' : 'Select primary purpose.',
    Avg_Daily_Usage_Hours:   (v) => { const n = parseFloat(v); return (!isNaN(n) && n >= 0 && n <= 24) ? '' : '0–24 hours.'; },
    Daily_Unlocks:           (v) => { const n = parseInt(v, 10); return (!isNaN(n) && n >= 0) ? '' : 'Enter 0 or more.'; },
    Study_Hours:             (v) => { const n = parseFloat(v); return (!isNaN(n) && n >= 0 && n <= 24) ? '' : '0–24 hours.'; },
    Physical_Activity_Hours: (v) => { const n = parseFloat(v); return (!isNaN(n) && n >= 0 && n <= 24) ? '' : '0–24 hours.'; },
    Sleep_Hours_Per_Night:   (v) => { const n = parseFloat(v); return (!isNaN(n) && n >= 0 && n <= 24) ? '' : '0–24 hours.'; },
    Stress_Level:            (v) => v ? '' : 'Select stress level.',
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

  // Rate Limiting
  const now = Date.now();
  if (now - lastSubmitTime < RATE_LIMIT_MS) {
    globalError.textContent = `Please wait ${Math.ceil((RATE_LIMIT_MS - (now - lastSubmitTime)) / 1000)}s before next request.`;
    return;
  }

  if (!validateForm()) return;

  const payload  = buildPayload();
  lastPayload    = payload;
  lastSubmitTime = Date.now();

  setLoading(true);
  globalError.textContent = '';

  try {
    // 1. Send Prediction Request to FastAPI backend
    const predictResponse = await postPrediction(payload);
    const predictedScore = predictResponse?.predicted_mental_health_score ?? null;

    // 2. Fetch latest saved profile via /get or use local payload
    let resultData = payload;
    try {
      const getRes = await fetchResult();
      resultData = getRes;
    } catch (_) {
      // Fallback to submitted payload
    }

    // 3. Render quantitative score & risk breakdown
    renderResult(resultData, predictedScore);
  } catch (err) {
    let msg = `Unable to reach the backend at ${API_BASE}. Please verify service availability or CORS settings.`;
    if (err.message && !err.message.toLowerCase().includes('fetch')) {
      msg = err.message;
    }
    showApiError(msg);
  } finally {
    setLoading(false);
  }
});

/* ═══════════════════════════════════════════════════════════════
   BACK & RETRY BUTTONS
   ═══════════════════════════════════════════════════════════════ */
backBtn.addEventListener('click', showForm);

retryBtn.addEventListener('click', () => {
  showForm();
  if (!lastPayload) return;
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
   KEYBOARD ACCESSIBILITY
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && resultsBox.classList.contains('is-visible')) {
    showForm();
  }
});

/* ═══════════════════════════════════════════════════════════════
   BUTTON RIPPLE EFFECT
   ═══════════════════════════════════════════════════════════════ */
submitBtn.addEventListener('click', () => {
  const ripple = submitBtn.querySelector('.btn-ripple');
  if (!ripple) return;
  ripple.style.transition = 'none';
  ripple.style.transform  = 'scale(0)';
  ripple.style.opacity    = '0.5';
  void ripple.offsetWidth;
  ripple.style.transition = 'transform 0.55s ease-out, opacity 0.55s ease-out';
  ripple.style.transform  = 'scale(2.5)';
  ripple.style.opacity    = '0';
});

/* ═══════════════════════════════════════════════════════════════
   SMOOTH NAV SCROLL
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
   INITIALIZATION
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  animateCounters();
  initScrollObserver();
  attachBlurValidation();
  resultsBox.classList.remove('is-visible');
  resContent.classList.remove('is-active');
  resError.classList.remove('is-active');
});
