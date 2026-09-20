const RANGE_DAYS = 30;

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(isoLike) {
  const [year, month, day] = String(isoLike).slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${url}`);
  return response.json();
}

function lineChart(canvasId, labels, data, label, color) {
  const ctx = document.getElementById(canvasId);
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{ label, data, borderColor: color, tension: 0.2, spanGaps: true }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}

function formatWorkoutDuration(sec) {
  if (sec === null || sec === undefined) return '--';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function loadBadgeColor(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('very high')) return 'red';
  if (l.includes('high')) return 'orange';
  if (l.includes('very low')) return 'green';
  if (l.includes('low')) return 'cyan';
  if (l.includes('moderate') || l.includes('optimal')) return 'yellow';
  return 'secondary';
}

function formatRecoveryStatus(startedAt, recoveryHours) {
  const recoveryEndsAt = new Date(startedAt).getTime() + recoveryHours * 3600000;
  const hoursLeft = Math.ceil((recoveryEndsAt - Date.now()) / 3600000);
  if (hoursLeft <= 0) return { text: 'Recovered', color: 'green' };
  const color = hoursLeft > recoveryHours / 2 ? 'red' : 'orange';
  return { text: `${hoursLeft}h recovery left`, color };
}

const STAT_TOOLTIPS = {
  duration: 'Total time of the workout',
  calories: 'Active calories burned during the workout',
  hr: 'Average / max heart rate during the workout, in beats per minute',
  load: 'Training load: a composite score of workout intensity and duration — higher means more strain on your body',
  recovery: 'Recommended recovery time before your next high-intensity session',
  vitality: 'Vitality score: reflects your overall fitness and readiness trend based on recent training and recovery',
};

function buildStatBadges(w) {
  const badges = [];
  if (w.duration_sec !== null) {
    badges.push(
      `<span class="badge bg-blue-lt" title="${STAT_TOOLTIPS.duration}"><i class="ti ti-clock"></i> ${formatWorkoutDuration(w.duration_sec)}</span>`
    );
  }
  if (w.active_kcal !== null) {
    badges.push(
      `<span class="badge bg-orange-lt" title="${STAT_TOOLTIPS.calories}"><i class="ti ti-flame"></i> ${w.active_kcal} kcal</span>`
    );
  }
  if (w.avg_hr !== null) {
    const hrText = w.max_hr !== null ? `${w.avg_hr}/${w.max_hr} bpm` : `${w.avg_hr} bpm avg`;
    badges.push(
      `<span class="badge bg-red-lt" title="${STAT_TOOLTIPS.hr}"><i class="ti ti-heartbeat"></i> ${hrText}</span>`
    );
  }
  if (w.training_load !== null) {
    const color = loadBadgeColor(w.training_load_label);
    const labelText = w.training_load_label ? ` &middot; ${escapeHtml(w.training_load_label)}` : '';
    badges.push(
      `<span class="badge bg-${color}-lt" title="${STAT_TOOLTIPS.load}"><i class="ti ti-bolt"></i> Load ${w.training_load}${labelText}</span>`
    );
  }
  if (w.recovery_hours !== null) {
    const status = formatRecoveryStatus(w.started_at, w.recovery_hours);
    badges.push(
      `<span class="badge bg-${status.color}-lt" title="${STAT_TOOLTIPS.recovery}"><i class="ti ti-moon"></i> ${status.text}</span>`
    );
  }
  if (w.vitality_score !== null) {
    badges.push(
      `<span class="badge bg-cyan-lt" title="${STAT_TOOLTIPS.vitality}"><i class="ti ti-trending-up"></i> Vitality ${w.vitality_score}</span>`
    );
  }
  return badges.join(' ');
}

function formatAdviceHtml(text) {
  const escaped = escapeHtml(text);
  const inline = (line) => line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  const html = [];
  let listItems = [];
  const flushList = () => {
    if (listItems.length > 0) {
      html.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join('')}</ul>`);
      listItems = [];
    }
  };

  for (const rawLine of escaped.split('\n')) {
    const line = rawLine.trim();
    if (line === '') {
      flushList();
    } else if (line.startsWith('### ')) {
      flushList();
      html.push(`<h5>${inline(line.slice(4))}</h5>`);
    } else if (line.startsWith('## ')) {
      flushList();
      html.push(`<h4>${inline(line.slice(3))}</h4>`);
    } else if (line.startsWith('- ')) {
      listItems.push(inline(line.slice(2)));
    } else {
      flushList();
      html.push(`<p>${inline(line)}</p>`);
    }
  }
  flushList();
  return html.join('');
}

function renderWorkouts(workouts) {
  const container = document.getElementById('workouts-list');
  if (workouts.length === 0) {
    container.innerHTML = '<p class="muted">No workouts logged yet.</p>';
    return;
  }
  container.innerHTML = workouts
    .map((w, index) => {
      const date = formatDisplayDate(w.started_at);
      const imageUrl = `/api/workouts/image?started_at=${encodeURIComponent(w.started_at)}`;
      const thumb = w.image_key
        ? `<a href="${imageUrl}" target="_blank" rel="noopener">
             <img class="workout-thumb" src="${imageUrl}" alt="${escapeHtml(w.sport)} workout card" />
           </a>`
        : '';
      const adviceId = `workout-advice-${index}`;
      const adviceToggle = w.advice
        ? `<button class="advice-toggle" data-target="${adviceId}">View advice</button>
           <div class="advice-text" id="${adviceId}" hidden>${formatAdviceHtml(w.advice)}</div>`
        : '';
      return `
        <div class="workout-item">
          <div class="workout-row">
            ${thumb}
            <div class="workout-content">
              <div class="workout-header">
                <strong>${escapeHtml(w.sport)}</strong>
                <span class="muted">${date}</span>
              </div>
              <div class="workout-stats">
                ${buildStatBadges(w)}
              </div>
              ${adviceToggle}
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.advice-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.target);
      if (!target) return;
      const isHidden = target.hidden;
      target.hidden = !isHidden;
      button.textContent = isHidden ? 'Hide advice' : 'View advice';
    });
  });
}

async function loadDashboard() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - RANGE_DAYS);

  let rows = [];
  let goal = null;
  let workouts = [];
  try {
    [rows, goal, workouts] = await Promise.all([
      fetchJson(`/api/metrics?from=${formatDate(from)}&to=${formatDate(to)}`),
      fetchJson('/api/goals?metric=weight_kg'),
      fetchJson(`/api/workouts?from=${formatDate(from)}&to=${formatDate(to)}`),
    ]);
  } catch (err) {
    document.querySelector('main').insertAdjacentHTML(
      'afterbegin',
      '<p class="error">Could not load data, showing last known state.</p>'
    );
    return;
  }

  const labels = rows.map((r) => formatDisplayDate(r.date));
  lineChart('weight-chart', labels, rows.map((r) => r.weight_kg), 'Weight (kg)', '#206bc4');
  lineChart('steps-chart', labels, rows.map((r) => r.steps), 'Steps', '#2fb344');
  lineChart('hr-chart', labels, rows.map((r) => r.avg_hr), 'Avg HR', '#d63939');
  lineChart(
    'sleep-chart',
    labels,
    rows.map((r) => (r.sleep_duration_min !== null ? r.sleep_duration_min / 60 : null)),
    'Sleep (hrs)',
    '#17a2b8'
  );
  lineChart('body-fat-chart', labels, rows.map((r) => r.body_fat_pct), 'Body Fat %', '#f76707');

  renderWorkouts(workouts);

  const latestWeightRow = [...rows].reverse().find((r) => r.weight_kg !== null);
  if (latestWeightRow) {
    document.getElementById('weight-current').textContent = `${latestWeightRow.weight_kg.toFixed(1)} kg`;
  }

  if (rows.length > 0) {
    const latestUpdatedAt = rows.reduce(
      (max, r) => (r.updated_at > max ? r.updated_at : max),
      rows[0].updated_at
    );
    document.getElementById('last-updated').textContent =
      `Last updated: ${formatDisplayDate(latestUpdatedAt)}, ${new Date(latestUpdatedAt).toLocaleTimeString()}`;
  }

  if (goal) {
    const goalEl = document.getElementById('weight-goal');
    if (latestWeightRow) {
      const delta = (goal.target - latestWeightRow.weight_kg).toFixed(1);
      const sign = Number(delta) > 0 ? '+' : '';
      goalEl.textContent = `Goal: ${goal.target} kg (${sign}${delta} kg to go)`;
    } else {
      goalEl.textContent = `Goal: ${goal.target} kg`;
    }
  }
}

loadDashboard();
