const STORAGE_KEY = 'denise-recovery-phase1';
const DASHBOARD_STATE_URL = '/api/dashboard-state';
const SURGERY_DATE = '2026-07-06';
const DISPLAY_TIMEZONE = 'America/Indiana/Indianapolis';
const RECOVERY_FRAMEWORK = {
  phases: [
    {
      key: 'surgery-day',
      label: 'Surgery day',
      dayStart: 1,
      dayEnd: 1,
      summary: 'Focus on arrival, discharge, comfort, first movement, hydration, and a calm handoff home.',
      checklist: [
        'Comfort check',
        'Hydration',
        'Walk',
        'Ice & compression',
        'Meals',
        'Rest & elevate',
        'Caregiver log'
      ],
      nextTaskHelp: 'Keep updates short, keep the leg elevated, and log the first successful walk and home arrival.'
    },
    {
      key: 'early-home-recovery',
      label: 'Early home recovery',
      dayStart: 2,
      dayEnd: 7,
      summary: 'Short frequent walks, regular icing, daily exercises, bowel tracking, incision watching, and steady hydration.',
      checklist: [
        'Morning medication check',
        'Breakfast / hydration',
        'Walk',
        'Exercises',
        'Ice & compression',
        'Lunch / hydration',
        'Incision check',
        'Dinner / hydration',
        'Evening recovery log'
      ],
      nextTaskHelp: 'The packet guidance is short frequent walking, daily exercises, icing, elevation, and watching for redness, drainage, fever, or calf pain.'
    },
    {
      key: 'week-two',
      label: 'Week 2',
      dayStart: 8,
      dayEnd: 14,
      summary: 'Keep the same recovery rhythm while increasing confidence, logging milestones, and preparing for follow-up.',
      checklist: [
        'Morning medication check',
        'Breakfast / hydration',
        'Walk',
        'Exercises',
        'Ice & elevation',
        'Lunch / hydration',
        'Milestone check',
        'Dinner / hydration',
        'Evening recovery log'
      ],
      nextTaskHelp: 'Keep exercise consistent even on harder days, and bring milestone progress and questions into PT or surgeon follow-up.'
    },
    {
      key: 'weeks-three-to-six',
      label: 'Weeks 3 to 6',
      dayStart: 15,
      dayEnd: 42,
      summary: 'Progress the rehab routine, keep watching swelling and incision changes, and avoid rushing heavier activity.',
      checklist: [
        'Morning recovery check',
        'Hydration',
        'Walk',
        'Exercises',
        'Pain / swelling check',
        'Meals',
        'Milestone check',
        'Evening recovery log'
      ],
      nextTaskHelp: 'The packet still limits heavy lifting, strenuous yard work, and twisting or running unless the surgeon clears it.'
    },
    {
      key: 'longer-recovery',
      label: 'Longer recovery',
      dayStart: 43,
      dayEnd: 9999,
      summary: 'Track milestones, activity tolerance, swelling, and follow-up questions as function gradually returns.',
      checklist: [
        'Morning recovery check',
        'Hydration',
        'Walk',
        'Exercises',
        'Milestone check',
        'Evening recovery log'
      ],
      nextTaskHelp: 'Expect improvement to keep building over months, not just days, and keep logging anything new or concerning.'
    }
  ],
  redFlags: [
    'Fever above 101',
    'Incision drainage, odor, or wound opening',
    'Bright red blood from the incision',
    'Calf or groin pain',
    'Excessive redness, warmth, or pus',
    'Pain not controlled with ice, elevation, rest, and medication'
  ]
};

const WORKFLOW_ROLES = [
  {
    name: 'Project manager',
    description: 'Keeps the recovery phase, priority order, and documentation aligned.',
    focus: ['Next implementation step', 'Public/private separation', 'Current recovery phase']
  },
  {
    name: 'Backup nurse',
    description: 'Checks medication timing, reminder coverage, and overdue alerts.',
    focus: ['Next dose timers', 'Spirometer reminders', 'Vitals and safety gaps']
  }
];

const QUICK_CHECKS = [
  {
    id: 'med-check',
    label: 'Medication check',
    note: 'Medication schedule reviewed or medication given per instructions.',
    checklistMatches: ['Morning medication check']
  },
  {
    id: 'hydration-check',
    label: 'Hydration',
    note: 'Hydration offered and checked.',
    checklistMatches: ['Hydration', 'Breakfast / hydration', 'Lunch / hydration', 'Dinner / hydration']
  },
  {
    id: 'walk-check',
    label: 'Walk done',
    note: 'Short walk completed.',
    checklistMatches: ['Walk']
  },
  {
    id: 'exercise-check',
    label: 'Exercises',
    note: 'Exercise block completed.',
    checklistMatches: ['Exercises']
  },
  {
    id: 'ice-check',
    label: 'Ice and elevate',
    note: 'Ice and elevation session completed.',
    checklistMatches: ['Ice & compression', 'Ice & elevation']
  },
  {
    id: 'meal-check',
    label: 'Meal',
    note: 'Meal or snack completed.',
    checklistMatches: ['Meals']
  },
  {
    id: 'incision-check',
    label: 'Incision check',
    note: 'Incision checked with no urgent concern noted.',
    checklistMatches: ['Incision check']
  },
  {
    id: 'rest-check',
    label: 'Rest and elevate',
    note: 'Rest and elevation check completed.',
    checklistMatches: ['Rest & elevate']
  },
  {
    id: 'bowel-check',
    label: 'Bowel check',
    note: 'Bowel activity or constipation status reviewed.',
    checklistMatches: []
  }
];

// Seed/default content stays separate from user-entered logs so the state can
// grow without turning the dashboard into one giant mixed object.
const SEED = {
  patient: {
    name: 'Denise',
    caregiver: 'Brent Soper',
    procedure: 'Total knee replacement',
    surgeryDate: SURGERY_DATE,
    walkerDetails: 'Drive Medical 10210-1 walker with front wheels',
    surgeryLocation: '',
    weightBearing: '',
    followUpDate: ''
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
      dose: '',
      purpose: '',
      instructions: 'Use discharge instructions exactly as written.',
      scheduled: 'Scheduled',
      intervalHours: '',
      dueTime: 'TBD',
      startRule: '',
      stopRule: '',
      ruleKey: '',
      lastGivenAt: '',
      nextDueAt: '',
      givenTime: '',
      givenBy: '',
      notes: 'Neutral placeholder until Brent adds actual bottle details.'
    }
  ],
  photoLog: [],
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
    checklistPhaseKey: '',
    quickChecks: [],
    contacts: structuredClone(SEED.contacts),
    medicationTemplates: structuredClone(SEED.medicationTemplates),
    photoLog: [],
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
    checklist: []
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
  workflowRoles: document.getElementById('workflow-roles'),
  photoLog: document.getElementById('photo-log'),
  contactsForm: document.getElementById('contacts-form'),
  patientForm: document.getElementById('patient-form'),
  milestones: document.getElementById('milestones'),
  nextTask: document.getElementById('next-task'),
  followUpSummary: document.getElementById('follow-up-summary'),
  savePatient: document.getElementById('save-patient'),
  saveContacts: document.getElementById('save-contacts'),
  addPhotoLog: document.getElementById('add-photo-log'),
  addLogEntry: document.getElementById('add-log-entry'),
  quickMedicationLog: document.getElementById('quick-medication-log'),
  quickAnxietyLog: document.getElementById('quick-anxiety-log'),
  quickFastingLog: document.getElementById('quick-fasting-log'),
  quickCheckGrid: document.getElementById('quick-check-grid'),
  resetQuickChecks: document.getElementById('reset-quick-checks'),
  addMilestone: document.getElementById('add-milestone'),
  form: document.getElementById('event-form'),
  reset: document.getElementById('reset-demo'),
  exportJson: document.getElementById('export-json'),
  importJson: document.getElementById('import-json'),
  logout: document.getElementById('logout'),
  copySummary: document.getElementById('copy-summary'),
  printSummary: document.getElementById('print-summary')
};

let state = structuredClone(DEFAULT_STATE);

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch {}
  return structuredClone(DEFAULT_STATE);
}

async function syncRemoteState() {
  try {
    const response = await fetch(DASHBOARD_STATE_URL, { cache: 'no-store' });
    if (!response.ok) return;
    state = normalizeState(await response.json());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
  } catch {}
}

async function persistRemoteState() {
  try {
    await fetch(DASHBOARD_STATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(state)
    });
  } catch {}
}

function saveState(syncRemote = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (syncRemote) {
    void persistRemoteState();
  }
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
      ...state.photoLog.map(item => [
        'Photo log',
        item.when || '',
        [item.label, item.fileRef, item.storage, item.circumference, item.swelling, item.bruising, item.incision, item.rom, item.notes]
          .filter(Boolean)
          .join(' | ')
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
  merged.checklistPhaseKey = typeof next?.checklistPhaseKey === 'string' ? next.checklistPhaseKey : '';
  merged.quickChecks = Array.isArray(next?.quickChecks)
    ? next.quickChecks.map(item => ({
        id: String(item?.id || ''),
        at: normalizeLogTime(item?.at)
      })).filter(item => item.id)
    : [];
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
        purpose: String(item?.purpose || ''),
        instructions: String(item?.instructions || ''),
        scheduled: String(item?.scheduled || ''),
        intervalHours: String(item?.intervalHours || ''),
        dueTime: String(item?.dueTime || ''),
        startRule: String(item?.startRule || ''),
        stopRule: String(item?.stopRule || ''),
        ruleKey: String(item?.ruleKey || ''),
        lastGivenAt: String(item?.lastGivenAt || ''),
        nextDueAt: String(item?.nextDueAt || ''),
        givenTime: String(item?.givenTime || ''),
        givenBy: String(item?.givenBy || ''),
        notes: String(item?.notes || '')
      }))
    : structuredClone(DEFAULT_STATE.medicationTemplates);
  merged.photoLog = Array.isArray(next?.photoLog)
    ? next.photoLog.map(item => ({
        when: normalizeLogTime(item?.when),
        label: String(item?.label || '').trim(),
        fileRef: String(item?.fileRef || '').trim(),
        storage: String(item?.storage || '').trim(),
        circumference: String(item?.circumference || '').trim(),
        swelling: String(item?.swelling || '').trim(),
        bruising: String(item?.bruising || '').trim(),
        incision: String(item?.incision || '').trim(),
        rom: String(item?.rom || '').trim(),
        notes: String(item?.notes || '').trim()
      })).filter(item => item.when || item.label || item.fileRef || item.storage || item.circumference || item.swelling || item.bruising || item.incision || item.rom || item.notes)
    : [];

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

function currentPhase() {
  const day = recoveryDay();
  return RECOVERY_FRAMEWORK.phases.find(phase => day >= phase.dayStart && day <= phase.dayEnd) || RECOVERY_FRAMEWORK.phases.at(-1);
}

function syncChecklistForPhase() {
  const phase = currentPhase();
  if (!phase) return false;
  if (state.checklistPhaseKey === phase.key && Array.isArray(state.checklist) && state.checklist.length) {
    return false;
  }

  const existing = new Map((state.checklist || []).map(item => [item.id, item]));
  state.checklist = phase.checklist.map(id => {
    const saved = existing.get(id);
    return saved ? { id, done: Boolean(saved.done), at: saved.at || null } : { id, done: false, at: null };
  });
  state.checklistPhaseKey = phase.key;
  return true;
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
  const phaseChanged = syncChecklistForPhase();
  const phase = currentPhase();
  if (phaseChanged) {
    saveState(false);
  }
  if (els.surgeryDate) els.surgeryDate.value = state.surgeryDate || SURGERY_DATE;
  els.day.textContent = `Day ${recoveryDay()}`;
  els.countdown.textContent = countdownText();
  renderPainBadge();
  renderNextMeds();
  renderMedicationsList();
  renderQuickChecks();
  els.today.innerHTML = renderTodayTasks();
  renderContactsForm();
  renderCaregiverLog();
  els.activity.innerHTML = state.activityLog.length ? state.activityLog.slice().reverse().map(renderEntry).join('') : empty('No activity logged yet.');
  els.notes.innerHTML = state.notes.length ? state.notes.slice().reverse().map(renderEntry).join('') : empty('');
  els.checklist.innerHTML = state.checklist.map(renderChecklist).join('');
  els.nextTask.innerHTML = renderNextTask(phase);
  els.followUpSummary.innerHTML = `<div class="summary-text">${escapeHtml(buildFollowUpSummary())}</div>`;
  renderPatientForm();
  renderPhotoLog();
  renderMilestones();
  els.equipment.innerHTML = state.equipment.map(item => `
    <div class="item">
      <div class="item-head">
        <strong>${escapeHtml(item.text)}</strong>
        <span class="tag">${item.ready ? 'Ready' : 'Pending'}</span>
      </div>
    </div>`).join('');
  if (els.workflowRoles) {
    els.workflowRoles.innerHTML = WORKFLOW_ROLES.map(role => `
      <article class="item">
        <div class="item-head">
          <strong>${escapeHtml(role.name)}</strong>
          <span class="tag">Active role</span>
        </div>
        <p class="small">${escapeHtml(role.description)}</p>
        <p class="small">${escapeHtml(role.focus.join(' · '))}</p>
      </article>
    `).join('');
  }
}

function renderPainBadge() {
  var badge = document.getElementById('pain-badge');
  if (!badge) return;
  var logs = state.activityLog || [];
  var lastPain = null;
  for (var i = logs.length - 1; i >= 0; i--) {
    if (logs[i].type === 'Pain score') { lastPain = logs[i]; break; }
  }
  if (lastPain) {
    badge.textContent = lastPain.text.replace('Pain score: ', '').replace('Pain score:', '');
    badge.style.color = '';
  } else {
    badge.textContent = '--';
    badge.style.color = 'var(--muted)';
  }
}

function renderNextMeds() {
  var container = document.getElementById('next-meds-list');
  if (!container) return;
  var meds = state.medicationTemplates || [];
  var now = new Date();
  var items = [];
  meds.forEach(function(m) {
    if (!m.lastGivenAt && !m.nextDueAt) return;
    var name = m.name || '';
    var nextAt = m.nextDueAt ? new Date(m.nextDueAt) : null;
    var cls = '';
    var label = '';
    if (nextAt) {
      var diffMs = nextAt - now;
      var diffMin = Math.round(diffMs / 60000);
      if (diffMs < 0) { cls = 'overdue'; label = 'Overdue ' + Math.abs(diffMin) + 'm ago'; }
      else if (diffMin < 60) { cls = 'soon'; label = 'Due in ' + diffMin + 'm'; }
      else { label = 'Next: ' + nextAt.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}); }
    }
    var disp = m.dispensed ? ' &#10003;' : '';
    items.push('<div class="med-timer"><span class="med-name">' + escapeHtml(name) + disp + '</span><span class="med-due ' + cls + '">' + escapeHtml(label) + '</span></div>');
  });
  container.innerHTML = items.length ? items.join('') : '<p class="small" style="color:var(--muted)">No medication timers active.</p>';
}

function renderMedicationsList() {
  var container = document.getElementById('medications-list');
  if (!container) return;
  var meds = state.medicationTemplates || [];
  container.innerHTML = meds.map(function(m) {
    var name = m.name || 'Unnamed';
    var dose = m.dose || '';
    var last = m.lastGivenAt ? new Date(m.lastGivenAt).toLocaleString() : 'Not yet';
    var nextDue = m.nextDueAt ? new Date(m.nextDueAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) : '--';
    return '<div class="item" style="padding:10px 0;border-bottom:1px solid var(--line)">' +
      '<div class="item-head"><strong>' + escapeHtml(name) + '</strong> <span class="tag">' + escapeHtml(dose) + '</span></div>' +
      '<div class="small">Last: ' + escapeHtml(last) + ' | Next: ' + escapeHtml(nextDue) + '</div>' +
      (m.notes ? '<div class="small" style="color:var(--muted)">' + escapeHtml(m.notes.slice(-100)) + '</div>' : '') +
      '</div>';
  }).join('') || '<p class="small">No medications configured.</p>';
}

function renderPatientForm() {
  const patient = state.patient || DEFAULT_STATE.patient;
  els.patientForm.innerHTML = `
    <label>
      <span>Patient</span>
      <input data-patient-field="name" value="${escapeHtml(patient.name || '')}" placeholder="Patient name" />
    </label>
    <label>
      <span>Caregiver</span>
      <input data-patient-field="caregiver" value="${escapeHtml(patient.caregiver || '')}" placeholder="Primary caregiver" />
    </label>
    <label>
      <span>Procedure</span>
      <input data-patient-field="procedure" value="${escapeHtml(patient.procedure || '')}" placeholder="Procedure" />
    </label>
    <label>
      <span>Walker / mobility setup</span>
      <input data-patient-field="walkerDetails" value="${escapeHtml(patient.walkerDetails || '')}" placeholder="Walker and mobility details" />
    </label>
    <label>
      <span>Surgery location</span>
      <input data-patient-field="surgeryLocation" value="${escapeHtml(patient.surgeryLocation || '')}" placeholder="Hospital or surgery center" />
    </label>
    <label>
      <span>Weight-bearing guidance</span>
      <input data-patient-field="weightBearing" value="${escapeHtml(patient.weightBearing || '')}" placeholder="Enter exact instruction" />
    </label>
    <label>
      <span>Follow-up date</span>
      <input type="date" data-patient-field="followUpDate" value="${escapeHtml(patient.followUpDate || '')}" />
    </label>
  `;
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

function renderQuickChecks() {
  const quickState = new Map((state.quickChecks || []).map(item => [item.id, item.at]));
  els.quickCheckGrid.innerHTML = QUICK_CHECKS.map(item => {
    const at = quickState.get(item.id);
    return `
      <button type="button" class="quick-check ${at ? 'is-done' : ''}" data-quick-check="${escapeHtml(item.id)}">
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <p class="small">${escapeHtml(item.note)}</p>
        </div>
        <span class="quick-check-status">${at ? `Logged ${escapeHtml(formatTime(at))}` : 'Tap to log'}</span>
      </button>
    `;
  }).join('');
}

function renderNextTask(phase) {
  const next = state.checklist.find(item => !item.done);
  if (next) {
    return `
      <div class="item-head">
        <strong>${escapeHtml(next.id)}</strong>
        <span class="tag">${escapeHtml(phase?.label || 'Do next')}</span>
      </div>
      <p class="small">${escapeHtml(phase?.nextTaskHelp || 'Use this as the next recovery action. Mark it done when complete.')}</p>
    `;
  }
  return `
    <div class="item-head">
      <strong>All checklist items complete</strong>
      <span class="tag">${escapeHtml(phase?.label || 'Good')}</span>
    </div>
    <p class="small">${escapeHtml(phase?.summary || 'Add the next event, note, or follow-up as needed.')}</p>
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

function renderPhotoLog() {
  els.photoLog.innerHTML = state.photoLog.length ? state.photoLog.map((item, index) => `
    <div class="photo-row">
      <label class="photo-cell">
        <span>When</span>
        <input type="datetime-local" data-photo-index="${index}" data-photo-field="when" value="${escapeHtml(toDatetimeLocalValue(item.when))}" />
      </label>
      <label class="photo-cell">
        <span>Label</span>
        <input data-photo-index="${index}" data-photo-field="label" value="${escapeHtml(item.label)}" placeholder="Before, after, or follow-up" />
      </label>
      <label class="photo-cell">
        <span>File reference</span>
        <input data-photo-index="${index}" data-photo-field="fileRef" value="${escapeHtml(item.fileRef)}" placeholder="Filename or path" />
      </label>
      <label class="photo-cell">
        <span>Storage location</span>
        <input data-photo-index="${index}" data-photo-field="storage" value="${escapeHtml(item.storage)}" placeholder="Private album, folder, or drive" />
      </label>
      <label class="photo-cell">
        <span>Circumference</span>
        <input data-photo-index="${index}" data-photo-field="circumference" value="${escapeHtml(item.circumference)}" placeholder="Measurement and unit" />
      </label>
      <label class="photo-cell">
        <span>Swelling</span>
        <input data-photo-index="${index}" data-photo-field="swelling" value="${escapeHtml(item.swelling)}" placeholder="Observed swelling" />
      </label>
      <label class="photo-cell">
        <span>Bruising</span>
        <input data-photo-index="${index}" data-photo-field="bruising" value="${escapeHtml(item.bruising)}" placeholder="Observed bruising" />
      </label>
      <label class="photo-cell">
        <span>Incision / scar</span>
        <input data-photo-index="${index}" data-photo-field="incision" value="${escapeHtml(item.incision)}" placeholder="Incision appearance" />
      </label>
      <label class="photo-cell">
        <span>ROM</span>
        <input data-photo-index="${index}" data-photo-field="rom" value="${escapeHtml(item.rom)}" placeholder="Range of motion note" />
      </label>
      <label class="photo-cell photo-notes">
        <span>Notes</span>
        <textarea data-photo-index="${index}" data-photo-field="notes" rows="3" placeholder="Any comparison notes">${escapeHtml(item.notes)}</textarea>
      </label>
      <div class="photo-controls">
        <button type="button" class="ghost" data-photo-remove="${index}">Delete</button>
      </div>
    </div>
  `).join('') : '<div class="item muted">No photo entries yet. Add the before photo baseline first.</div>';
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
  const phase = currentPhase();
  const tasks = phase?.checklist || [];
  const completed = new Set(state.checklist.filter(item => item.done).map(item => item.id));
  return tasks.filter(task => !completed.has(task));
}

function addOrUpdateQuickCheck(id) {
  const quick = QUICK_CHECKS.find(item => item.id === id);
  if (!quick) return;
  const now = new Date().toISOString();
  const existing = state.quickChecks.find(item => item.id === id);
  if (existing) existing.at = now;
  else state.quickChecks.push({ id, at: now });

  let matchedChecklist = null;
  for (const checklistId of quick.checklistMatches) {
    const item = state.checklist.find(entry => entry.id === checklistId && !entry.done);
    if (item) {
      item.done = true;
      item.at = now;
      matchedChecklist = item.id;
      break;
    }
  }

  state.dailyLog.unshift({
    when: now,
    status: quick.label,
    details: matchedChecklist ? `${quick.note} Checklist advanced: ${matchedChecklist}.` : quick.note
  });
  state.activityLog.push(stamp(`${quick.label} logged${matchedChecklist ? ` and marked ${matchedChecklist}` : ''}`, 'Quick check'));
  persistAndRender();
}

function buildFollowUpSummary() {
  const phase = currentPhase();
  const completed = state.checklist.filter(item => item.done).length;
  const total = state.checklist.length;
  const surgery = state.surgeryDate || SURGERY_DATE;
  const patient = state.patient || DEFAULT_STATE.patient;
  const pending = state.checklist.filter(item => !item.done).slice(0, 4).map(item => `- ${item.id}`).join('\n');
  const recent = state.activityLog.slice(-5).map(item => `- ${item.type || 'Entry'}: ${item.text}`).join('\n');
  const recentLog = state.dailyLog.slice(-3).map(item => {
    const when = formatDateTime(item.when) || 'No time';
    const status = item.status || 'Log';
    const details = item.details || 'No details';
    return `- ${when}: ${status} - ${details}`;
  }).join('\n');
  const recentPhotos = state.photoLog.slice(-3).map(item => {
    const when = formatDateTime(item.when) || 'No time';
    const label = item.label || 'Photo';
    const fileRef = item.fileRef || 'No file reference';
    return `- ${when}: ${label} (${fileRef})`;
  }).join('\n');
  return [
    `Patient: ${patient.name || 'Unknown'}`,
    `Caregiver: ${patient.caregiver || 'Unknown'}`,
    `Procedure: ${patient.procedure || 'Unknown'}`,
    `Walker setup: ${patient.walkerDetails || 'Not entered yet'}`,
    `Surgery date: ${surgery}`,
    `Weight-bearing: ${patient.weightBearing || 'Not entered yet'}`,
    `Follow-up date: ${patient.followUpDate || 'Not entered yet'}`,
    `Recovery day: Day ${recoveryDay()}`,
    `Recovery phase: ${phase?.label || 'Unknown'}`,
    `Checklist: ${completed}/${total} complete`,
    `Next task: ${state.checklist.find(item => !item.done)?.id || 'All checklist items complete'}`,
    `Phase guidance: ${phase?.summary || 'No current phase guidance'}`,
    `Pending checklist:`,
    pending || '- None',
    `Red flags to watch:`,
    ...RECOVERY_FRAMEWORK.redFlags.map(flag => `- ${flag}`),
    `Recent caregiver log:`,
    recentLog || '- No caregiver log entries yet',
    `Recent photo log:`,
    recentPhotos || '- No photo entries yet',
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
  return Number.isNaN(dt.getTime()) ? '' : new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: DISPLAY_TIMEZONE
  }).format(dt);
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

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

els.surgeryDate.addEventListener('change', () => {
  state.surgeryDate = els.surgeryDate.value || SURGERY_DATE;
  render();
  saveState();
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

els.patientForm.addEventListener('input', event => {
  const target = event.target.closest('[data-patient-field]');
  if (!target) return;
  const field = target.dataset.patientField;
  state.patient[field] = target.value;
  if (field === 'followUpDate' && !target.value) {
    state.patient[field] = '';
  }
});

els.photoLog && els.photoLog.addEventListener('input', event => {
  const target = event.target.closest('[data-photo-index][data-photo-field]');
  if (!target) return;
  const index = Number(target.dataset.photoIndex);
  const item = state.photoLog[index];
  if (!item) return;
  const field = target.dataset.photoField;
  item[field] = field === 'when' ? normalizeLogTime(target.value) : target.value;
});

els.milestones.addEventListener('input', event => {
  const target = event.target.closest('[data-milestone-index][data-milestone-field]');
  if (!target) return;
  const index = Number(target.dataset.milestoneIndex);
  const item = state.milestoneTemplates[index];
  if (!item) return;
  item.name = target.value;
});

els.caregiverLog && els.caregiverLog.addEventListener('input', event => {
  const target = event.target.closest('[data-log-index][data-log-field]');
  if (!target) return;
  const index = Number(target.dataset.logIndex);
  const item = state.dailyLog[index];
  if (!item) return;
  const field = target.dataset.logField;
  item[field] = field === 'when' ? normalizeLogTime(target.value) : target.value;
});

els.contactsForm.addEventListener('blur', persistAndRender, true);
els.patientForm.addEventListener('blur', persistAndRender, true);
els.photoLog && els.photoLog.addEventListener('blur', persistAndRender, true);

els.caregiverLog && els.caregiverLog.addEventListener('blur', persistAndRender, true);

if (els.savePatient) els.savePatient.addEventListener('click', persistAndRender);
if (els.saveContacts) els.saveContacts.addEventListener('click', persistAndRender);
if (els.addPhotoLog) els.addPhotoLog.addEventListener('click', () => {
  state.photoLog.unshift({
    when: new Date().toISOString(),
    label: '',
    fileRef: '',
    storage: '',
    circumference: '',
    swelling: '',
    bruising: '',
    incision: '',
    rom: '',
    notes: ''
  });
  persistAndRender();
});
if (els.addLogEntry) els.addLogEntry.addEventListener('click', () => {
  state.dailyLog.unshift({
    when: new Date().toISOString(),
    status: '',
    details: ''
  });
  persistAndRender();
});

function addQuickCaregiverLog(status, details) {
  state.dailyLog.unshift({
    when: new Date().toISOString(),
    status,
    details
  });
  persistAndRender();
}

els.quickMedicationLog && els.quickMedicationLog.addEventListener('click', () => {
  addQuickCaregiverLog('Medication', 'Denise took the one medication she was supposed to take that morning.');
});

els.quickAnxietyLog && els.quickAnxietyLog.addEventListener('click', () => {
  addQuickCaregiverLog('Mood', 'Denise was feeling anxious.');
});

els.quickFastingLog && els.quickFastingLog.addEventListener('click', () => {
  addQuickCaregiverLog('Pre-op / fasting', 'Denise knew she had to stop eating by midnight.');
});

els.quickCheckGrid.addEventListener('click', event => {
  const button = event.target.closest('[data-quick-check]');
  if (!button) return;
  addOrUpdateQuickCheck(button.dataset.quickCheck);
});

els.resetQuickChecks && els.resetQuickChecks.addEventListener('click', () => {
  state.quickChecks = [];
  persistAndRender();
});

els.caregiverLog && els.caregiverLog.addEventListener('click', event => {
  const button = event.target.closest('[data-log-remove]');
  if (!button) return;
  const index = Number(button.dataset.logRemove);
  if (!Number.isFinite(index)) return;
  state.dailyLog.splice(index, 1);
  persistAndRender();
});

els.photoLog && els.photoLog.addEventListener('click', event => {
  const button = event.target.closest('[data-photo-remove]');
  if (!button) return;
  const index = Number(button.dataset.photoRemove);
  if (!Number.isFinite(index)) return;
  state.photoLog.splice(index, 1);
  persistAndRender();
});

if (els.addMilestone) els.addMilestone.addEventListener('click', () => {
  const name = window.prompt('Milestone name');
  if (!name) return;
  state.milestoneTemplates.push({
    name: name.trim(),
    completed: false,
    history: []
  });
  persistAndRender();
});

if (els.milestones) els.milestones.addEventListener('click', event => {
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

els.form && els.form.addEventListener('submit', (event) => {
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
  els.form && els.form.reset();
  render();
});

els.reset && els.reset.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(DEFAULT_STATE);
  saveState();
  render();
});

if (els.exportJson) els.exportJson.addEventListener('click', exportState);
(function() {
  var btn = document.getElementById('export-csv');
  if (btn) btn.addEventListener('click', exportCsv);
})();

if (els.copySummary) els.copySummary.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(buildFollowUpSummary());
    els.copySummary.textContent = 'Copied';
    setTimeout(() => { els.copySummary.textContent = 'Copy'; }, 1200);
  } catch (error) {
    console.error(error);
  }
});

if (els.printSummary) els.printSummary.addEventListener('click', () => {
  window.print();
});

if (els.logout) els.logout.addEventListener('click', async () => {
  try {
    await fetch('/api/caregiver-logout', { method: 'POST' });
  } catch {}
  window.location.href = '/caregiver';
});

if (els.importJson) els.importJson.addEventListener('change', async () => {
  const file = els.importJson.files && els.importJson.files[0];
  if (!file) return;
  try {
    await importState(file);
  } catch (error) {
    alert('Import failed.');
    console.error(error);
  } finally {
    els.importJson.value = '';
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/dashboard/sw.js', { scope: '/dashboard/' }).catch(error => {
    console.warn('Service worker registration failed', error);
  });
}

// ---- AI Caregiver Assistant ----
(function() {
  const aiInput = document.getElementById('ai-input');
  const aiSend = document.getElementById('ai-send');
  const aiMic = document.getElementById('ai-mic');
  const aiConfirm = document.getElementById('ai-confirm');
  const aiSummary = document.getElementById('ai-summary');
  const aiApply = document.getElementById('ai-apply');
  const aiCancel = document.getElementById('ai-cancel');

  let pendingActions = null;
  let listening = false;
  let recognition = null;

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = function(event) {
      const text = event.results[0][0].transcript;
      aiInput.value = text;
      listening = false;
      aiMic.classList.remove('recording');
      aiMic.style.color = '';
      sendCommand(text);
    };
    recognition.onerror = function() {
      listening = false;
      aiMic.classList.remove('recording');
      aiMic.style.color = '';
    };
    recognition.onend = function() {
      listening = false;
      aiMic.classList.remove('recording');
      aiMic.style.color = '';
    };
  } else {
    aiMic.style.display = 'none';
  }

  function hideConfirm() {
    aiConfirm.style.display = 'none';
    pendingActions = null;
  }

  async function sendCommand(text) {
    if (!text.trim()) return;
    aiSend.disabled = true;
    aiMic.disabled = true;
    aiInput.placeholder = 'Thinking...';
    try {
      const resp = await fetch('/api/caregiver/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() })
      });
      const data = await resp.json();
      if (data.actions && data.actions.length > 0) {
        pendingActions = data.actions;
        aiSummary.textContent = data.summary || 'Apply these changes?';
        aiConfirm.style.display = 'block';
      } else if (data.error) {
        aiSummary.textContent = 'Sorry: ' + data.error;
        aiConfirm.style.display = 'block';
        aiApply.style.display = 'none';
      }
    } catch (e) {
      aiSummary.textContent = 'AI assistant unavailable.';
      aiConfirm.style.display = 'block';
      aiApply.style.display = 'none';
    } finally {
      aiSend.disabled = false;
      aiMic.disabled = false;
      aiInput.placeholder = 'Say or type what happened...';
      aiInput.value = '';
    }
  }

  function applyActions(actions) {
    var tzOffset = state.surgeryDate ? new Date(state.surgeryDate + 'T12:00:00').getTimezoneOffset() : 240;
    var localNow = new Date();
    var meds = state.medicationTemplates || [];
    var medIndex = {};
    meds.forEach(function(m) { if (m.name) medIndex[m.name.toLowerCase()] = m; });

    actions.forEach(function(action) {
      var at = action.given_at || localNow.toISOString();

      if (action.type === 'log_medication') {
        var name = (action.medication_name || '').toLowerCase();
        var matched = null;
        for (var k in medIndex) {
          if (name.indexOf(k) !== -1 || k.indexOf(name) !== -1) { matched = medIndex[k]; break; }
        }
        if (matched) {
          matched.lastGivenAt = at;
          matched.givenTime = at;
          matched.dispensed = true;
          matched.givenBy = 'Caregiver';
          matched.notes = (matched.notes || '') + ' | AI-logged: ' + at;
          var interval = parseInt(matched.intervalHours || '0', 10);
          if (interval > 0) {
            var next = new Date(at);
            next.setHours(next.getHours() + interval);
            matched.nextDueAt = next.toISOString();
          }
        }
      }

      if (action.type === 'log_nausea_med') {
        meds.forEach(function(m) {
          var nl = (m.name || '').toLowerCase();
          if (nl.indexOf('nausea') !== -1 || nl.indexOf('zofran') !== -1 || nl.indexOf('ondansetron') !== -1) {
            m.lastGivenAt = at;
            m.givenTime = at;
            m.dispensed = true;
            m.notes = (m.notes || '') + ' | AI-logged (nausea): ' + at;
            var interval = parseInt(m.intervalHours || '0', 10);
            if (interval > 0) {
              var next = new Date(at);
              next.setHours(next.getHours() + interval);
              m.nextDueAt = next.toISOString();
            }
          }
        });
      }

      if (action.type === 'log_pain_score') {
        var note = 'Pain score: ' + (action.value || '?') + '/10';
        if (action.notes) note += ' (' + action.notes + ')';
        state.activityLog = state.activityLog || [];
        state.activityLog.push({ type: 'Pain score', text: note, at: at });
      }

      if (['log_walk','log_ice','log_exercise','log_hydration','log_meal','log_bowel'].indexOf(action.type) !== -1) {
        var labels = { log_walk:'Walk', log_ice:'Cold therapy', log_exercise:'Exercise', log_hydration:'Hydration', log_meal:'Meal', log_bowel:'Bowel' };
        var parts = [];
        if (action.distance) parts.push(action.distance);
        if (action.duration_minutes) parts.push(action.duration_minutes + ' min');
        if (action.amount) parts.push(action.amount);
        if (action.description) parts.push(action.description);
        if (action.status) parts.push(action.status);
        state.activityLog = state.activityLog || [];
        state.activityLog.push({ type: labels[action.type] || 'Activity', text: parts.join(' | ') || action.type, at: at });
      }

      if (action.type === 'quick_check') {
        state.quickChecks = state.quickChecks || [];
        state.quickChecks.push({ id: action.check_id || '', at: at });
      }

      if (action.type === 'log_note') {
        state.notes = state.notes || [];
        state.notes.push({ type: 'AI Note', text: action.text || '', at: at });
      }

      if (action.type === 'log_vital') {
        state.activityLog = state.activityLog || [];
        state.activityLog.push({ type: 'Vital: ' + (action.vital_type || ''), text: String(action.value || ''), at: at });
      }
    });
  }

  aiApply.addEventListener('click', function() {
    if (!pendingActions) return;
    applyActions(pendingActions);
    saveState();
    render();
    hideConfirm();
  });

  aiCancel.addEventListener('click', hideConfirm);

  aiSend.addEventListener('click', function() {
    sendCommand(aiInput.value);
  });

  aiInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') sendCommand(aiInput.value);
  });

  aiMic.addEventListener('click', function() {
    if (!recognition) return;
    if (listening) { recognition.stop(); return; }
    listening = true;
    aiMic.classList.add('recording');
    aiMic.style.color = '#e53e3e';
    recognition.start();
  });
})();

state = loadState();
render();
void syncRemoteState();
