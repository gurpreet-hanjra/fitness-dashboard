const RANGE_DAYS = 30;

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function renderWorkouts(workouts) {
  const container = document.getElementById('workouts-list');
  if (workouts.length === 0) {
    container.innerHTML = '<p class="muted">No workouts logged yet.</p>';
    return;
  }
  container.innerHTML = workouts
    .map((w, index) => {
      const date = new Date(w.started_at).toLocaleDateString();
      const load =
        w.training_load !== null
          ? `${w.training_load}${w.training_load_label ? ` (${w.training_load_label})` : ''}`
          : '--';
      const recovery = w.recovery_hours !== null ? `${w.recovery_hours}h` : '--';
      const imageUrl = `/api/workouts/image?started_at=${encodeURIComponent(w.started_at)}`;
      const thumb = w.image_key
        ? `<a href="${imageUrl}" target="_blank" rel="noopener">
             <img class="workout-thumb" src="${imageUrl}" alt="${w.sport} workout card" />
           </a>`
        : '';
      const adviceId = `workout-advice-${index}`;
      const adviceToggle = w.advice
        ? `<button class="advice-toggle" data-target="${adviceId}">View advice</button>
           <div class="advice-text" id="${adviceId}" hidden>${escapeHtml(w.advice)}</div>`
        : '';
      return `
        <div class="workout-item">
          <div class="workout-row">
            ${thumb}
            <div class="workout-content">
              <div class="workout-header">
                <strong>${w.sport}</strong>
                <span class="muted">${date}</span>
              </div>
              <div class="workout-stats">
                <span>${formatWorkoutDuration(w.duration_sec)}</span>
                <span>${w.active_kcal ?? '--'} kcal</span>
                <span>HR ${w.avg_hr ?? '--'}/${w.max_hr ?? '--'}</span>
                <span>Load: ${load}</span>
                <span>Recovery: ${recovery}</span>
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

  const labels = rows.map((r) => r.date);
  lineChart('weight-chart', labels, rows.map((r) => r.weight_kg), 'Weight (kg)', '#4f46e5');
  lineChart('steps-chart', labels, rows.map((r) => r.steps), 'Steps', '#16a34a');
  lineChart('hr-chart', labels, rows.map((r) => r.avg_hr), 'Avg HR', '#dc2626');
  lineChart(
    'sleep-chart',
    labels,
    rows.map((r) => (r.sleep_duration_min !== null ? r.sleep_duration_min / 60 : null)),
    'Sleep (hrs)',
    '#0891b2'
  );
  lineChart('body-fat-chart', labels, rows.map((r) => r.body_fat_pct), 'Body Fat %', '#d97706');

  renderWorkouts(workouts);

  const latestWeightRow = [...rows].reverse().find((r) => r.weight_kg !== null);
  if (latestWeightRow) {
    document.getElementById('weight-current').textContent = `${latestWeightRow.weight_kg} kg`;
  }

  if (rows.length > 0) {
    const latestUpdatedAt = rows.reduce(
      (max, r) => (r.updated_at > max ? r.updated_at : max),
      rows[0].updated_at
    );
    document.getElementById('last-updated').textContent =
      `Last updated: ${new Date(latestUpdatedAt).toLocaleString()}`;
  }

  if (goal) {
    const goalEl = document.getElementById('weight-goal');
    if (latestWeightRow) {
      const delta = (latestWeightRow.weight_kg - goal.target).toFixed(1);
      const sign = Number(delta) > 0 ? '+' : '';
      goalEl.textContent = `Goal: ${goal.target} kg (${sign}${delta} kg to go)`;
    } else {
      goalEl.textContent = `Goal: ${goal.target} kg`;
    }
  }
}

loadDashboard();
