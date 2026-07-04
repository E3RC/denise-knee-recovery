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

const SAMPLE = {
  surgeryDate: SURGERY_DATE,
  todayTasks: [
    'Recovery medication check',
    'Hydration',
    'Walk',
    'Ice & compression',
    'Exercises',
    'Rest & elevate'
  ],
  meds: [],
  timeline: [
    { type: 'Surgery day', text: 'Surgery scheduled for Monday morning.', at: new Date().toISOString() }
  ],
  equipment: [
    { text: 'Drive Medical 10210-1 walker', ready: true },
    { text: 'Pulsar Flow automated cold therapy', ready: true },
    { text: 'Built-in shower seat', ready: true },
    { text: 'Elevated bidet toilet seats', ready: true }
  ],
  notes: [],
  activityLog: [],
  checklist: CHECKLIST.map(id => ({ id, done: false, at: null }))
};

const els = {
  day: document.getElementById('recovery-day'),
  countdown: document.getElementById('countdown'),
  surgeryDate: document.getElementById('surgery-date'),
  today: document.getElementById('today-list'),
  checklist: document.getElementById('checklist'),
  activity: document.getElementById('activity'),
  meds: document.getElementById('med-log'),
  timeline: document.getElementById('timeline'),
  equipment: document.getElementById('equipment'),
  notes: document.getElementById('notes'),
  nextTask: document.getElementById('next-task'),
  followUpSummary: document.getElementById('follow-up-summary'),
  form: document.getElementById('event-form'),
  reset: document.getElementById('reset-demo'),
  exportJson: document.getElementById('export-json'),
  importJson: document.getElementById('import-json'),
  copySummary: document.getElementById('copy-summary')
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...SAMPLE, ...JSON.parse(raw) };
  } catch {}
  return structuredClone(SAMPLE);
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

async function importState(file) {
  const text = await file.text();
  const next = JSON.parse(text);
  state = normalizeState(next);
  saveState();
  render();
}

function normalizeState(next) {
  const merged = { ...structuredClone(SAMPLE), ...next };
  merged.checklist = Array.isArray(next?.checklist) ? next.checklist : structuredClone(SAMPLE.checklist);
  merged.todayTasks = Array.isArray(next?.todayTasks) ? next.todayTasks : structuredClone(SAMPLE.todayTasks);
  merged.meds = Array.isArray(next?.meds) ? next.meds : [];
  merged.timeline = Array.isArray(next?.timeline) ? next.timeline : [];
  merged.equipment = Array.isArray(next?.equipment) ? next.equipment : structuredClone(SAMPLE.equipment);
  merged.notes = Array.isArray(next?.notes) ? next.notes : [];
  merged.activityLog = Array.isArray(next?.activityLog) ? next.activityLog : [];
  merged.surgeryDate = typeof next?.surgeryDate === 'string' ? next.surgeryDate : SURGERY_DATE;
  return merged;
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
  els.today.innerHTML = state.todayTasks.map(task => `<div class="item">${escapeHtml(task)}</div>`).join('');
  els.checklist.innerHTML = state.checklist.map(renderChecklist).join('');
  els.nextTask.innerHTML = renderNextTask();
  els.followUpSummary.innerHTML = `<div class="summary-text">${escapeHtml(buildFollowUpSummary())}</div>`;
  els.activity.innerHTML = state.activityLog.length ? state.activityLog.slice().reverse().map(renderEntry).join('') : empty('No activity logged yet.');
  els.meds.innerHTML = state.meds.length ? state.meds.map(renderEntry).join('') : empty('No medication entries yet.');
  els.timeline.innerHTML = state.timeline.length ? state.timeline.slice().reverse().map(renderEntry).join('') : empty('No timeline entries yet.');
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

function buildFollowUpSummary() {
  const completed = state.checklist.filter(item => item.done).length;
  const total = state.checklist.length;
  const surgery = state.surgeryDate || SURGERY_DATE;
  const recent = state.activityLog.slice(-5).map(item => `- ${item.type || 'Entry'}: ${item.text}`).join('\n');
  return [
    `Surgery date: ${surgery}`,
    `Recovery day: Day ${recoveryDay()}`,
    `Checklist: ${completed}/${total} complete`,
    `Next task: ${state.checklist.find(item => !item.done)?.id || 'All checklist items complete'}`,
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

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
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
  state = structuredClone(SAMPLE);
  saveState();
  render();
});

els.exportJson.addEventListener('click', exportState);

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

render();