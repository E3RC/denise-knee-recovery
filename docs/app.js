const DISPLAY_TIMEZONE = 'America/Indiana/Indianapolis';

async function loadUpdates() {
  const latestEl = document.getElementById('latest-content');
  const timelineEl = document.getElementById('timeline');
  const updatedEl = document.getElementById('last-updated');

  try {
    const response = await fetch('family-updates.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Could not load updates: ${response.status}`);
    }

    const data = await response.json();
    const updates = (data.updates || [])
      .filter(update => String(update.showOnWeb || '').toUpperCase() === 'YES')
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    updatedEl.textContent = data.lastUpdated
      ? `Last updated: ${formatDateTime(data.lastUpdated)}`
      : 'Last updated: not yet published';

    if (!updates.length) {
      latestEl.innerHTML = '<p class="muted">No family updates are published yet.</p>';
      timelineEl.innerHTML = '<p class="muted">Check back soon.</p>';
      return;
    }

    const latest = updates[0];
    latestEl.innerHTML = renderLatest(latest);
    timelineEl.innerHTML = updates.map(renderTimelineItem).join('');
  } catch (error) {
    updatedEl.textContent = 'Updates are temporarily unavailable.';
    latestEl.innerHTML = '<p class="muted">The update feed could not be loaded. Please check back later.</p>';
    timelineEl.innerHTML = '';
    console.error(error);
  }
}

function renderLatest(update) {
  return `
    <h3>${escapeHtml(update.headline || 'Recovery update')}</h3>
    <p class="update-meta">${formatDate(update.date)} · Surgery day ${escapeHtml(update.dayNumber ?? '')}</p>
    <p>${escapeHtml(update.publicUpdate || '')}</p>
    <div class="latest-grid">
      ${renderStat('Pain trend', update.painTrend)}
      ${renderStat('Mobility', update.mobility)}
      ${renderStat('PT / Milestone', update.ptMilestone)}
      ${renderStat('Mood', update.mood)}
      ${renderStat('Visitors / Needs', update.needsVisitors)}
    </div>
  `;
}

function renderTimelineItem(update) {
  return `
    <article class="update-card">
      <span class="badge">Day ${escapeHtml(update.dayNumber ?? '')}</span>
      <h3>${escapeHtml(update.headline || 'Recovery update')}</h3>
      <p class="update-meta">${formatDate(update.date)}</p>
      <p>${escapeHtml(update.publicUpdate || '')}</p>
    </article>
  `;
}

function renderStat(label, value) {
  return `
    <div class="stat">
      <span class="stat-label">${escapeHtml(label)}</span>
      <span class="stat-value">${escapeHtml(value || '—')}</span>
    </div>
  `;
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
