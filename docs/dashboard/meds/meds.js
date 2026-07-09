var STORAGE_KEY = 'denise-recovery-phase1';
var API = '/api/dashboard-state';
var TZ = 'America/Indiana/Indianapolis';

var state = { medicationTemplates: [] };
var fullState = {};
var countdownInterval = null;

var els = {};

function init() {
  els.list = document.getElementById('med-list');
  els.addBtn = document.getElementById('add-med-btn');
  els.overlay = document.getElementById('edit-overlay');
  els.editTitle = document.getElementById('edit-title');
  els.editBody = document.getElementById('edit-body');
  els.editClose = document.getElementById('edit-close');
  els.editSave = document.getElementById('edit-save');

  loadState();
  render();
  syncRemote();
  startCountdown();
  wireEvents();

  setInterval(syncRemote, 30000);

  // Focus on specific med if ?med= query param present
  var params = new URLSearchParams(window.location.search);
  var medParam = params.get('med');
  if (medParam) {
    setTimeout(focusMed, 500);
  }
}

function focusMed() {
  var params = new URLSearchParams(window.location.search);
  var medParam = params.get('med');
  if (!medParam) return;
  var meds = state.medicationTemplates || [];
  for (var i = 0; i < meds.length; i++) {
    var name = (meds[i].name || '').toLowerCase();
    if (name.indexOf(medParam.toLowerCase()) !== -1) {
      var card = document.getElementById('med-card-' + i);
      if (card) {
        card.classList.add('expanded');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      break;
    }
  }
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      fullState = JSON.parse(raw) || {};
      state.medicationTemplates = fullState.medicationTemplates || [];
    }
  } catch(e) {}
}

function saveState() {
  fullState.medicationTemplates = state.medicationTemplates;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fullState));
}

function syncRemote() {
  fetch(API, { cache: 'no-store' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (data) {
        fullState = data;
        state.medicationTemplates = data.medicationTemplates || [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        render();
      }
    })
    .catch(function() {});
}

function persistRemote() {
  fullState.medicationTemplates = state.medicationTemplates;
  fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fullState)
  }).catch(function() {});
}

function saveAll() {
  saveState();
  persistRemote();
  render();
}

function toast(msg) {
  var el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function() { el.remove(); }, 1800);
}

// ---- Rendering ----

function render() {
  var meds = state.medicationTemplates || [];
  if (!meds.length) {
    els.list.innerHTML = '<div class="empty-state"><p>No medications yet.<br>Tap + to add one.</p></div>';
    return;
  }
  els.list.innerHTML = meds.map(renderCard).join('');
}

function renderCard(med, index) {
  var name = esc(med.name || 'Medication ' + (index + 1));
  var dose = esc(med.dose || '');
  var status = getStatus(med);
  var dot = 'none';
  var timerText = '--';
  var borderClass = '';

  if (med.stopRule === 'Completed') {
    dot = 'taken';
    timerText = 'Done';
    borderClass = '';
  } else if (status === 'overdue') {
    dot = 'overdue';
    timerText = formatCountdown(med.nextDueAt, true);
    borderClass = 'overdue';
  } else if (status === 'soon') {
    dot = 'soon';
    timerText = formatCountdown(med.nextDueAt);
    borderClass = 'soon';
  } else if (med.dispensed) {
    dot = 'taken';
    timerText = 'Taken';
    if (med.nextDueAt) {
      timerText += ', ' + formatNextTime(med.nextDueAt);
    }
  } else if (med.nextDueAt) {
    timerText = formatNextTime(med.nextDueAt);
  }

  var cardClass = 'med-card' + (borderClass ? ' ' + borderClass : '');
  var dispLabel = med.dispensed ? 'Undo' : 'Mark done';

  return '<div class="' + cardClass + '" data-med-index="' + index + '" id="med-card-' + index + '">' +
    '<div class="med-card-main" data-action="expand" data-idx="' + index + '">' +
      '<span class="med-status-dot ' + dot + '"></span>' +
      '<div class="med-info">' +
        '<div class="med-name">' + name + '</div>' +
        (dose ? '<div class="med-dose">' + dose + '</div>' : '') +
      '</div>' +
      '<div class="med-timer ' + dot + '" id="med-timer-' + index + '">' + timerText + '</div>' +
    '</div>' +
    '<div class="med-card-actions">' +
      '<button data-action="log" data-idx="' + index + '">Log dose</button>' +
      '<button data-action="toggleDisp" data-idx="' + index + '">' + dispLabel + '</button>' +
      '<button data-action="edit" data-idx="' + index + '">Edit</button>' +
    '</div>' +
    '<div class="med-detail" id="med-detail-' + index + '">' +
      (med.instructions ? '<label>Instructions<div>' + esc(med.instructions) + '</div></label>' : '') +
      (med.scheduled ? '<label>Scheduled<div>' + esc(med.scheduled) + ' (' + esc(med.intervalHours || '--') + 'h)</div></label>' : '') +
      (med.lastGivenAt ? '<label>Last dose<div>' + formatFullTime(med.lastGivenAt) + '</div></label>' : '') +
      (med.notes ? '<label>Notes<div>' + esc(med.notes.slice(-200)) + '</div></label>' : '') +
      '<div class="detail-actions">' +
        '<button class="btn-log" data-action="log" data-idx="' + index + '">Log dose now</button>' +
        '<button class="btn-remove" data-action="remove" data-idx="' + index + '">Remove</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function getStatus(med) {
  if (!med.nextDueAt) return null;
  var due = new Date(med.nextDueAt);
  if (isNaN(due.getTime())) return null;
  var diff = due - Date.now();
  if (diff < 0) return med.dispensed ? null : 'overdue';
  if (diff < 3600000) return 'soon';
  return null;
}

function formatCountdown(nextDueAt, isOverdue) {
  if (!nextDueAt) return '';
  var due = new Date(nextDueAt);
  if (isNaN(due.getTime())) return '';
  var diffMs = Math.abs(due - Date.now());
  var mins = Math.floor(diffMs / 60000);
  var hrs = Math.floor(mins / 60);
  if (hrs > 0) return (isOverdue ? 'Overdue ' : '') + hrs + 'h ' + (mins % 60) + 'm';
  return (isOverdue ? 'Overdue ' : '') + mins + 'm';
}

function formatNextTime(nextDueAt) {
  if (!nextDueAt) return '';
  var due = new Date(nextDueAt);
  if (isNaN(due.getTime())) return '';
  return 'next ' + due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatFullTime(val) {
  if (!val) return '';
  var d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ });
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- Countdown Timers ----

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(updateCountdowns, 1000);
}

function updateCountdowns() {
  var meds = state.medicationTemplates || [];
  meds.forEach(function(med, i) {
    var el = document.getElementById('med-timer-' + i);
    if (!el) return;
    var status = getStatus(med);
    var text = '--';
    var cls = '';
    if (med.stopRule === 'Completed') {
      text = 'Done';
      cls = 'taken';
    } else if (status === 'overdue') {
      text = formatCountdown(med.nextDueAt, true);
      cls = 'overdue';
    } else if (status === 'soon') {
      text = formatCountdown(med.nextDueAt);
      cls = 'soon';
    } else if (med.dispensed) {
      text = 'Taken';
      if (med.nextDueAt) text += ', ' + formatNextTime(med.nextDueAt);
      cls = 'taken';
    } else if (med.nextDueAt) {
      text = formatNextTime(med.nextDueAt);
    }
    el.textContent = text;
    el.className = 'med-timer ' + cls;

    // Update dot
    var card = document.getElementById('med-card-' + i);
    if (card) {
      card.className = card.className.replace(/\boverdue\b|\bsoon\b/g, '').trim();
      if (status === 'overdue' && !med.dispensed) card.classList.add('overdue');
      else if (status === 'soon') card.classList.add('soon');
      var dot = card.querySelector('.med-status-dot');
      if (dot) dot.className = 'med-status-dot ' + cls;
    }
  });
}

// ---- Actions ----

function logDose(index) {
  var med = state.medicationTemplates[index];
  if (!med) return;
  var now = new Date().toISOString();
  med.lastGivenAt = now;
  med.givenTime = now;
  med.dispensed = true;
  med.givenBy = 'Caregiver';
  var interval = parseInt(med.intervalHours || '0', 10);
  if (interval > 0) {
    med.nextDueAt = new Date(Date.now() + interval * 3600000).toISOString();
  }
  med.notes = (med.notes || '') + ' | Dose logged ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.';
  saveAll();
  toast((med.name || 'Medication') + ' logged');
}

function toggleDispensed(index) {
  var med = state.medicationTemplates[index];
  if (!med) return;
  med.dispensed = !med.dispensed;
  saveAll();
  toast(med.dispensed ? 'Marked dispensed' : 'Unmarked dispensed');
}

function removeMed(index) {
  var med = state.medicationTemplates[index];
  if (!med) return;
  var name = med.name || 'Medication';
  if (!confirm('Remove ' + name + '?')) return;
  state.medicationTemplates.splice(index, 1);
  saveAll();
  toast(name + ' removed');
}

function toggleExpand(index) {
  var card = document.getElementById('med-card-' + index);
  if (!card) return;
  card.classList.toggle('expanded');
}

// ---- Edit Overlay ----

var editingIndex = -1;

function openEdit(index) {
  editingIndex = index;
  var med = state.medicationTemplates[index] || { name: '', dose: '', scheduled: '', intervalHours: '', instructions: '', notes: '', stopRule: '' };
  els.editTitle.textContent = med.name || 'New Medication';
  els.editBody.innerHTML =
    '<label>Name<input id="ef-name" value="' + esc(med.name) + '" placeholder="Medication name"></label>' +
    '<label>Dose<input id="ef-dose" value="' + esc(med.dose) + '" placeholder="e.g. 500 mg"></label>' +
    '<div class="row">' +
      '<label>Scheduled / PRN<input id="ef-scheduled" value="' + esc(med.scheduled) + '" placeholder="Scheduled or PRN"></label>' +
      '<label>Interval (hours)<input id="ef-interval" value="' + esc(med.intervalHours) + '" placeholder="4, 8, 12" type="number" min="0"></label>' +
    '</div>' +
    '<label>Instructions<textarea id="ef-instructions" rows="3" placeholder="e.g. Take with food">' + esc(med.instructions || '') + '</textarea></label>' +
    '<label>Notes<textarea id="ef-notes" rows="2" placeholder="Any notes...">' + esc(med.notes || '') + '</textarea></label>' +
    '<label>Stop rule<input id="ef-stopRule" value="' + esc(med.stopRule) + '" placeholder="e.g. Completed, 7 days"></label>';
  els.overlay.style.display = 'flex';
}

function closeEdit() {
  els.overlay.style.display = 'none';
  editingIndex = -1;
}

function saveEdit() {
  var index = editingIndex;
  if (index < 0) return;
  var med = state.medicationTemplates[index];
  if (!med) {
    med = {};
    state.medicationTemplates.push(med);
    index = state.medicationTemplates.length - 1;
  }
  med.name = document.getElementById('ef-name')?.value || med.name;
  med.dose = document.getElementById('ef-dose')?.value || '';
  med.scheduled = document.getElementById('ef-scheduled')?.value || '';
  med.intervalHours = document.getElementById('ef-interval')?.value || '';
  med.instructions = document.getElementById('ef-instructions')?.value || '';
  med.notes = document.getElementById('ef-notes')?.value || '';
  med.stopRule = document.getElementById('ef-stopRule')?.value || '';
  closeEdit();
  saveAll();
  toast('Saved');
}

// ---- Wire Events ----

function wireEvents() {
  els.addBtn.addEventListener('click', function() {
    state.medicationTemplates.push({ name: '', dose: '', scheduled: '', intervalHours: '', instructions: '', notes: '' });
    openEdit(state.medicationTemplates.length - 1);
  });

  els.editClose.addEventListener('click', closeEdit);
  els.editSave.addEventListener('click', saveEdit);

  els.overlay.addEventListener('click', function(e) {
    if (e.target === els.overlay) closeEdit();
  });

  els.list.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    var idx = parseInt(btn.dataset.idx, 10);

    if (action === 'log') logDose(idx);
    if (action === 'toggleDisp') toggleDispensed(idx);
    if (action === 'edit') openEdit(idx);
    if (action === 'expand') toggleExpand(idx);
    if (action === 'remove') removeMed(idx);
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeEdit();
  });
}

init();
