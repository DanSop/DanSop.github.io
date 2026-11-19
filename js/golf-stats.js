const STANDARD_SLOPE = 113;

const rounds = JSON.parse(document.getElementById('golf-data').textContent)
  .map(round => ({ ...round, differential: scoreDifferential(round) }))
  .sort((a, b) => b.date.localeCompare(a.date));

renderSummary(rounds);
renderTable(rounds);
renderChart([...rounds].reverse());

function scoreDifferential({ score, rating, slope }) {
  return (score - rating) * STANDARD_SLOPE / slope;
}

function differentialsCounted(n) {
  if (n <= 5) return 1;
  if (n <= 8) return 2;
  if (n <= 11) return 3;
  if (n <= 14) return 4;
  if (n <= 16) return 5;
  if (n <= 18) return 6;
  return Math.round(n * 0.4);
}

function handicapIndex(rounds) {
  const lowest = rounds
    .map(r => r.differential)
    .sort((a, b) => a - b)
    .slice(0, differentialsCounted(rounds.length));
  return Math.round(mean(lowest) * 10) / 10;
}

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function renderSummary(rounds) {
  const scores = rounds.map(r => r.score);
  const stats = {
    'current-handicap': handicapIndex(rounds).toFixed(1),
    'rounds-played': rounds.length,
    'best-score': Math.min(...scores),
    'avg-score': mean(scores).toFixed(1),
  };
  for (const [id, value] of Object.entries(stats)) {
    document.getElementById(id).textContent = value;
  }
}

function renderTable(rounds) {
  const rows = rounds.map(r => {
    const row = document.createElement('tr');
    for (const value of [r.date, r.course, r.score, r.rating.toFixed(1), r.slope, r.differential.toFixed(1)]) {
      row.insertCell().textContent = value;
    }
    return row;
  });
  document.getElementById('scores-body').append(...rows);
}

function themeColors() {
  const style = getComputedStyle(document.documentElement);
  const read = name => style.getPropertyValue(name).trim();
  return { text: read('--muted'), grid: read('--rule'), line: read('--accent'), bg: read('--bg'), fg: read('--text') };
}

function lineStyle(c) {
  return { borderColor: c.line, backgroundColor: c.line, borderWidth: 1.5, pointRadius: 3, tension: 0 };
}

function chartOptions(c, rounds) {
  const axis = { border: { color: c.grid }, ticks: { color: c.text } };
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { ...axis, reverse: true, title: { display: true, text: 'Score', color: c.text }, grid: { color: c.grid } },
      x: { ...axis, grid: { display: false } },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: c.bg,
        titleColor: c.fg,
        bodyColor: c.fg,
        borderColor: c.grid,
        borderWidth: 1,
        displayColors: false,
        callbacks: {
          title: items => rounds[items[0].dataIndex].course,
          label: item => `${rounds[item.dataIndex].date}: ${item.parsed.y}`,
        },
      },
    },
  };
}

function renderChart(rounds) {
  if (typeof Chart === 'undefined') return;

  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 13;

  const colors = themeColors();
  const chart = new Chart(document.getElementById('score-chart'), {
    type: 'line',
    data: {
      labels: rounds.map(r => r.date.slice(5).replace('-', '/')),
      datasets: [{ data: rounds.map(r => r.score), ...lineStyle(colors) }],
    },
    options: chartOptions(colors, rounds),
  });

  document.addEventListener('themechange', () => {
    const colors = themeColors();
    Object.assign(chart.data.datasets[0], lineStyle(colors));
    chart.options = chartOptions(colors, rounds);
    chart.update();
  });
}
