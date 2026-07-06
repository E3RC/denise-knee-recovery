const STORAGE_KEY = 'denise-recovery-phase1';
const SURGERY_DATE = '2026-07-06';
const CHECKLIST = [
  'Pain',
  'Walking',
  'Exercises',
  'Medications',
  'Cold therapy',
  'Hydration',
  'Meals',
  'Sleep',
  'Bowel movements'
];

// Seed/default content stays separate from user-entered logs so the state can
// grow without turning the dashboard into one giant mixed object.
const SEED = {
  patient: {
    name: 'Denise',
    caregiver: 'Brent Soper',
    procedure: 'Total knee replacement',
    surgeryDate: SURGERY_DATE
  },
  equipment: [
    { text: 'Drive Medical 10210-1 walker', ready: true },
    { text: 'Pulsar Flow automated cold therapy', ready: true },
    { text: 'Built-in shower seat', ready: true },
    { text: 'Elevated bidet toilet seats', ready: true }
  ],
  contacts: [
    { label: 'Surgeon', value: 'Add surgeon contact' },
    { label: 'Hospital', value: 'Add hospital contact' },
    { label: 'Pharmacy', value: 'Add pharmacy contact' },
    { label: 'Physical therapy', value: 'Add PT contact' }
  ],
  medicationTemplates: [
    {
      name: 'Prescription placeholder',
      dose: 'Use discharge instructions',
      scheduled: 'Scheduled',
      dueTime: 'TBD',
      givenTime: '',
      givenBy: '',
      notes: 'Neutral placeholder until Brent adds actual bottle details.'
    }
  ],
  milestoneTemplates: [
    'Surgery complete',
    'First walk',
    'First stairs',
    'First shower',
    'First PT session',
    'First bowel movement',
    'Transition to cane',
    'Off narcotics',
    '90° flexion',
    '110° flexion',
    'Full extension',
    'Six-week follow-up'
  ],
  timelineSeed: [
    { type: 'Surgery day', text: 'Surgery scheduled for Monday morning.', at: new Date().toISOString() }
  ]
};

function createDefaultState() {
  return {
    patient: structuredClone(SEED.patient),
    surgeryDate: SURGERY_DATE,
    contacts: structuredClone(SEED.contacts),
    medicationTemplates: structuredClone(SEED.medicationTemplates),
    milestoneTemplates: SEED.milestoneTemplates.map(name => ({
      name,
      completed: false,
      history: []
    })),
    meds: [],
    timeline: structuredClone(SEED.timelineSeed),
    equipment: structuredClone(SEED.equipment),
    notes: [],
    activityLog: [],
    dailyLog: [],
    checklist: CHECKLIST.map(id => ({ id, done: false, at: null }))
  };
}

const DEFAULT_STATE = createDefaultState();

const els = {
  day: document.getElementById('recovery-day'),
  countdown: document.getElementById('countdown'),
  surgeryDate: document.getElementById('surgery-date'),
  today: document.getElementById('today-list'),
  checklist: document.getElementById('checklist'),
  activity: document.getElementById('activity'),
  caregiverLog: document.getElementById('caregiver-log'),
  equipment: document.getElementById('equipment'),
  notes: document.getElementById('notes'),
  contactsForm: document.getElementById('contacts-form'),
  medicationForm: document.getElementById('medication-form'),
  milestones: document.getElementById('milestones'),
  nextTask: document.getElementById('next-task'),
  followUpSummary: document.getElementById('follow-up-summary'),
  saveContacts: document.getElementById('save-contacts'),
  saveMedications: document.getElementById('save-medications'),
  addLogEntry: document.getElementById('add-log-entry'),
  addMilestone: document.getElementById('add-milestone'),
  form: document.getElementById('event-form'),
  reset: document.getElementById('reset-demo'),
  exportJson: document.getElementById('export-json'),
  importJson: document.getElementById('import-json'),
  copySummary: document.getElementById('copy-summary'),
  printSummary: document.getElementById('print-summary')
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch {}
  return structuredClone(DEFAULT_STATE);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `denise-recovery-${state.surgeryDate || SURGERY_DATE}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const rows = [
    ['type', 'timestamp', 'text'],
    ...[
      ...state.activityLog.map(item => [item.type || 'Activity', item.at || '', item.text || '']),
      ...state.dailyLog.map(item => [
        'Caregiver log',
        item.when || '',
        [item.status, item.details].filter(Boolean).join(' - ')
      ]),
      ...state.timeline.map(item => [item.type || 'Timeline', item.at || '', item.text || '']),
      ...state.meds.map(item => [item.type || 'Medication', item.at || '', item.text || '']),
      ...state.notes.map(item => [item.type || 'Note', item.at || '', item.text || ''])
    ]
  ];
  const csv = rows.map(cols => cols.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `denise-recovery-${state.surgeryDate || SURGERY_DATE}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importState(file) {
  const text = await file.text();
  const next = JSON.parse(text);
  state = normalizeState(next);
  saveState();
  render();
}

function normalizeState(next) {
  const merged = { ...structuredClone(DEFAULT_STATE), ...next };
  merged.patient = { ...DEFAULT_STATE.patient, ...(next?.patient || {}) };
  merged.checklist = Array.isArray(next?.checklist)
    ? next.checklist.map(item => ({
        id: String(item.id || ''),
        done: Boolean(item.done),
        at: item.at || null
      })).filter(item => item.id)
    : structuredClone(DEFAULT_STATE.checklist);
  merged.contacts = Array.isArray(next?.contacts)
    ? next.contacts.map(item => ({
        label: String(item?.label || ''),
        value: String(item?.value || '')
      })).filter(item => item.label)
    : structuredClone(DEFAULT_STATE.contacts);
  merged.medicationTemplates = Array.isArray(next?.medicationTemplates)
    ? next.medicationTemplates.map(item => ({
        name: String(item?.name || ''),
        dose: String(item?.dose || ''),
        scheduled: String(item?.scheduled || ''),
        dueTime: String(item?.dueTime || ''),
        givenTime: String(item?.givenTime || ''),
        givenBy: String(item?.givenBy || ''),
        notes: String(item?.notes || '')
      }))
    : structuredClone(DEFAULT_STATE.medicationTemplates);

  const legacyHistory = Array.isArray(next?.milestoneHistory) ? next.milestoneHistory : [];
  const historyByName = new Map();
  for (const entry of legacyHistory) {
    const name = String(entry?.name || '').trim();
    if (!name) continue;
    if (!historyByName.has(name)) historyByName.set(name, []);
    historyByName.get(name).push(normalizeMilestoneHistoryEntry(entry));
  }

  merged.milestoneTemplates = Array.isArray(next?.milestoneTemplates)
    ? next.milestoneTemplates.map(item => normalizeMilestone(item, historyByName))
    : structuredClone(DEFAULT_STATE.milestoneTemplates);
  merged.milestoneTemplates = merged.milestoneTemplates.filter(item => item && item.name);
  delete merged.milestoneHistory;
  merged.dailyLog = Array.isArray(next?.dailyLog)
    ? next.dailyLog.map(item => ({
        when: normalizeLogTime(item?.when),
        status: String(item?.status || '').trim(),
        details: String(item?.details || '').trim()
      })).filter(item => item.when || item.status || item.details)
    : [];
  merged.meds = Array.isArray(next?.meds) ? next.meds : [];
  merged.timeline = Array.isArray(next?.timeline) ? next.timeline : structuredClone(DEFAULT_STATE.timeline);
  merged.equipment = Array.isArray(next?.equipment) ? next.equipment : structuredClone(DEFAULT_STATE.equipment);
  merged.notes = Array.isArray(next?.notes) ? next.notes : [];
  merged.activityLog = Array.isArray(next?.activityLog) ? next.activityLog : [];
  merged.surgeryDate = typeof next?.surgeryDate === 'string' ? next.surgeryDate : SURGERY_DATE;
  delete merged.todayTasks;
  return merged;
}

function normalizeMilestone(item, historyByName) {
  const name = String(item?.name ?? item ?? '').trim();
  if (!name) return null;
  const history = Array.isArray(item?.history)
    ? item.history.map(normalizeMilestoneHistoryEntry).filter(entry => entry.at)
    : (historyByName.get(name) || []);
  return {
    name,
    completed: Boolean(item?.completed ?? history.at(-1)?.action === 'completed'),
    history
  };
}

function normalizeMilestoneHistoryEntry(entry) {
  return {
    action: entry?.action === 'uncompleted' ? 'uncompleted' : 'completed',
    at: String(entry?.at || '')
  };
}

function normalizeLogTime(value) {
  if (!value) return '';
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString();
}

function stamp(text, type) {
  return { text, type, at: new Date().toISOString() };
}

function recoveryDay() {
  const now = new Date();
  const surgery = new Date(`${state.surgeryDate}T12:00:00`);
  const diff = Math.floor((now - surgery) / 86400000);
  return Math.max(0, diff + 1);
}

function countdownText() {
  const now = new Date();
  const surgery = new Date(`${state.surgeryDate}T12:00:00`);
  const diff = Math.ceil((surgery - now) / 86400000);
  if (diff > 1) return `${diff} days`;
  if (diff === 1) return 'Tomorrow';
  if (diff === 0) return 'Today';
  return `${Math.abs(diff)} days post-op`;
}

function render() {
  els.surgeryDate.value = state.surgeryDate || SURGERY_DATE;
  els.day.textContent = `Day ${recoveryDay()}`;
  els.countdown.textContent = countdownText();
  renderContactsForm();
  renderMedicationForm();
  renderMilestones();
  renderCaregiverLog();
  els.today.innerHTML = renderTodayTasks();
  els.checklist.innerHTML = state.checklist.map(renderChecklist).join('');
  els.nextTask.innerHTML = renderNextTask();
  els.followUpSummary.innerHTML = `<div class="summary-text">${escapeHtml(buildFollowUpSummary())}</div>`;
  els.activity.innerHTML = state.activityLog.length ? state.activityLog.slice().reverse().map(renderEntry).join('') : empty('No activity logged yet.');
  els.equipment.innerHTML = state.equipment.map(item => `
    <div class="item">
      <div class="item-head">
        <strong>${escapeHtml(item.text)}</strong>
        <span class="tag">${item.ready ? 'Ready' : 'Pending'}</span>
      </div>
    </div>`).join('');
  els.notes.innerHTML = state.notes.length ? state.notes.slice().reverse().map(renderEntry).join('') : empty('No notes yet.');
}

function renderChecklist(item, index) {
  return `
    <label>
      <input type="checkbox" data-check="${index}" ${item.done ? 'checked' : ''} />
      <span>${escapeHtml(item.id)}</span>
      <span class="time">${item.at ? formatTime(item.at) : 'Not done'}</span>
    </label>
  `;
}

function renderNextTask() {
  const next = state.checklist.find(item => !item.done);
  if (next) {
    return `
      <div class="item-head">
        <strong>${escapeHtml(next.id)}</strong>
        <span class="tag">Do next</span>
      </div>
      <p class="small">Use this as the next recovery action. Mark it done when complete.</p>
    `;
  }
  return `
    <div class="item-head">
      <strong>All checklist items complete</strong>
      <span class="tag">Good</span>
    </div>
    <p class="small">Add the next event, note, or follow-up as needed.</p>
  `;
}

function renderContactsForm() {
  els.contactsForm.innerHTML = state.contacts.map((item, index) => `
    <label>
      <span>${escapeHtml(item.label)}</span>
      <input data-contact-index="${index}" data-contact-field="value" value="${escapeHtml(item.value)}" />
    </label>
  `).join('');
}

function renderMedicationForm() {
  els.medicationForm.innerHTML = state.medicationTemplates.map((item, index) => `
    <label>
      <span>Medication name</span>
      <input data-med-index="${index}" data-med-field="name" value="${escapeHtml(item.name)}" placeholder="Medication name" />
      <span>Dose / instructions</span>
      <textarea data-med-index="${index}" data-med-field="dose" rows="3" placeholder="Use discharge instructions">${escapeHtml(item.dose)}</textarea>
      <span class="small">Store instructions exactly as Brent enters them. No dosing advice is generated here.</span>
      <span>Scheduled or PRN</span>
      <input data-med-index="${index}" data-med-field="scheduled" value="${escapeHtml(item.scheduled)}" placeholder="Scheduled or PRN" />
      <span>Due time</span>
      <input data-med-index="${index}" data-med-field="dueTime" value="${escapeHtml(item.dueTime)}" placeholder="TBD" />
      <span>Given time</span>
      <input data-med-index="${index}" data-med-field="givenTime" value="${escapeHtml(item.givenTime)}" />
      <span>Given by</span>
      <input data-med-index="${index}" data-med-field="givenBy" value="${escapeHtml(item.givenBy)}" />
      <span>Notes</span>
      <textarea data-med-index="${index}" data-med-field="notes" rows="3">${escapeHtml(item.notes)}</textarea>
    </label>
  `).join('');
}

function renderMilestones() {
  els.milestones.innerHTML = state.milestoneTemplates.map((item, index) => {
    const history = Array.isArray(item.history) ? item.history : [];
    const latest = history.at(-1);
    const isComplete = Boolean(item.completed);
    return `
      <div class="item milestone-card">
        <div class="item-head">
          <label class="milestone-name">
            <span>Milestone name</span>
            <input data-milestone-index="${index}" data-milestone-field="name" value="${escapeHtml(item.name)}" placeholder="Milestone name" />
          </label>
          <span class="tag">${isComplete ? 'Complete' : 'Open'}</span>
        </div>
        <div class="section-actions">
          <button type="button" class="ghost" data-milestone-toggle="${index}">${isComplete ? 'Mark incomplete' : 'Mark complete'}</button>
        </div>
        <div class="stack milestone-history">
          ${history.length ? history.slice().reverse().map(entry => `
            <div class="contact-item">
              <strong>${escapeHtml(entry.action === 'completed' ? 'Completed' : 'Uncompleted')}</strong>
              <span class="small">${escapeHtml(formatTime(entry.at))}</span>
            </div>
          `).join('') : '<div class="small">No history yet.</div>'}
          ${latest ? `<div class="small">Latest change: ${escapeHtml(latest.action)} at ${escapeHtml(formatTime(latest.at))}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderCaregiverLog() {
  els.caregiverLog.innerHTML = state.dailyLog.length ? state.dailyLog.map((item, index) => `
    <div class="log-row">
      <label class="log-cell">
        <span>When</span>
        <input type="datetime-local" data-log-index="${index}" data-log-field="when" value="${escapeHtml(toDatetimeLocalValue(item.when))}" />
      </label>
      <label class="log-cell">
        <span>Status</span>
        <input data-log-index="${index}" data-log-field="status" value="${escapeHtml(item.status)}" placeholder="Medication, mood, fasting" />
      </label>
      <label class="log-cell">
        <span>Details</span>
        <textarea data-log-index="${index}" data-log-field="details" rows="3" placeholder="Enter the update">${escapeHtml(item.details)}</textarea>
      </label>
      <div class="log-controls">
        <button type="button" class="ghost" data-log-remove="${index}">Delete</button>
      </div>
    </div>
  `).join('') : '<div class="item muted">No caregiver log entries yet. Add a daily update here.</div>';
}

function renderTodayTasks() {
  const tasks = deriveTodayTasks();
  return tasks.map(task => `<div class="item">${escapeHtml(task)}</div>`).join('');
}

function deriveTodayTasks() {
  const tasks = ['Recovery medication check', 'Hydration', 'Walk', 'Ice & compression', 'Exercises', 'Rest & elevate'];
  const completed = new Set(state.checklist.filter(item => item.done).map(item => item.id));
  return tasks.filter(task => !completed.has(task));
}

function buildFollowUpSummary() {
  const completed = state.checklist.filter(item => item.done).length;
  const total = state.checklist.length;
  const surgery = state.surgeryDate || SURGERY_DATE;
  const pending = state.checklist.filter(item => !item.done).slice(0, 4).map(item => `- ${item.id}`).join('\n');
  const recent = state.activityLog.slice(-5).map(item => `- ${item.type || 'Entry'}: ${item.text}`).join('\n');
  const recentLog = state.dailyLog.slice(-3).map(item => {
    const when = formatDateTime(item.when) || 'No time';
    const status = item.status || 'Log';
    const details = item.details || 'No details';
    return `- ${when}: ${status} - ${details}`;
  }).join('\n');
  return [
    `Surgery date: ${surgery}`,
    `Recovery day: Day ${recoveryDay()}`,
    `Checklist: ${completed}/${total} complete`,
    `Next task: ${state.checklist.find(item => !item.done)?.id || 'All checklist items complete'}`,
    `Pending checklist:`,
    pending || '- None',
    `Recent caregiver log:`,
    recentLog || '- No caregiver log entries yet',
    `Recent activity:`,
    recent || '- No recent activity'
  ].join('\n');
}

function renderEntry(entry) {
  return `
    <article class="item">
      <div class="item-head">
        <strong>${escapeHtml(entry.type || 'Entry')}</strong>
        <span class="time">${formatTime(entry.at)}</span>
      </div>
      <p class="small">${escapeHtml(entry.text)}</p>
    </article>
  `;
}

function empty(text) {
  return `<div class="item muted">${escapeHtml(text)}</div>`;
}

function formatTime(value) {
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? '' : new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(dt);
}

function formatDateTime(value) {
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? '' : new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(dt);
}

function toDatetimeLocalValue(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  const offset = dt.getTimezoneOffset();
  const local = new Date(dt.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function normalizeLogTime(value) {
  if (!value) return '';
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString();
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

els.surgeryDate.addEventListener('change', () => {
  state.surgeryDate = els.surgeryDate.value || SURGERY_DATE;
  saveState();
  render();
});

els.checklist.addEventListener('change', (event) => {
  const input = event.target.closest('[data-check]');
  if (!input) return;
  const index = Number(input.dataset.check);
  const item = state.checklist[index];
  if (!item) return;
  item.done = input.checked;
  item.at = input.checked ? new Date().toISOString() : null;
  state.activityLog.push(stamp(`${item.id} ${input.checked ? 'completed' : 'unchecked'}`, 'Checklist'));
  saveState();
  render();
});

function persistAndRender() {
  saveState();
  render();
}

els.contactsForm.addEventListener('input', event => {
  const target = event.target.closest('[data-contact-index][data-contact-field]');
  if (!target) return;
  const index = Number(target.dataset.contactIndex);
  const item = state.contacts[index];
  if (!item) return;
  item[target.dataset.contactField] = target.value;
});

els.medicationForm.addEventListener('input', event => {
  const target = event.target.closest('[data-med-index][data-med-field]');
  if (!target) return;
  const index = Number(target.dataset.medIndex);
  const item = state.medicationTemplates[index];
  if (!item) return;
  const field = target.dataset.medField;
  item[field] = target.value;
});

els.milestones.addEventListener('input', event => {
  const target = event.target.closest('[data-milestone-index][data-milestone-field]');
  if (!target) return;
  const index = Number(target.dataset.milestoneIndex);
  const item = state.milestoneTemplates[index];
  if (!item) return;
  item.name = target.value;
});

els.caregiverLog.addEventListener('input', event => {
  const target = event.target.closest('[data-log-index][data-log-field]');
  if (!target) return;
  const index = Number(target.dataset.logIndex);
  const item = state.dailyLog[index];
  if (!item) return;
  const field = target.dataset.logField;
  item[field] = field === 'when' ? normalizeLogTime(target.value) : target.value;
});

els.contactsForm.addEventListener('blur', persistAndRender, true);
els.medicationForm.addEventListener('blur', persistAndRender, true);
els.milestones.addEventListener('blur', persistAndRender, true);
els.caregiverLog.addEventListener('blur', persistAndRender, true);

els.saveContacts.addEventListener('click', persistAndRender);
els.saveMedications.addEventListener('click', persistAndRender);
els.addLogEntry.addEventListener('click', () => {
  state.dailyLog.unshift({
    when: new Date().toISOString(),
    status: '',
    details: ''
  });
  persistAndRender();
});

els.caregiverLog.addEventListener('click', event => {
  const button = event.target.closest('[data-log-remove]');
  if (!button) return;
  const index = Number(button.dataset.logRemove);
  if (!Number.isFinite(index)) return;
  state.dailyLog.splice(index, 1);
  persistAndRender();
});

els.addMilestone.addEventListener('click', () => {
  const name = window.prompt('Milestone name');
  if (!name) return;
  state.milestoneTemplates.push({
    name: name.trim(),
    completed: false,
    history: []
  });
  persistAndRender();
});

els.milestones.addEventListener('click', event => {
  const button = event.target.closest('[data-milestone-toggle]');
  if (!button) return;
  const index = Number(button.dataset.milestoneToggle);
  const item = state.milestoneTemplates[index];
  if (!item) return;
  item.completed = !item.completed;
  item.history.push({
    action: item.completed ? 'completed' : 'uncompleted',
    at: new Date().toISOString()
  });
  persistAndRender();
});

els.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(els.form);
  const type = formData.get('type');
  const text = String(formData.get('text') || '').trim();
  if (!text) return;
  const entry = stamp(text, type);
  state.activityLog.push(entry);
  if (type === 'medication') state.meds.push({ ...entry, type: 'Medication' });
  else if (type === 'walk') state.timeline.push({ ...entry, type: 'Walk' });
  else if (type === 'ice') state.timeline.push({ ...entry, type: 'Cold therapy' });
  else if (type === 'meal') state.timeline.push({ ...entry, type: 'Meal' });
  else if (type === 'sleep') state.timeline.push({ ...entry, type: 'Sleep' });
  else if (type === 'equipment') state.equipment.push({ text, ready: false });
  else if (type === 'note') state.notes.push({ ...entry, type: 'Note' });
  else state.timeline.push({ ...entry, type: 'Timeline' });
  saveState();
  els.form.reset();
  render();
});

els.reset.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(DEFAULT_STATE);
  saveState();
  render();
});

els.exportJson.addEventListener('click', exportState);
els.exportCsv = document.getElementById('export-csv');
els.exportCsv.addEventListener('click', exportCsv);

els.copySummary.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(buildFollowUpSummary());
    els.copySummary.textContent = 'Copied';
    setTimeout(() => { els.copySummary.textContent = 'Copy'; }, 1200);
  } catch (error) {
    alert('Copy failed. Your browser may block clipboard access.');
    console.error(error);
  }
});

els.printSummary.addEventListener('click', () => {
  window.print();
});

els.importJson.addEventListener('change', async () => {
  const file = els.importJson.files && els.importJson.files[0];
  if (!file) return;
  try {
    await importState(file);
  } catch (error) {
    alert('Import failed. Check that the file is valid JSON.');
    console.error(error);
  } finally {
    els.importJson.value = '';
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(error => {
    console.warn('Service worker registration failed', error);
  });
}

render();