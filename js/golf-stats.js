document.addEventListener('DOMContentLoaded', function () {
  const rounds = JSON.parse(document.getElementById('golf-data').textContent);

  rounds.sort((a, b) => b.date.localeCompare(a.date));
  rounds.forEach(round => {
    round.differential = calculateDifferential(round.score, round.rating, round.slope);
  });

  populateScoresTable(rounds);

  document.getElementById('current-handicap').textContent = calculateHandicap(rounds).toFixed(1);
  document.getElementById('rounds-played').textContent = rounds.length;
  document.getElementById('best-score').textContent = Math.min(...rounds.map(r => r.score));
  document.getElementById('avg-score').textContent = (rounds.reduce((sum, r) => sum + r.score, 0) / rounds.length).toFixed(1);

  createScoreChart(rounds);
});

function calculateDifferential(score, courseRating, slopeRating) {
  return ((score - courseRating) * 113) / slopeRating;
}

function calculateHandicap(rounds) {
  const differentials = rounds.map(r => r.differential).sort((a, b) => a - b);
  const n = differentials.length;
  let countToUse;

  if (n <= 5) countToUse = 1;
  else if (n <= 8) countToUse = 2;
  else if (n <= 11) countToUse = 3;
  else if (n <= 14) countToUse = 4;
  else if (n <= 16) countToUse = 5;
  else if (n <= 18) countToUse = 6;
  else countToUse = Math.round(n * 0.4);

  const lowest = differentials.slice(0, countToUse);
  const avg = lowest.reduce((sum, d) => sum + d, 0) / countToUse;
  return Math.round(avg * 10) / 10;
}

function populateScoresTable(rounds) {
  const body = document.getElementById('scores-body');

  rounds.forEach(round => {
    const row = document.createElement('tr');
    [round.date, round.course, round.score, round.rating.toFixed(1), round.slope, round.differential.toFixed(1)]
      .forEach(value => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      });
    body.appendChild(row);
  });
}

function chartColors() {
  const css = getComputedStyle(document.documentElement);
  return {
    text: css.getPropertyValue('--muted').trim(),
    grid: css.getPropertyValue('--rule').trim(),
    line: css.getPropertyValue('--accent').trim(),
    bg: css.getPropertyValue('--bg').trim(),
    fg: css.getPropertyValue('--text').trim()
  };
}

function createScoreChart(rounds) {
  if (typeof Chart === 'undefined') return;

  const chronological = [...rounds].reverse();
  const c = chartColors();

  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 13;

  const chart = new Chart(document.getElementById('scoreChart'), {
    type: 'line',
    data: {
      labels: chronological.map(r => r.date.slice(5).replace('-', '/')),
      datasets: [{
        data: chronological.map(r => r.score),
        borderColor: c.line,
        backgroundColor: c.line,
        borderWidth: 1.5,
        pointRadius: 3,
        tension: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          reverse: true,
          title: { display: true, text: 'Score', color: c.text },
          grid: { color: c.grid },
          border: { color: c.grid },
          ticks: { color: c.text }
        },
        x: {
          grid: { display: false },
          border: { color: c.grid },
          ticks: { color: c.text }
        }
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
            title: items => chronological[items[0].dataIndex].course,
            label: item => `${chronological[item.dataIndex].date}: ${item.parsed.y}`
          }
        }
      }
    }
  });

  document.addEventListener('themechange', function () {
    const c = chartColors();
    const ds = chart.data.datasets[0];
    ds.borderColor = ds.backgroundColor = c.line;
    ['x', 'y'].forEach(axis => {
      chart.options.scales[axis].ticks.color = c.text;
      chart.options.scales[axis].border.color = c.grid;
    });
    chart.options.scales.y.grid.color = c.grid;
    chart.options.scales.y.title.color = c.text;
    Object.assign(chart.options.plugins.tooltip, {
      backgroundColor: c.bg, titleColor: c.fg, bodyColor: c.fg, borderColor: c.grid
    });
    chart.update();
  });
}
