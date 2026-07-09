var STORAGE_KEY = 'denise-patient';
var DASHBOARD_STATE_URL = '/api/dashboard-state';
var SURGERY_DATE = '2026-07-06';

var state = {};
var dirtySince = 0;
var pendingActions = null;

var els = {};

function init() {
  els.day = document.getElementById('recovery-day');
  els.painBadge = document.getElementById('pain-badge');
  els.medsCount = document.getElementById('meds-count');
  els.nextMeds = document.getElementById('next-meds-list');
  els.todaySummary = document.getElementById('today-summary');
  els.painSlider = document.getElementById('pain-slider');
  els.nauseaBtn = document.getElementById('nausea-btn');
  els.tempBtn = document.getElementById('temp-btn');

  loadState();
  render();
  syncRemoteState();

  wireAI();
  wireQuickLogs();
  wirePain();
  wireLogout();
  wireCheckin();
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { state = JSON.parse(raw); return; }
  } catch(e) {}
  state = { medicationTemplates: [], activityLog: [], quickChecks: [], patient: {} };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function syncRemoteState() {
  fetch(DASHBOARD_STATE_URL, { cache: 'no-store' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (!data) return;
      if (dirtySince && Date.now() - dirtySince < 5000) return;
      state = data; localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render();
    })
    .catch(function() {});
}

function persistRemoteState() {
  dirtySince = Date.now();
  fetch(DASHBOARD_STATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  }).catch(function() {});
}

function recoveryDay() {
  var surgery = new Date(SURGERY_DATE + 'T12:00:00-04:00');
  var now = new Date();
  var edtOffset = 240;
  var nowEdt = now.getTime() + (edtOffset - now.getTimezoneOffset()) * 60000;
  return Math.max(0, Math.floor((nowEdt - surgery.getTime()) / 86400000)) + 1;
}

function render() {
  if (els.day) els.day.textContent = 'Day ' + recoveryDay();
  renderPainBadge();
  renderMedsCount();
  renderNextMeds();
  renderTodaySummary();
}

function renderPainBadge() {
  if (!els.painBadge) return;
  var logs = state.activityLog || [];
  var last = null;
  for (var i = logs.length - 1; i >= 0; i--) {
    if (logs[i].type === 'Pain score') { last = logs[i]; break; }
  }
  if (last) {
    els.painBadge.textContent = last.text.replace('Pain score: ', '').replace('Pain score:', '');
    els.painBadge.style.color = '';
  } else {
    els.painBadge.textContent = '--';
    els.painBadge.style.color = 'var(--muted)';
  }
}

function renderMedsCount() {
  if (!els.medsCount) return;
  var meds = state.medicationTemplates || [];
  var now = new Date();
  var edtOffset = 240;
  var nowEdt = new Date(now.getTime() + (edtOffset - now.getTimezoneOffset()) * 60000);
  var today = nowEdt.toISOString().slice(0, 10);
  var count = 0;
  meds.forEach(function(m) {
    if (m.dispensed && m.lastGivenAt && m.lastGivenAt.slice(0, 10) === today) count++;
  });
  els.medsCount.textContent = count;
}

function renderNextMeds() {
  if (!els.nextMeds) return;
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
      if (diffMs < 0) {
        cls = 'overdue';
        label = 'Overdue ' + Math.abs(diffMin) + 'm';
      } else if (diffMin < 60) {
        cls = 'soon';
        label = 'In ' + diffMin + 'm';
      } else if (diffMin < 180) {
        label = 'In ' + Math.round(diffMin / 60) + 'h';
      } else {
        label = nextAt.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
      }
    }
    if (m.dispensed) {
      var nextTime = m.nextDueAt ? new Date(m.nextDueAt).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : '';
      label = 'Taken' + (nextTime ? ', next: ' + nextTime : '');
      cls = 'done';
    }
    items.push('<div class="med-timer"><span class="med-name">' + esc(m.name || '') + '</span><span class="med-due ' + cls + '">' + esc(label) + '</span></div>');
  });
  els.nextMeds.innerHTML = items.length ? items.join('') : '<p class="empty">No medications scheduled.</p>';
}

function renderTodaySummary() {
  if (!els.todaySummary) return;
  var logs = state.activityLog || [];
  var now = new Date();
  var edtOffset = 240;
  var nowEdt = new Date(now.getTime() + (edtOffset - now.getTimezoneOffset()) * 60000);
  var today = nowEdt.toISOString().slice(0, 10);
  var todayItems = [];
  for (var i = logs.length - 1; i >= 0; i--) {
    var at = logs[i].at || '';
    if (at.slice(0, 10) === today) {
      todayItems.push('<div class="item"><strong>' + esc(logs[i].type) + '</strong> &mdash; ' + esc(logs[i].text || '') + '</div>');
    }
  }
  els.todaySummary.innerHTML = todayItems.length ? todayItems.join('') : '<p class="empty">Nothing logged yet today. Use the AI bar or quick buttons above.</p>';
}

function esc(s) {
  s = String(s || '');
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ---- Quick Log Buttons ----
function wireQuickLogs() {
  var btns = document.querySelectorAll('[data-quick-log]');
  btns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var type = btn.dataset.quickLog;
      var now = new Date().toISOString();
      state.activityLog = state.activityLog || [];
      var label = '';
      var text = '';
      if (type === 'walk') { label = 'Walk'; text = 'Walk completed'; }
      else if (type === 'ice') { label = 'Cold therapy'; text = 'Ice and elevation'; }
      else if (type === 'exercise') { label = 'Exercise'; text = 'Exercises completed'; }
      else if (type === 'hydration') { label = 'Hydration'; text = 'Hydration checked'; }
      else if (type === 'meal') { label = 'Meal'; text = 'Meal eaten'; }
      else if (type === 'rest') { label = 'Rest'; text = 'Rest and elevation'; }
      state.activityLog.push({ type: label, text: text, at: now });
      saveState();
      persistRemoteState();
      render();
      toast(label + ' logged');
    });
  });
}

// ---- Pain Buttons ----
function wirePain() {
  var pendingPainVal = null;
  var painConfirmBar = null;

  function showPainConfirm(val) {
    if (painConfirmBar) painConfirmBar.remove();
    painConfirmBar = document.createElement('div');
    painConfirmBar.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px 12px;background:var(--accent-soft);border-radius:var(--radius-sm);font-size:15px';
    painConfirmBar.innerHTML = '<span style="flex:1">Log pain: <strong>' + val + '/10</strong>?</span>' +
      '<button id="pain-confirm-yes" style="padding:8px 16px;border:none;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer;font-size:14px">Yes</button>' +
      '<button id="pain-confirm-no" style="padding:8px 16px;border:none;border-radius:8px;background:var(--line);color:var(--text);cursor:pointer;font-size:14px">No</button>';
    var sliderWrap = document.querySelector('.pain-slider-wrap');
    if (sliderWrap) {
      sliderWrap.parentNode.insertBefore(painConfirmBar, sliderWrap.nextSibling);
    }
    document.getElementById('pain-confirm-yes').addEventListener('click', function() {
      logPain(val);
      if (painConfirmBar) { painConfirmBar.remove(); painConfirmBar = null; }
      pendingPainVal = null;
      resetPainBtns();
    });
    document.getElementById('pain-confirm-no').addEventListener('click', function() {
      if (painConfirmBar) { painConfirmBar.remove(); painConfirmBar = null; }
      pendingPainVal = null;
      resetPainBtns();
    });
  }

  function resetPainBtns() {
    var btns = document.querySelectorAll('[data-quick-log="pain"]');
    btns.forEach(function(b) { b.style.outline = ''; b.style.fontWeight = ''; });
  }

  function highlightPainBtn(val) {
    resetPainBtns();
    var btns = document.querySelectorAll('[data-quick-log="pain"]');
    btns.forEach(function(b) {
      var range = b.dataset.value || '';
      var parts = range.split('-');
      var lo = parseInt(parts[0]);
      var hi = parts.length === 2 ? parseInt(parts[1]) : lo;
      if (val >= lo && val <= hi) {
        b.style.outline = '3px solid var(--accent)';
        b.style.fontWeight = 'bold';
      }
    });
  }

  if (els.painSlider) {
    els.painSlider.addEventListener('input', function() {
      var val = parseInt(els.painSlider.value, 10);
      highlightPainBtn(val);
      showPainConfirm(val);
    });
    // Remove old change listener - slider doesn't auto-log anymore
  }

  var painBtns = document.querySelectorAll('[data-quick-log="pain"]');
  painBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var range = btn.dataset.value || '';
      var parts = range.split('-');
      var val = parts.length === 2 ? Math.round((parseInt(parts[0]) + parseInt(parts[1])) / 2) : parseInt(range);
      if (isNaN(val)) val = 5;
      if (els.painSlider) els.painSlider.value = val;
      highlightPainBtn(val);
      showPainConfirm(val);
    });
  });

  if (els.nauseaBtn) {
    els.nauseaBtn.addEventListener('click', function() {
      state.activityLog = state.activityLog || [];
      state.activityLog.push({ type: 'Nausea', text: 'Feeling nauseated', at: new Date().toISOString() });
      saveState();
      persistRemoteState();
      render();
      toast('Nausea logged');
    });
  }

  if (els.tempBtn) {
    els.tempBtn.addEventListener('click', function() {
      var temp = prompt('Enter temperature (e.g. 98.6):');
      if (!temp) return;
      state.activityLog = state.activityLog || [];
      state.activityLog.push({ type: 'Vital: temperature', text: temp + ' F', at: new Date().toISOString() });
      saveState();
      persistRemoteState();
      render();
      toast('Temp: ' + temp + 'F');
    });
  }
}

function wireLogout() {
  var btn = document.getElementById('logout-btn');
  if (btn) btn.addEventListener('click', function() {
    fetch('/api/caregiver-logout', { method: 'POST' }).catch(function(){});
    window.location.href = '/caregiver';
  });
}

function toast(msg) {
  var el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function() { el.remove(); }, 1800);
}

function logPain(val) {
  state.activityLog = state.activityLog || [];
  state.activityLog.push({ type: 'Pain score', text: 'Pain score: ' + val + '/10', at: new Date().toISOString() });
  saveState();
  persistRemoteState();
  render();
  toast('Pain: ' + val + '/10');
}

// ---- AI Assistant ----
function wireAI() {
  var aiInput = document.getElementById('ai-input');
  var aiSend = document.getElementById('ai-send');
  var aiMic = document.getElementById('ai-mic');
  var aiConfirm = document.getElementById('ai-confirm');
  var aiSummary = document.getElementById('ai-summary');
  var aiApply = document.getElementById('ai-apply');
  var aiCancel = document.getElementById('ai-cancel');

  var listening = false;
  var recognition = null;

  function stopListening() {
    listening = false;
    if (aiMic) {
      aiMic.classList.remove('recording');
      aiMic.style.color = '';
    }
    aiInput.placeholder = 'Say what you did or how you feel...';
  }

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = function(event) {
      aiInput.value = event.results[0][0].transcript;
      stopListening();
      sendCommand(aiInput.value);
    };
    recognition.onerror = function(e) {
      if (e.error === 'not-allowed') {
        aiInput.placeholder = 'Mic blocked - check browser permissions';
      }
      stopListening();
    };
    recognition.onend = function() {
      stopListening();
    };
  } else {
    if (aiMic) aiMic.style.display = 'none';
  }

  function hideConfirm() {
    if (aiConfirm) aiConfirm.style.display = 'none';
    pendingActions = null;
    if (aiApply) aiApply.style.display = '';
  }

  function sendCommand(text) {
    if (!text.trim()) return;
    aiSend.disabled = true;
    if (aiMic) aiMic.disabled = true;
    aiInput.placeholder = 'Thinking...';
    fetch('/api/caregiver/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim() })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.actions && data.actions.length) {
        pendingActions = data.actions;
        aiSummary.textContent = data.summary || 'Apply these changes?';
        aiConfirm.style.display = 'block';
      } else if (data.error) {
        aiSummary.textContent = 'Sorry: ' + data.error;
        aiConfirm.style.display = 'block';
        if (aiApply) aiApply.style.display = 'none';
      }
    })
    .catch(function() {
      aiSummary.textContent = 'AI assistant unavailable.';
      aiConfirm.style.display = 'block';
      if (aiApply) aiApply.style.display = 'none';
    })
    .finally(function() {
      aiSend.disabled = false;
      if (aiMic) aiMic.disabled = false;
      aiInput.placeholder = 'Say what you did or how you feel...';
      aiInput.value = '';
    });
  }

  function applyActions(actions) {
    var meds = state.medicationTemplates || [];
    var medIndex = {};
    meds.forEach(function(m) { if (m.name) medIndex[m.name.toLowerCase()] = m; });

    actions.forEach(function(action) {
      var at = action.given_at || new Date().toISOString();

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
          matched.givenBy = 'Patient';
          matched.notes = (matched.notes || '') + ' | Patient-logged: ' + at;
          var interval = parseInt(matched.intervalHours || '0', 10);
          if (interval > 0) {
            var next = new Date(new Date(at).getTime() + interval * 3600000);
            matched.nextDueAt = next.toISOString();
          }
        }
      }

      if (action.type === 'log_medication_done') {
        var name = (action.medication_name || '').toLowerCase();
        var matched = null;
        for (var k in medIndex) {
          if (name.indexOf(k) !== -1 || k.indexOf(name) !== -1) { matched = medIndex[k]; break; }
        }
        if (matched) {
          matched.dispensed = true;
          matched.nextDueAt = '';
          matched.lastGivenAt = at;
          matched.notes = (matched.notes || '') + ' | COMPLETED - no more doses.';
          matched.stopRule = 'Completed';
        }
      }

      if (action.type === 'log_nausea_med') {
        meds.forEach(function(m) {
          var nl = (m.name || '').toLowerCase();
          if (nl.indexOf('nausea') !== -1 || nl.indexOf('zofran') !== -1 || nl.indexOf('ondansetron') !== -1) {
            m.lastGivenAt = at;
            m.givenTime = at;
            m.dispensed = true;
            m.notes = (m.notes || '') + ' | Patient-logged (nausea): ' + at;
            var interval = parseInt(m.intervalHours || '0', 10);
            if (interval > 0) {
              var next = new Date(new Date(at).getTime() + interval * 3600000);
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

      var activityTypes = ['log_walk','log_ice','log_exercise','log_hydration','log_meal','log_bowel'];
      if (activityTypes.indexOf(action.type) !== -1) {
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

  if (aiApply) aiApply.addEventListener('click', function() {
    if (!pendingActions) return;
    applyActions(pendingActions);
    saveState();
    persistRemoteState();
    render();
    hideConfirm();
    toast('Changes applied');
  });

  if (aiCancel) aiCancel.addEventListener('click', hideConfirm);
  if (aiSend) aiSend.addEventListener('click', function() { sendCommand(aiInput.value); });
  if (aiInput) aiInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') sendCommand(aiInput.value); });
  if (aiMic) aiMic.addEventListener('click', function() {
    if (!recognition) return;
    if (listening) { recognition.stop(); return; }
    listening = true;
    aiMic.classList.add('recording');
    aiMic.style.color = '#e53e3e';
    recognition.start();
  });
}

// ---- Morning Check-in ----
function wireCheckin() {
  var btnCard = document.getElementById('checkin-btn-card');
  var checkinCard = document.getElementById('checkin-card');
  var startBtn = document.getElementById('checkin-start');
  var closeBtn = document.getElementById('checkin-close');
  var submitBtn = document.getElementById('checkin-submit');
  var painSlider = document.getElementById('checkin-pain-slider');
  var medsList = document.getElementById('checkin-meds');
  var notesInput = document.getElementById('checkin-notes');

  if (!startBtn || !checkinCard) return;

  function getMorningMeds() {
    var meds = state.medicationTemplates || [];
    return meds.filter(function(m) {
      var sched = m.scheduled || '';
      var stopped = (m.stopRule || '') === 'Completed';
      if (stopped) return false;
      if (sched === 'PRN') return false;
      var name = (m.name || '').toLowerCase();
      if (name.indexOf('pregabalin') !== -1 || name.indexOf('tranexamic') !== -1) return false;
      return true;
    });
  }

  function renderCheckinMeds() {
    if (!medsList) return;
    var meds = getMorningMeds();
    medsList.innerHTML = meds.map(function(m, i) {
      var name = m.name || '';
      var dose = m.dose || '';
      return '<div class="checkin-med-item" id="checkin-med-' + i + '">' +
        '<div><span class="med-label">' + esc(name) + '</span>' +
        (dose ? '<span class="med-dose">' + esc(dose) + '</span>' : '') + '</div>' +
        '<div class="med-actions">' +
        '<button class="btn-skip" data-checkin-skip="' + i + '">Skip</button>' +
        '<button class="btn-take" data-checkin-take="' + i + '">Taken</button>' +
        '</div></div>';
    }).join('');

    medsList.querySelectorAll('[data-checkin-take]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.checkinTake, 10);
        var item = document.getElementById('checkin-med-' + idx);
        if (item) item.classList.add('taken');
      });
    });
    medsList.querySelectorAll('[data-checkin-skip]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.checkinSkip, 10);
        var item = document.getElementById('checkin-med-' + idx);
        if (item) item.classList.remove('taken');
      });
    });
  }

  function openCheckin() {
    renderCheckinMeds();
    btnCard.style.display = 'none';
    checkinCard.style.display = 'block';
    if (painSlider) painSlider.value = 0;
    if (notesInput) notesInput.value = '';
    checkinCard.scrollIntoView({ behavior: 'smooth' });
  }

  function closeCheckin() {
    checkinCard.style.display = 'none';
    btnCard.style.display = 'block';
  }

  function submitCheckin() {
    var painVal = painSlider ? parseInt(painSlider.value, 10) : 0;
    var notes = notesInput ? notesInput.value.trim() : '';
    var meds = getMorningMeds();
    var now = new Date().toISOString();

    state.activityLog = state.activityLog || [];

    if (painVal > 0) {
      state.activityLog.push({ type: 'Pain score', text: 'Pain score: ' + painVal + '/10', at: now });
    }
    if (notes) {
      state.activityLog.push({ type: 'Morning note', text: notes, at: now });
    }

    var medIndex = {};
    (state.medicationTemplates || []).forEach(function(m) {
      if (m.name) medIndex[m.name.toLowerCase()] = m;
    });

    meds.forEach(function(m, i) {
      var item = document.getElementById('checkin-med-' + i);
      if (item && item.classList.contains('taken')) {
        var nl = (m.name || '').toLowerCase();
        var tmpl = medIndex[nl];
        if (tmpl) {
          tmpl.lastGivenAt = now;
          tmpl.givenTime = now;
          tmpl.dispensed = true;
          tmpl.givenBy = 'Patient (check-in)';
          var interval = parseInt(tmpl.intervalHours || '0', 10);
          if (interval > 0) {
            var next = new Date(new Date(now).getTime() + interval * 3600000);
            tmpl.nextDueAt = next.toISOString();
          }
          tmpl.notes = (tmpl.notes || '') + ' | Taken via morning check-in.';
        }
      }
    });

    saveState();
    persistRemoteState();
    render();
    closeCheckin();
    toast('Morning check-in logged');
  }

  startBtn.addEventListener('click', openCheckin);
  closeBtn.addEventListener('click', closeCheckin);
  submitBtn.addEventListener('click', submitCheckin);
}

init();
