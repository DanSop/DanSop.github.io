// golf-stats.js
document.addEventListener('DOMContentLoaded', function() {
  
  // This should be replaced with real data & should be a json in the future or changed so I dont have to edit this file everytime...
  // !TODO fix me for caching, Edit the default.html version date as well to enforce an update
  const golfScores = [
    { date: '2025-09-05', course: 'McCall Lake Golf Course', score: 91, courseRating: 72.0, slopeRating: 124},
    { date: '2025-08-20', course: 'McCall Lake Golf Course', score: 83, courseRating: 72.0, slopeRating: 124},
    { date: '2025-06-22', course: 'Fairmont Hot Springs - Mountainside', score: 88, courseRating: 69.6, slopeRating: 119},
    { date: '2025-06-21', course: 'Radium - The Springs course', score: 84, courseRating: 70.3, slopeRating: 123},
    { date: '2025-05-31', course: 'Silvertip Resort', score: 89, courseRating: 69.9, slopeRating: 140},
    { date: '2025-05-30', course: 'Fox Hollow', score: 84, courseRating: 68.3, slopeRating: 120},
    { date: '2025-05-25', course: 'Apple Creek', score: 85, courseRating: 70.0, slopeRating: 110 },
    { date: '2025-05-02', course: 'Shaganappi Point', score: 81, courseRating: 62.9, slopeRating: 110 },
    { date: '2025-04-27', course: 'Fairmont Hot Springs - Mountainside', score: 86, courseRating: 69.6, slopeRating: 119 },
    { date: '2025-04-26', course: 'Fairmont Hot Springs - Riverside', score: 94, courseRating: 71.7, slopeRating: 123 }
  ];


  golfScores.sort((a, b) => new Date(b.date) - new Date(a.date));

  golfScores.forEach(round => {
    round.differential = calculateDifferential(round.score, round.courseRating, round.slopeRating);
  });

  populateScoresTable(golfScores);

  const handicap = calculateHandicap(golfScores);
  document.getElementById('current-handicap').textContent = handicap.toFixed(1);

  document.getElementById('rounds-played').textContent = golfScores.length;
  document.getElementById('best-score').textContent = Math.min(...golfScores.map(round => round.score));
  document.getElementById('avg-score').textContent = (golfScores.reduce((sum, round) => sum + round.score, 0) / golfScores.length).toFixed(1);
  createScoreChart(golfScores);
});

// Calculate score differential for a single round
function calculateDifferential(score, courseRating, slopeRating) {
  return ((score - courseRating) * 113) / slopeRating;
}

// Calculate handicap index based on score differentials
function calculateHandicap(rounds) {
  const differentials = rounds.map(round => round.differential).sort((a, b) => a - b);
  let countToUse = 0;

  if (differentials.length <= 5) {
    countToUse = 1;
  } else if (differentials.length <= 8) {
    countToUse = 2;
  } else if (differentials.length <= 11) {
    countToUse = 3;
  } else if (differentials.length <= 14) {
    countToUse = 4;
  } else if (differentials.length <= 16) {
    countToUse = 5;
  } else if (differentials.length <= 18) {
    countToUse = 6;
  } else {
    countToUse = Math.round(differentials.length * 0.4);
  }

  // Calculate average of lowest differentials
  const lowestDifferentials = differentials.slice(0, countToUse);
  const avgDifferential = lowestDifferentials.reduce((sum, diff) => sum + diff, 0) / countToUse;

  // Return average directly rounded to one decimal 
  return Math.round(avgDifferential * 10) / 10;
}


// Populate scores table
function populateScoresTable(scores) {
  const tableBody = document.getElementById('scores-body');
  
  scores.forEach(round => {
    const row = document.createElement('tr');
    
    // Format date from YYYY-MM-DD to MM/DD/YYYY
    const dateParts = round.date.split('-');
    const formattedDate = `${dateParts[1]}/${dateParts[2]}/${dateParts[0]}`;
    
    row.innerHTML = `
      <td>${formattedDate}</td>
      <td>${round.course}</td>
      <td>${round.score}</td>
      <td>${round.courseRating}</td>
      <td>${round.slopeRating}</td>
      <td>${round.differential.toFixed(1)}</td>
    `;
    
    tableBody.appendChild(row);
  });
}

// Create score trend chart
function createScoreChart(scores) {
  // Reverse scores for chronological order in chart
  const chartScores = [...scores].reverse();
  
  // Get the theme mode to use appropriate colors
  const isDarkMode = document.documentElement.dataset.theme === 'dark';
  const textColor = isDarkMode ? '#eee' : '#222';
  const gridColor = isDarkMode ? '#444' : '#e8e8e8';
  const chartColor = isDarkMode ? '#79b8ff' : '#2a7ae2';
  
  const ctx = document.getElementById('scoreChart').getContext('2d');
  const scoreChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartScores.map(round => {
        const dateParts = round.date.split('-');
        return `${dateParts[1]}/${dateParts[2]}`;
      }),
      datasets: [{
        label: 'Score',
        data: chartScores.map(round => round.score),
        borderColor: chartColor,
        backgroundColor: `${chartColor}20`,
        tension: 0.1,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          reverse: true,
          title: {
            display: true,
            text: 'Score',
            color: textColor
          },
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor
          }
        },
        x: {
          title: {
            display: true,
            text: 'Date',
            color: textColor
          },
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: isDarkMode ? '#333' : 'rgba(255, 255, 255, 0.8)',
          titleColor: isDarkMode ? '#fff' : '#222',
          bodyColor: isDarkMode ? '#fff' : '#222',
          borderColor: isDarkMode ? '#444' : '#ddd',
          borderWidth: 1
        }
      }
    }
  });
  
  document.getElementById('theme-toggle').addEventListener('click', function() {
    setTimeout(() => {
      const newIsDarkMode = document.documentElement.dataset.theme === 'dark';
      const newTextColor = newIsDarkMode ? '#eee' : '#222';
      const newGridColor = newIsDarkMode ? '#444' : '#e8e8e8';
      const newChartColor = newIsDarkMode ? '#79b8ff' : '#2a7ae2';
      
      scoreChart.data.datasets[0].borderColor = newChartColor;
      scoreChart.data.datasets[0].backgroundColor = `${newChartColor}20`;
      
      scoreChart.options.scales.y.title.color = newTextColor;
      scoreChart.options.scales.y.grid.color = newGridColor;
      scoreChart.options.scales.y.ticks.color = newTextColor;
      scoreChart.options.scales.x.title.color = newTextColor;
      scoreChart.options.scales.x.grid.color = newGridColor;
      scoreChart.options.scales.x.ticks.color = newTextColor;
      
      scoreChart.options.plugins.tooltip.backgroundColor = newIsDarkMode ? '#333' : 'rgba(255, 255, 255, 0.8)';
      scoreChart.options.plugins.tooltip.titleColor = newIsDarkMode ? '#fff' : '#222';
      scoreChart.options.plugins.tooltip.bodyColor = newIsDarkMode ? '#fff' : '#222';
      scoreChart.options.plugins.tooltip.borderColor = newIsDarkMode ? '#444' : '#ddd';
      
      scoreChart.update();
    }, 100);
  });
}
