const DISPLAY_TIMEZONE = 'America/Indiana/Indianapolis';

async function loadUpdates() {
  const statsGridEl = document.getElementById('stats-grid');
  const phaseEl = document.getElementById('phase-copy');
  const checksEl = document.getElementById('checks-list');
  const updatedEl = document.getElementById('last-updated');
  const freshnessEl = document.getElementById('freshness-note');

  try {
    const response = await fetch('/api/public-summary', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Could not load public summary: ${response.status}`);
    }

    const data = await response.json();
    updatedEl.textContent = data.asOf
      ? `Current stats as of ${formatDateTime(data.asOf)}`
      : 'Current stats as of now';
    if (freshnessEl) {
      freshnessEl.textContent = buildFreshnessNote(data);
      freshnessEl.classList.remove('stale');
    }

    statsGridEl.innerHTML = renderStatsGrid(data);
    phaseEl.innerHTML = renderPhase(data);
    checksEl.innerHTML = renderChecks(data.recentChecks || []);
  } catch (error) {
    updatedEl.textContent = 'Current stats are temporarily unavailable.';
    if (freshnessEl) {
      freshnessEl.textContent = 'The live recovery snapshot could not be reached. The caregiver dashboard is still separate.';
      freshnessEl.classList.add('stale');
    }
    statsGridEl.innerHTML = '<p class="muted">The live snapshot could not be loaded. Please check back later.</p>';
    phaseEl.innerHTML = '<p class="muted">Phase details are temporarily unavailable.</p>';
    checksEl.innerHTML = '';
    console.error(error);
  }
}

function buildFreshnessNote(data) {
  const stats = data?.stats || {};
  const patient = data?.patient || {};
  const parts = [];
  if (typeof stats.recoveryDay === 'number') {
    parts.push(`Recovery day ${stats.recoveryDay}`);
  }
  if (patient.surgeryDate) {
    parts.push(`Surgery ${formatDate(patient.surgeryDate)}`);
  }
  return parts.length ? `${parts.join(' ? ')} ? live from the dashboard state` : 'Live from the dashboard state';
}

function renderStatsGrid(data) {
  const patient = data?.patient || {};
  const stats = data?.stats || {};
  return [
    ['Patient', patient.name || 'Denise'],
    ['Procedure', patient.procedure || 'Recovery'],
    ['Recovery day', typeof stats.recoveryDay === 'number' ? `Day ${stats.recoveryDay}` : '?'],
    ['Surgery date', patient.surgeryDate ? formatDate(patient.surgeryDate) : '?'],
  ].map(([label, value]) => `
    <div class="stat">
      <span class="stat-label">${escapeHtml(label)}</span>
      <span class="stat-value">${escapeHtml(value)}</span>
    </div>
  `).join('');
}

function renderPhase(data) {
  const phase = data?.stats?.phase || {};
  return `
    <p class="phase-range">${escapeHtml(phase.range || '?')}</p>
    <h3>${escapeHtml(phase.label || 'Recovery')}</h3>
    <p class="phase-summary">${escapeHtml(phase.summary || 'Current recovery details are updating.')}</p>
  `;
}

function renderChecks(checks) {
  if (!checks.length) {
    return '<p class="muted">No public checkpoints have been logged yet.</p>';
  }
  return checks.map(check => `
    <div class="check-item">
      <span class="check-label">${escapeHtml(labelForCheck(check.id))}</span>
      <span class="check-time">${formatDateTime(check.at)}</span>
    </div>
  `).join('');
}

function labelForCheck(id) {
  const labels = {
    'med-check': 'Medication check',
    'hydration-check': 'Hydration',
    'walk-check': 'Walk done',
    'exercise-check': 'Exercises',
    'ice-check': 'Ice and elevate',
    'meal-check': 'Meal',
    'incision-check': 'Incision check',
    'rest-check': 'Rest and elevate',
    'bowel-check': 'Bowel check',
  };
  return labels[id] || id || 'Checkpoint';
}

function formatDate(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return escapeHtml(value);
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: DISPLAY_TIMEZONE
  }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: DISPLAY_TIMEZONE,
    timeZoneName: 'short'
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

loadUpdates();
