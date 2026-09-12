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

async function loadDashboard() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - RANGE_DAYS);

  let rows = [];
  let goal = null;
  try {
    [rows, goal] = await Promise.all([
      fetchJson(`/api/metrics?from=${formatDate(from)}&to=${formatDate(to)}`),
      fetchJson('/api/goals?metric=weight_kg'),
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

  const latestWeightRow = [...rows].reverse().find((r) => r.weight_kg !== null);
  if (latestWeightRow) {
    document.getElementById('weight-current').textContent = `${latestWeightRow.weight_kg} kg`;
    document.getElementById('last-updated').textContent =
      `Last updated: ${new Date(latestWeightRow.updated_at).toLocaleString()}`;
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
