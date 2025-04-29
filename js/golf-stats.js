// golf-stats.js
document.addEventListener('DOMContentLoaded', function() {
  // Sample golf data - in a real implementation, you would load this from a JSON file or API
  const golfScores = [
    { date: '2025-04-10', course: 'Pine Valley', score: 82, courseRating: 71.5, slopeRating: 135 },
    { date: '2025-03-25', course: 'Oak Hills', score: 85, courseRating: 70.2, slopeRating: 128 },
    { date: '2025-03-12', course: 'Meadow Creek', score: 80, courseRating: 69.8, slopeRating: 122 },
    { date: '2025-02-28', course: 'Pine Valley', score: 83, courseRating: 71.5, slopeRating: 135 },
    { date: '2025-02-15', course: 'Harbor Links', score: 87, courseRating: 72.0, slopeRating: 140 },
    { date: '2025-01-30', course: 'Oak Hills', score: 84, courseRating: 70.2, slopeRating: 128 },
    { date: '2025-01-15', course: 'Meadow Creek', score: 81, courseRating: 69.8, slopeRating: 122 },
    { date: '2025-01-02', course: 'Harbor Links', score: 88, courseRating: 72.0, slopeRating: 140 }
  ];

  // Sort scores by date (newest first)
  golfScores.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Calculate score differentials for each round
  golfScores.forEach(round => {
    round.differential = calculateDifferential(round.score, round.courseRating, round.slopeRating);
  });

  // Populate the scores table
  populateScoresTable(golfScores);

  // Calculate and display handicap
  const handicap = calculateHandicap(golfScores);
  document.getElementById('current-handicap').textContent = handicap.toFixed(1);

  // Update summary stats
  document.getElementById('rounds-played').textContent = golfScores.length;
  document.getElementById('best-score').textContent = Math.min(...golfScores.map(round => round.score));
  document.getElementById('avg-score').textContent = (golfScores.reduce((sum, round) => sum + round.score, 0) / golfScores.length).toFixed(1);

  // Create score trend chart
  createScoreChart(golfScores);
});

// Calculate score differential for a single round
function calculateDifferential(score, courseRating, slopeRating) {
  return ((score - courseRating) * 113) / slopeRating;
}

// Calculate handicap index based on score differentials
function calculateHandicap(rounds) {
  // Get differentials in ascending order
  const differentials = rounds.map(round => round.differential).sort((a, b) => a - b);
  
  // Determine how many differentials to use based on number of rounds
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
  
  // Apply handicap formula (multiply by 0.96 and truncate to one decimal)
  return Math.round(avgDifferential * 0.96 * 10) / 10;
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
  
  const ctx = document.getElementById('scoreChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartScores.map(round => {
        const dateParts = round.date.split('-');
        return `${dateParts[1]}/${dateParts[2]}`;
      }),
      datasets: [{
        label: 'Score',
        data: chartScores.map(round => round.score),
        borderColor: '#3e95cd',
        backgroundColor: 'rgba(62, 149, 205, 0.1)',
        tension: 0.1,
        fill: true
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          reverse: true,
          title: {
            display: true,
            text: 'Score'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Date'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}
