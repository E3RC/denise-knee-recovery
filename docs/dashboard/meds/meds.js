const STORAGE_KEY = 'denise-recovery-phase1';
const DASHBOARD_STATE_URL = '/api/dashboard-state';
const DISPLAY_TIMEZONE = 'America/Indiana/Indianapolis';

const els = {
  medicationList: document.getElementById('medication-list'),
  medicationForm: document.getElementById('medication-form'),
  addMedication: document.getElementById('add-medication'),
  saveMedications: document.getElementById('save-medications'),
  backToList: document.getElementById('back-to-list'),
  markDispensed: document.getElementById('mark-dispensed'),
  detailTitle: document.getElementById('detail-title'),
  timerPreview: document.getElementById('timer-preview'),
  pushoverPreview: document.getElementById('pushover-preview')
};

const DEFAULT_MED = {
  name: '',
  dose: '',
  purpose: '',
  instructions: '',
  scheduled: '',
  intervalHours: '',
  dueTime: '',
  startRule: '',
  stopRule: '',
  ruleKey: '',
  lastGivenAt: '',
  nextDueAt: '',
  givenTime: '',
  givenBy: '',
  dispensed: false,
  notes: ''
};

let state = {
  medicationTemplates: [structuredClone(DEFAULT_MED)]
};
let selectedMedicationIndex = 0;

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function getTimeZoneParts(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(dt);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

function getTimeZoneOffsetMinutes(value) {
  const parts = getTimeZoneParts(value);
  if (!parts) return 0;
  const utcMillis = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return (utcMillis - new Date(value).getTime()) / 60000;
}

function toDatetimeLocalValue(value) {
  const parts = getTimeZoneParts(value);
  if (!parts) return '';
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function normalizeLogTime(value) {
  if (!value) return '';
  const normalized = String(value).trim();
  if (!normalized) return '';
  if (/z$/i.test(normalized) || /[+-]\d{2}:\d{2}$/.test(normalized)) {
    const dt = new Date(normalized);
    return Number.isNaN(dt.getTime()) ? '' : dt.toISOString();
  }
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return '';
  const [, year, month, day, hour, minute] = match;
  const utcGuess = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0);
  let dt = new Date(utcGuess);
  let offset = getTimeZoneOffsetMinutes(dt);
  dt = new Date(utcGuess - offset * 60000);
  const adjustedOffset = getTimeZoneOffsetMinutes(dt);
  if (adjustedOffset !== offset) {
    dt = new Date(utcGuess - adjustedOffset * 60000);
  }
  return dt.toISOString();
}

function formatDateTime(value) {
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? '' : new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: DISPLAY_TIMEZONE,
    timeZoneName: 'short'
  }).format(dt);
}

function calculateNextDueAt(item) {
  const hours = Number(item.intervalHours);
  if (!item.lastGivenAt || !Number.isFinite(hours) || hours <= 0) return '';
  const last = new Date(item.lastGivenAt);
  if (Number.isNaN(last.getTime())) return '';
  return new Date(last.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function specialRuleNote(item) {
  if (item.ruleKey === 'journavx_loading_then_q12h') {
    if (!item.lastGivenAt) {
      return 'First log the 2-tablet loading dose. After that, every recorded dose restarts the 12-hour timer.';
    }
    return 'Journavx special rule: after the loading dose, each recorded dose becomes the anchor for the next 12-hour reminder.';
  }
  return '';
}

function syncMedicationTiming(item) {
  item.lastGivenAt = normalizeLogTime(item.lastGivenAt || item.givenTime);
  item.givenTime = item.lastGivenAt;
  item.nextDueAt = calculateNextDueAt(item);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.medicationTemplates) && parsed.medicationTemplates.length) {
      state.medicationTemplates = parsed.medicationTemplates.map(item => ({
        ...structuredClone(DEFAULT_MED),
        ...item
      })).map(item => {
        syncMedicationTiming(item);
        return item;
      });
    }
  } catch {}
}

async function syncRemoteState() {
  try {
    const response = await fetch(DASHBOARD_STATE_URL, { cache: 'no-store' });
    if (!response.ok) return;
    const parsed = await response.json();
    if (Array.isArray(parsed?.medicationTemplates) && parsed.medicationTemplates.length) {
      state.medicationTemplates = parsed.medicationTemplates.map(item => ({
        ...structuredClone(DEFAULT_MED),
        ...item
      })).map(item => {
        syncMedicationTiming(item);
        return item;
      });
      persistLocalOnly();
      render();
    }
  } catch {}
}

function persistLocalOnly() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.medicationTemplates = state.medicationTemplates;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {}
}

async function persistRemoteState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.medicationTemplates = state.medicationTemplates;
    await fetch(DASHBOARD_STATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    });
  } catch {}
}

function saveState() {
  persistLocalOnly();
  void persistRemoteState();
}

function medicationUrl(index) {
  return `/dashboard/meds/?med=${index}`;
}

function setSelectedMedication(index, pushHistory = true) {
  const maxIndex = Math.max(0, state.medicationTemplates.length - 1);
  selectedMedicationIndex = Math.min(Math.max(Number(index) || 0, 0), maxIndex);
  if (pushHistory) {
    window.history.replaceState({}, '', medicationUrl(selectedMedicationIndex));
  }
}

function getSelectedMedication() {
  return state.medicationTemplates[selectedMedicationIndex] || null;
}

function renderMedicationList() {
  els.medicationList.innerHTML = state.medicationTemplates.map((item, index) => `
    <div class="item">
      <div class="item-head">
        <div>
          <strong>${escapeHtml(item.name || `Medication ${index + 1}`)}</strong>
          <p class="small">${escapeHtml(item.dose || 'Dose not entered')}</p>
        </div>
        <span class="tag">${item.dispensed ? 'Dispensed' : 'Not dispensed'}</span>
      </div>
      <div class="section-actions">
        <button type="button" class="ghost" data-open-med="${index}">Open medication</button>
        <button type="button" class="ghost" data-toggle-dispensed="${index}">${item.dispensed ? 'Mark not dispensed' : 'Mark dispensed'}</button>
      </div>
    </div>
  `).join('');
}

function renderMedicationForm() {
  const item = getSelectedMedication();
  if (!item) {
    els.detailTitle.textContent = 'Medication details';
    els.medicationForm.innerHTML = '<div class="item muted">Add a medication to get started.</div>';
    return;
  }

  els.detailTitle.textContent = item.name ? `${item.name}` : `Medication ${selectedMedicationIndex + 1}`;
  els.markDispensed.textContent = item.dispensed ? 'Mark not dispensed' : 'Mark dispensed';

  els.medicationForm.innerHTML = `
    <label>
      <span>Medication name</span>
      <input data-med-index="${selectedMedicationIndex}" data-med-field="name" value="${escapeHtml(item.name)}" placeholder="Medication name" />
      <span>Dose</span>
      <input data-med-index="${selectedMedicationIndex}" data-med-field="dose" value="${escapeHtml(item.dose)}" placeholder="Enter exact dose" />
      <span>Purpose</span>
      <input data-med-index="${selectedMedicationIndex}" data-med-field="purpose" value="${escapeHtml(item.purpose)}" placeholder="Pain, nausea, clot prevention, constipation, etc." />
      <span>Instructions</span>
      <textarea data-med-index="${selectedMedicationIndex}" data-med-field="instructions" rows="3" placeholder="Enter exact instructions">${escapeHtml(item.instructions || '')}</textarea>
      <span>Scheduled or PRN</span>
      <input data-med-index="${selectedMedicationIndex}" data-med-field="scheduled" value="${escapeHtml(item.scheduled)}" placeholder="Scheduled or PRN" />
      <span>Interval hours</span>
      <input data-med-index="${selectedMedicationIndex}" data-med-field="intervalHours" value="${escapeHtml(item.intervalHours)}" placeholder="Example: 4, 6, or 12" />
      <span>Start rule</span>
      <input data-med-index="${selectedMedicationIndex}" data-med-field="startRule" value="${escapeHtml(item.startRule)}" placeholder="Example: morning after surgery" />
      <span>Stop rule</span>
      <input data-med-index="${selectedMedicationIndex}" data-med-field="stopRule" value="${escapeHtml(item.stopRule)}" placeholder="Example: 7 days, 14 days, or as needed" />
      <span>Due time</span>
      <input data-med-index="${selectedMedicationIndex}" data-med-field="dueTime" value="${escapeHtml(item.dueTime)}" placeholder="Example: every 6 hours or 8:00 AM" />
      <span>Last given</span>
      <input type="datetime-local" data-med-index="${selectedMedicationIndex}" data-med-field="lastGivenAt" value="${escapeHtml(toDatetimeLocalValue(item.lastGivenAt))}" />
      <span>Next due</span>
      <input value="${escapeHtml(formatDateTime(item.nextDueAt))}" placeholder="Calculated from last dose" readonly />
      <span>Rule key</span>
      <input data-med-index="${selectedMedicationIndex}" data-med-field="ruleKey" value="${escapeHtml(item.ruleKey)}" placeholder="Optional special timing rule" />
      <span>Given by</span>
      <input data-med-index="${selectedMedicationIndex}" data-med-field="givenBy" value="${escapeHtml(item.givenBy)}" placeholder="Who gave it" />
      <span>Notes</span>
      <textarea data-med-index="${selectedMedicationIndex}" data-med-field="notes" rows="3" placeholder="Food, PRN trigger, timer note, or do-not-overlap note">${escapeHtml(item.notes || '')}</textarea>
      <span>Dispensed</span>
      <input value="${item.dispensed ? 'Yes' : 'No'}" readonly />
      ${specialRuleNote(item) ? `<span class="small">${escapeHtml(specialRuleNote(item))}</span>` : ''}
      <button type="button" class="primary" data-med-log-now="${selectedMedicationIndex}">Log dose now and restart timer</button>
      <button type="button" class="ghost" data-med-remove="${selectedMedicationIndex}">Remove medication</button>
    </label>
  `;
}

function renderTimerPreview() {
  const items = state.medicationTemplates.filter(item => item.name || item.dueTime || item.scheduled);
  if (!items.length) {
    els.timerPreview.innerHTML = '<div class="item muted">No medication timers yet. Once real schedules are entered, this page can drive countdown timers and next-dose tracking.</div>';
    return;
  }
  els.timerPreview.innerHTML = items.map(item => `
    <div class="item">
      <div class="item-head">
        <strong>${escapeHtml(item.name || 'Unnamed medication')}</strong>
        <span class="tag">${escapeHtml(item.scheduled || 'Schedule TBD')}</span>
      </div>
      <p class="small">Purpose: ${escapeHtml(item.purpose || 'Not set')}</p>
      <p class="small">Interval: ${escapeHtml(item.intervalHours || 'Not set')} hour(s)</p>
      <p class="small">Last given: ${escapeHtml(formatDateTime(item.lastGivenAt) || 'Not logged yet')}</p>
      <p class="small">Next due: ${escapeHtml(formatDateTime(item.nextDueAt) || 'Will calculate after first logged dose')}</p>
      ${specialRuleNote(item) ? `<p class="small">${escapeHtml(specialRuleNote(item))}</p>` : ''}
    </div>
  `).join('');
}

function renderPushoverPreview() {
  const items = state.medicationTemplates.filter(item => item.name || item.dueTime || item.scheduled);
  if (!items.length) {
    els.pushoverPreview.innerHTML = '<div class="item muted">No medication reminder rules yet. We will map these into Pushover once the actual med list and timing are confirmed.</div>';
    return;
  }
  els.pushoverPreview.innerHTML = items.map(item => `
    <div class="item">
      <div class="item-head">
        <strong>${escapeHtml(item.name || 'Unnamed medication')}</strong>
        <span class="tag">Pushover candidate</span>
      </div>
      <p class="small">Reminder target: ${escapeHtml(formatDateTime(item.nextDueAt) || 'Will follow the next calculated dose time')}</p>
      <p class="small">Start / stop: ${escapeHtml(item.startRule || 'Not set')} / ${escapeHtml(item.stopRule || 'Not set')}</p>
    </div>
  `).join('');
}

function render() {
  renderMedicationList();
  renderMedicationForm();
  renderTimerPreview();
  renderPushoverPreview();
}

els.medicationForm.addEventListener('input', event => {
  const target = event.target.closest('[data-med-index][data-med-field]');
  if (!target) return;
  const index = Number(target.dataset.medIndex);
  const item = state.medicationTemplates[index];
  if (!item) return;
  const field = target.dataset.medField;
  item[field] = field === 'lastGivenAt' ? normalizeLogTime(target.value) : target.value;
  syncMedicationTiming(item);
});

els.medicationForm.addEventListener('blur', () => {
  saveState();
  render();
}, true);

els.medicationForm.addEventListener('click', event => {
  const logButton = event.target.closest('[data-med-log-now]');
  if (logButton) {
    const index = Number(logButton.dataset.medLogNow);
    const item = state.medicationTemplates[index];
    if (!item) return;
    item.lastGivenAt = new Date().toISOString();
    syncMedicationTiming(item);
    saveState();
    render();
    return;
  }

  const button = event.target.closest('[data-med-remove]');
  if (!button) return;
  const index = Number(button.dataset.medRemove);
  if (!Number.isFinite(index)) return;
  state.medicationTemplates.splice(index, 1);
  if (!state.medicationTemplates.length) {
    state.medicationTemplates.push(structuredClone(DEFAULT_MED));
  }
  setSelectedMedication(Math.max(0, index - 1));
  saveState();
  render();
});

els.medicationList.addEventListener('click', event => {
  const openButton = event.target.closest('[data-open-med]');
  if (openButton) {
    setSelectedMedication(Number(openButton.dataset.openMed));
    render();
    return;
  }

  const dispensedButton = event.target.closest('[data-toggle-dispensed]');
  if (!dispensedButton) return;
  const index = Number(dispensedButton.dataset.toggleDispensed);
  const item = state.medicationTemplates[index];
  if (!item) return;
  item.dispensed = !item.dispensed;
  saveState();
  render();
});

els.addMedication.addEventListener('click', () => {
  state.medicationTemplates.push(structuredClone(DEFAULT_MED));
  setSelectedMedication(state.medicationTemplates.length - 1);
  saveState();
  render();
});

els.saveMedications.addEventListener('click', () => {
  saveState();
  render();
});

els.backToList.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

els.markDispensed.addEventListener('click', () => {
  const item = getSelectedMedication();
  if (!item) return;
  item.dispensed = !item.dispensed;
  saveState();
  render();
});

function initSelectionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const index = Number(params.get('med'));
  setSelectedMedication(Number.isFinite(index) ? index : 0, false);
}

loadState();
initSelectionFromUrl();
render();
void syncRemoteState();
