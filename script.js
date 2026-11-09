/**
 * StressO_Meter — script.js
 *
 * NOTE FOR FASTAPI DEVELOPERS:
 * Your FastAPI backend must have CORSMiddleware enabled so the browser can
 * make cross-origin requests from the front-end origin (e.g. http://localhost:5500).
 * Example setup (already in your main.py):
 *
 *   from fastapi.middleware.cors import CORSMiddleware
 *   app.add_middleware(
 *     CORSMiddleware,
 *     allow_origins=["*"],   // Lock this down to your actual origin in production
 *     allow_methods=["*"],
 *     allow_headers=["*"],
 *   )
 *
 * Without this, every fetch() call below will be blocked by the browser with
 * a CORS policy error, even though the server responds correctly.
 */

'use strict';

/* ==========================================================================
   CONFIGURATION
   Change only this constant if your backend moves.
   ========================================================================== */

const API_BASE = 'https://mansik-santulan-project.onrender.com/';

/* ==========================================================================
   DOM REFERENCES
   ========================================================================== */

const form          = document.getElementById('predict-form');
const submitBtn     = document.getElementById('submit-btn');
const globalError   = document.getElementById('form-error-global');

// Results panel elements
const resultsEmpty   = document.getElementById('results-empty');
const resultsContent = document.getElementById('results-content');
const resultsError   = document.getElementById('results-error');
const resultScore    = document.getElementById('result-score');
const resultBand     = document.getElementById('result-score-band');
const resultList     = document.getElementById('result-inputs-list');
const resultsErrMsg  = document.getElementById('results-error-msg');


/* ==========================================================================
   FIELD VALIDATION RULES
   Each entry maps a field's name attribute to its validation logic.
   ========================================================================== */

/**
 * Validates the entire form. Marks each invalid field with an error message
 * and the .field-row--error class. Returns true if all fields are valid.
 *
 * @returns {boolean} Whether the form is valid.
 */
function validateForm() {
  let valid = true;

  // Clear previous errors
  document.querySelectorAll('.field-row--error').forEach(row => {
    row.classList.remove('field-row--error');
  });
  document.querySelectorAll('.field-error').forEach(el => {
    el.textContent = '';
  });
  globalError.textContent = '';

  // --- Age ---
  const age = form.elements['Age'];
  const ageVal = parseInt(age.value, 10);
  if (!age.value.trim() || isNaN(ageVal) || ageVal < 10 || ageVal > 100) {
    setFieldError('age', 'err-age', 'Enter an age between 10 and 100.');
    valid = false;
  }

  // --- Gender (radio) ---
  const genderSelected = form.querySelector('input[name="Gender"]:checked');
  if (!genderSelected) {
    setFieldError('gender', 'err-gender', 'Select a gender.');
    valid = false;
  }

  // --- Country ---
  const country = form.elements['Country'];
  if (!country.value.trim()) {
    setFieldError('country', 'err-country', 'Enter your country name.');
    valid = false;
  }

  // --- Academic Level ---
  const academic = form.elements['Academic_Level'];
  if (!academic.value) {
    setFieldError('academic', 'err-academic', 'Select your academic level.');
    valid = false;
  }

  // --- Most Used Platform ---
  const platform = form.elements['Most_Used_Platform'];
  if (!platform.value) {
    setFieldError('platform', 'err-platform', 'Select the platform you use most.');
    valid = false;
  }

  // --- Purpose Of Use ---
  const purpose = form.elements['Purpose_Of_Use'];
  if (!purpose.value) {
    setFieldError('purpose', 'err-purpose', 'Select your primary purpose for using social media.');
    valid = false;
  }

  // --- Avg Daily Usage Hours ---
  const usage = form.elements['Avg_Daily_Usage_Hours'];
  const usageVal = parseFloat(usage.value);
  if (usage.value.trim() === '' || isNaN(usageVal) || usageVal < 0 || usageVal > 24) {
    setFieldError('usage', 'err-usage', 'Enter hours between 0 and 24.');
    valid = false;
  }

  // --- Daily Unlocks ---
  const unlocks = form.elements['Daily_Unlocks'];
  const unlocksVal = parseInt(unlocks.value, 10);
  if (unlocks.value.trim() === '' || isNaN(unlocksVal) || unlocksVal < 0) {
    setFieldError('unlocks', 'err-unlocks', 'Enter a number of unlocks (0 or more).');
    valid = false;
  }

  // --- Study Hours ---
  const study = form.elements['Study_Hours'];
  const studyVal = parseFloat(study.value);
  if (study.value.trim() === '' || isNaN(studyVal) || studyVal < 0 || studyVal > 24) {
    setFieldError('study', 'err-study', 'Enter hours between 0 and 24.');
    valid = false;
  }

  // --- Physical Activity Hours ---
  const activity = form.elements['Physical_Activity_Hours'];
  const activityVal = parseFloat(activity.value);
  if (activity.value.trim() === '' || isNaN(activityVal) || activityVal < 0 || activityVal > 24) {
    setFieldError('activity', 'err-activity', 'Enter hours between 0 and 24.');
    valid = false;
  }

  // --- Sleep Hours Per Night ---
  const sleep = form.elements['Sleep_Hours_Per_Night'];
  const sleepVal = parseFloat(sleep.value);
  if (sleep.value.trim() === '' || isNaN(sleepVal) || sleepVal < 0 || sleepVal > 24) {
    setFieldError('sleep', 'err-sleep', 'Enter hours between 0 and 24.');
    valid = false;
  }

  // --- Stress Level ---
  const stress = form.elements['Stress_Level'];
  if (!stress.value) {
    setFieldError('stress', 'err-stress', 'Select your self-reported stress level.');
    valid = false;
  }

  // If anything is invalid, tell the user at the form level too
  if (!valid) {
    globalError.textContent = 'Some fields need attention. Review the highlighted items above.';
  }

  return valid;
}

/**
 * Marks a single field row as invalid and sets its error message.
 *
 * @param {string} rowSuffix  - The suffix used in the field-row ID (e.g. 'age').
 * @param {string} errorId    - The ID of the error <span> element.
 * @param {string} message    - The human-readable error message.
 */
function setFieldError(rowSuffix, errorId, message) {
  const row = document.getElementById('field-row-' + rowSuffix);
  const errEl = document.getElementById(errorId);
  if (row) row.classList.add('field-row--error');
  if (errEl) errEl.textContent = message;
}


/* ==========================================================================
   PAYLOAD BUILDER
   Assembles the form values into the exact JSON shape the API expects,
   with correct types (int for Age/Daily_Unlocks, float for hours).
   ========================================================================== */

/**
 * Reads all form values and returns a correctly typed payload object.
 *
 * @returns {Object} The request payload.
 */
function buildPayload() {
  const f = form.elements;
  return {
    Age:                     parseInt(f['Age'].value, 10),
    Gender:                  f['Gender'].value,                        // already set via radio :checked
    Country:                 f['Country'].value.trim(),
    Academic_Level:          f['Academic_Level'].value,
    Most_Used_Platform:      f['Most_Used_Platform'].value,
    Purpose_Of_Use:          f['Purpose_Of_Use'].value,
    Avg_Daily_Usage_Hours:   parseFloat(f['Avg_Daily_Usage_Hours'].value),
    Daily_Unlocks:           parseInt(f['Daily_Unlocks'].value, 10),
    Study_Hours:             parseFloat(f['Study_Hours'].value),
    Physical_Activity_Hours: parseFloat(f['Physical_Activity_Hours'].value),
    Sleep_Hours_Per_Night:   parseFloat(f['Sleep_Hours_Per_Night'].value),
    Stress_Level:            f['Stress_Level'].value,
  };
}

// Radio buttons need their value read differently


/* ==========================================================================
   API CALLS
   ========================================================================== */

/**
 * POSTs the payload to /predict and returns the parsed JSON response.
 * Throws a descriptive Error on network failure or non-2xx status.
 *
 * @param {Object} payload - The form data object.
 * @returns {Promise<Object>} The parsed prediction response.
 */
async function postPrediction(payload) {
  let response;
  try {
    response = await fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    throw new Error(
      'The server did not respond. Check that the FastAPI backend is running at ' +
      API_BASE + ' and that CORS is enabled.'
    );
  }

  if (!response.ok) {
    let detail = `Server returned status ${response.status}.`;
    try {
      const errBody = await response.json();
      if (errBody.detail) {
        // FastAPI validation errors return an array; flatten them
        if (Array.isArray(errBody.detail)) {
          detail = errBody.detail.map(d => d.msg || JSON.stringify(d)).join(' · ');
        } else {
          detail = String(errBody.detail);
        }
      }
    } catch (_) { /* ignore JSON parse failure on error body */ }
    throw new Error(detail);
  }

  let data;
  try {
    data = await response.json();
  } catch (_) {
    throw new Error('The server responded but returned invalid JSON.');
  }

  if (typeof data.predicted_mental_health_score !== 'number') {
    throw new Error(
      'Unexpected response shape from /predict. Expected "predicted_mental_health_score" (number).'
    );
  }

  return data;
}

/**
 * GETs the latest saved result from /get and returns the parsed JSON.
 * Throws a descriptive Error on failure.
 *
 * @returns {Promise<Object>} The parsed /get response.
 */
async function fetchResult() {
  let response;
  try {
    response = await fetch(`${API_BASE}/get`);
  } catch (_) {
    throw new Error('Could not reach /get endpoint to retrieve saved results.');
  }

  if (!response.ok) {
    throw new Error(`/get returned status ${response.status}.`);
  }

  let data;
  try {
    data = await response.json();
  } catch (_) {
    throw new Error('/get returned invalid JSON.');
  }

  return data;
}


/* ==========================================================================
   RENDER FUNCTIONS
   ========================================================================== */

/**
 * Displays the prediction score and the submitted profile in the results panel.
 *
 * @param {number} score      - The predicted_mental_health_score from /predict.
 * @param {Object} profile    - The object returned by /get (submitted profile).
 */
function renderResult(score, profile) {
  // Show score
  resultScore.textContent = score.toFixed(2);

  // Determine risk band label and class
  let bandText, bandClass;
  if (score < 0.4) {
    bandText = 'Lower Risk';
    bandClass = 'band-low';
  } else if (score < 0.7) {
    bandText = 'Moderate';
    bandClass = 'band-moderate';
  } else {
    bandText = 'Elevated Risk';
    bandClass = 'band-high';
  }
  resultBand.textContent = bandText;
  resultBand.className = 'result-score-band ' + bandClass;

  // Build the profile dl from the /get response
  resultList.innerHTML = '';
  const labels = {
    Age:                     'Age',
    Gender:                  'Gender',
    Country:                 'Country',
    Academic_Level:          'Academic level',
    Most_Used_Platform:      'Platform',
    Purpose_Of_Use:          'Purpose',
    Avg_Daily_Usage_Hours:   'Daily usage',
    Daily_Unlocks:           'Daily unlocks',
    Study_Hours:             'Study hours',
    Physical_Activity_Hours: 'Activity hours',
    Sleep_Hours_Per_Night:   'Sleep hours',
    Stress_Level:            'Stress level',
  };

  for (const [key, label] of Object.entries(labels)) {
    const value = profile[key];
    if (value === undefined) continue;

    const item = document.createElement('div');
    item.className = 'profile-item';

    const dt = document.createElement('dt');
    dt.textContent = label;

    const dd = document.createElement('dd');
    // Format numeric hour fields with units
    if (['Avg_Daily_Usage_Hours', 'Study_Hours', 'Physical_Activity_Hours', 'Sleep_Hours_Per_Night'].includes(key)) {
      dd.textContent = `${value} hr`;
    } else if (key === 'Daily_Unlocks') {
      dd.textContent = `${value}×`;
    } else {
      dd.textContent = String(value);
    }

    item.appendChild(dt);
    item.appendChild(dd);
    resultList.appendChild(item);
  }

  // Switch panel state: hide empty + error, show content
  resultsEmpty.hidden   = true;
  resultsError.hidden   = true;
  resultsContent.hidden = false;
}

/**
 * Shows an error message in the results panel.
 *
 * @param {string} message - A human-readable description of what went wrong.
 */
function showError(message) {
  resultsErrMsg.textContent = message;
  resultsEmpty.hidden    = true;
  resultsContent.hidden  = true;
  resultsError.hidden    = false;
}


/* ==========================================================================
   LOADING STATE
   ========================================================================== */

/**
 * Enables or disables the submit button's loading state.
 *
 * @param {boolean} isLoading - True to show "Processing…", false to restore.
 */
function setLoadingState(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle('is-loading', isLoading);
  submitBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
}


/* ==========================================================================
   FORM SUBMIT HANDLER
   ========================================================================== */

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  // 1. Validate — stop if anything is wrong
  if (!validateForm()) {
    // Scroll the first error into view
    const firstError = form.querySelector('.field-row--error');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  // 2. Build payload
  const payload = buildPayload();

  // 3. Enter loading state
  setLoadingState(true);

  try {
    // 4. POST to /predict
    const predictionData = await postPrediction(payload);
    const score = predictionData.predicted_mental_health_score;

    // 5. GET saved result from /get
    let profile;
    try {
      profile = await fetchResult();
    } catch (getErr) {
      // /get failed: still show score, fall back to payload as profile
      console.warn('GET /get failed:', getErr.message, '— using submitted payload as profile.');
      profile = payload;
    }

    // 6. Render result
    renderResult(score, profile);

  } catch (err) {
    // Network / server / parse error
    showError(err.message);
  } finally {
    // 7. Always restore button
    setLoadingState(false);
  }
});


/* ==========================================================================
   LIVE INLINE VALIDATION (clear error on correction)
   Each field clears its own error as soon as the user interacts with it again.
   ========================================================================== */

// Text and number inputs
form.querySelectorAll('.field-input').forEach(input => {
  input.addEventListener('input', () => {
    const row = input.closest('.field-row');
    if (row && row.classList.contains('field-row--error')) {
      row.classList.remove('field-row--error');
      const errId = input.getAttribute('aria-describedby');
      if (errId) {
        const errEl = document.getElementById(errId);
        if (errEl) errEl.textContent = '';
      }
    }
    // Also clear global error message
    globalError.textContent = '';
  });
});

// Selects
form.querySelectorAll('.field-select').forEach(select => {
  select.addEventListener('change', () => {
    const row = select.closest('.field-row');
    if (row && row.classList.contains('field-row--error')) {
      row.classList.remove('field-row--error');
      const errId = select.getAttribute('aria-describedby');
      if (errId) {
        const errEl = document.getElementById(errId);
        if (errEl) errEl.textContent = '';
      }
    }
    globalError.textContent = '';
  });
});

// Radio buttons (Gender)
form.querySelectorAll('.radio-input').forEach(radio => {
  radio.addEventListener('change', () => {
    const row = document.getElementById('field-row-gender');
    if (row) row.classList.remove('field-row--error');
    const errEl = document.getElementById('err-gender');
    if (errEl) errEl.textContent = '';
    globalError.textContent = '';
  });
});
